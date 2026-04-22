#!/bin/bash
set -e

# GITHUB_SSH_KEY should be a fine-grained GitHub personal access token
# (github_pat_...) scoped exclusively to this repository with Contents:
# Read and write permission. A fine-grained PAT can be revoked independently
# of your personal account without affecting other projects.
#
# To rotate: generate a new fine-grained PAT at
#   GitHub → Settings → Developer settings → Personal access tokens →
#   Fine-grained tokens
# then update the GITHUB_SSH_KEY secret in Replit Secrets.

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
