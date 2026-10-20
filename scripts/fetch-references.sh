#!/usr/bin/env bash
# fetch-references.sh — resilient resume-based tarball fetcher for the 12
# mandatory reference systems (spec §2.1). Retries stalled transfers with -C -.
set -u
cd "$(dirname "$0")/.."
mkdir -p reference-systems
cd reference-systems

fetch() {
  local dir="$1" repo="$2" tries=0
  if [ -d "$dir" ] && [ -n "$(ls -A "$dir" 2>/dev/null)" ]; then echo "[skip] $dir"; return 0; fi
  echo "[fetch] $dir <- $repo"
  while [ $tries -lt 6 ]; do
    tries=$((tries+1))
    if curl -sfL -C - --max-time 240 --speed-limit 10240 --speed-time 30 \
         "https://codeload.github.com/$repo/tar.gz/HEAD" -o "/tmp/$dir.tgz"; then
      if tar -xzf "/tmp/$dir.tgz" -C /tmp 2>/dev/null; then :; fi
      mkdir -p "$dir"
      if tar -xzf "/tmp/$dir.tgz" -C "$dir" --strip-components=1 2>>fetch-errors.log; then
        rm -f "/tmp/$dir.tgz"; echo "[ok] $dir ($(du -sh "$dir" | cut -f1))"; return 0
      fi
    fi
    echo "  retry $tries for $dir (have $(stat -c%s /tmp/$dir.tgz 2>/dev/null || echo 0) bytes)"
    sleep 3
  done
  echo "[FAIL] $dir after $tries tries"; rm -f "/tmp/$dir.tgz"; return 1
}

fetch openemr       "openemr/openemr"
fetch openmrs-core  "openmrs/openmrs-core"
fetch bahmni-core   "Bahmni/bahmni-core"
fetch openhospital  "informatici/OpenHospital"
fetch frappe-health "frappe/health"
fetch erpnext       "frappe/erpnext"
fetch care          "ohcnetwork/care"
fetch medplum       "medplum/medplum"
fetch foo-medical   "medplum/foomedical"
fetch openelis      "DIGI-UW/OpenELIS-Global-2"
fetch ohif-viewers  "OHIF/Viewers"
fetch icoms         "Ishitayg/software_project"
echo "=== GNU Health: GNU Savannah (Mercurial) — no GitHub; see docs/references ==="
echo "=== DONE $(date -u +%FT%TZ) ==="
du -sh . 2>/dev/null
