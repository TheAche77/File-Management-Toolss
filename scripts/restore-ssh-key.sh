#!/bin/bash
set -e

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
  printf 'https://x-access-token:%s@github.com\n' "$GITHUB_SSH_KEY" > ~/.git-credentials
  chmod 600 ~/.git-credentials
  git config --global credential.helper store

  echo "GitHub token credential configured via git credential store."
fi
