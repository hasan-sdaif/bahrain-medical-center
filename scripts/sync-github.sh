#!/usr/bin/env bash
# sync-github.sh — commit & push project to GitHub (hasan-sdaif/bahrain-medical-center)
# Auth lives in .git/config remote URL (never committed). This file contains NO secrets.
set -uo pipefail
cd "$(dirname "$0")/.."
GIT=git
if ! ($GIT diff --quiet && $GIT diff --cached --quiet && [ -z "$($GIT ls-files --others --exclude-standard)" ]); then
  $GIT add -A
  $GIT commit -m "chore(sync): checkpoint $(date -u +%Y-%m-%dT%H:%M:%SZ)" || true
fi
$GIT pull --rebase origin main --quiet || true
if $GIT push origin main 2>/dev/null; then
  echo "[$(date -u +%H:%M:%SZ)] pushed ✓"
else
  echo "[$(date -u +%H:%M:%SZ)] push failed (will retry next cycle)"
  exit 1
fi
