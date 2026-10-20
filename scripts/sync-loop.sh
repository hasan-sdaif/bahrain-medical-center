#!/usr/bin/env bash
# sync-loop.sh — pushes the repo to GitHub every hour (3600s).
# Started with: nohup bash scripts/sync-loop.sh > scripts/sync-loop.log 2>&1 &
cd "$(dirname "$0")/.."
echo "[$(date -u +%FT%TZ)] hourly sync loop started (interval 3600s)"
while true; do
  bash scripts/sync-github.sh || true
  sleep 3600
done
