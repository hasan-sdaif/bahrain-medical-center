#!/usr/bin/env bash
# foreground fetch — small repos first, resilient resume
set -u
cd "$(dirname "$0")/../reference-systems" 2>/dev/null || { mkdir -p reference-systems; cd reference-systems; }
fetch() {
  local dir="$1" repo="$2" tries=0
  if [ -d "$dir" ] && [ -n "$(ls -A "$dir" 2>/dev/null)" ]; then echo "[skip] $dir"; return 0; fi
  for tries in 1 2 3 4; do
    if curl -sfL -C - --max-time 150 --speed-limit 10000 --speed-time 25 "https://codeload.github.com/$repo/tar.gz/HEAD" -o "/tmp/$dir.tgz"; then
      mkdir -p "$dir"
      if tar -xzf "/tmp/$dir.tgz" -C "$dir" --strip-components=1 2>/dev/null; then
        rm -f "/tmp/$dir.tgz"; echo "[ok] $dir ($(du -sh "$dir" | cut -f1))"; return 0
      fi
    fi
    sleep 2
  done
  echo "[FAIL] $dir"; rm -f "/tmp/$dir.tgz"; return 1
}
for spec in "$@"; do fetch "${spec%%|*}" "${spec##*|}"; done
