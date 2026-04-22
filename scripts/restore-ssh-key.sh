#!/bin/bash
set -e

# GITHUB_SSH_KEY should be a fine-grained GitHub personal access token
# (github_pat_...) scoped exclusively to this repository with Contents:
# Read and write permission. A fine-grained PAT can be revoked independently
# of your personal account without affecting other projects.
#
# TOKEN ROTATION SCHEDULE:
#   Tokens should be rotated every 90 days. The expiry date is tracked in the
#   GITHUB_TOKEN_EXPIRY secret (format: YYYY-MM-DD). When you rotate:
#     1. Go to GitHub → Settings → Developer settings → Personal access tokens →
#        Fine-grained tokens
#     2. Generate a new fine-grained PAT with Contents: Read and write permission
#        and set its expiry to 90 days from today
#     3. Update GITHUB_SSH_KEY in Replit Secrets with the new token
#     4. Update GITHUB_TOKEN_EXPIRY in Replit Secrets to the new expiry date

# --- Token expiry check ---
if [ -n "$GITHUB_TOKEN_EXPIRY" ]; then
  today=$(date -u +%Y-%m-%d)
  expiry="$GITHUB_TOKEN_EXPIRY"

  # Convert dates to seconds-since-epoch for comparison (portable across Linux/macOS)
  today_ts=$(date -u -d "$today" +%s 2>/dev/null || date -u -j -f "%Y-%m-%d" "$today" +%s)
  expiry_ts=$(date -u -d "$expiry" +%s 2>/dev/null || date -u -j -f "%Y-%m-%d" "$expiry" +%s)

  days_remaining=$(( (expiry_ts - today_ts) / 86400 ))

  if [ "$days_remaining" -lt 0 ]; then
    echo "ERROR: GitHub token expired on $expiry ($(( -days_remaining )) days ago). Push access will fail." >&2
    echo "       Rotate the token now: GitHub → Settings → Developer settings → Fine-grained tokens" >&2
    echo "       Then update GITHUB_SSH_KEY and GITHUB_TOKEN_EXPIRY in Replit Secrets." >&2
    if [ "${ENFORCE_GITHUB_TOKEN_EXPIRY:-false}" = "true" ]; then
      echo "       ENFORCE_GITHUB_TOKEN_EXPIRY=true — aborting." >&2
      exit 1
    fi
  elif [ "$days_remaining" -le 14 ]; then
    echo "WARNING: GitHub token expires on $expiry ($days_remaining days remaining). Rotate soon." >&2
    echo "         GitHub → Settings → Developer settings → Fine-grained tokens" >&2
    echo "         Then update GITHUB_SSH_KEY and GITHUB_TOKEN_EXPIRY in Replit Secrets." >&2
  else
    echo "GitHub token is valid until $expiry ($days_remaining days remaining)."
  fi
else
  echo "Notice: GITHUB_TOKEN_EXPIRY is not set. Set it (YYYY-MM-DD) so expiry warnings appear automatically."
fi
# --- End token expiry check ---

if [ -z "$GITHUB_SSH_KEY" ]; then
  echo "Warning: GITHUB_SSH_KEY secret is not set. GitHub push access will not work."
  exit 0
fi

mkdir -p ~/.ssh
chmod 700 ~/.ssh

if echo "$GITHUB_SSH_KEY" | grep -q "^-----BEGIN"; then
  printf '%s\n' "$GITHUB_SSH_KEY" > ~/.ssh/github_replit
  chmod 600 ~/.ssh/github_replit

  if [ ! -f ~/.ssh/config ]; then
    cat > ~/.ssh/config << 'EOF'
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/github_replit
  IdentitiesOnly yes
  StrictHostKeyChecking accept-new
EOF
    chmod 600 ~/.ssh/config
  fi

  echo "SSH private key restored to ~/.ssh/github_replit"
else
  # Detect token type for audit visibility
  if echo "$GITHUB_SSH_KEY" | grep -q "^github_pat_"; then
    echo "Fine-grained PAT detected — configuring git credential store."
  else
    echo "Warning: GITHUB_SSH_KEY does not appear to be a fine-grained PAT (expected github_pat_... prefix). Consider rotating to a fine-grained token for better security isolation."
  fi

  printf 'https://x-access-token:%s@github.com\n' "$GITHUB_SSH_KEY" > ~/.git-credentials
  chmod 600 ~/.git-credentials
  git config --global credential.helper store

  echo "GitHub token credential configured via git credential store."
fi
