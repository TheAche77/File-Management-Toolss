#!/bin/bash
set -e
bash scripts/restore-ssh-key.sh
pnpm install --frozen-lockfile
pnpm --filter db push
