#!/usr/bin/env bash
# clone-references.sh — shallow-clone the 12 mandatory reference systems (spec §2.1)
# into reference-systems/ (gitignored — local study only, NEVER pushed to GitHub).
set -u
cd "$(dirname "$0")/.."
mkdir -p reference-systems
cd reference-systems

clone() {
  local dir="$1" url="$2"
  if [ -d "$dir/.git" ] || [ -d "$dir" ]; then
    echo "[skip] $dir already exists"
    return 0
  fi
  echo "[clone] $dir <- $url"
  if git clone --depth 1 --single-branch --quiet "$url" "$dir" 2>>clone-errors.log; then
    local size
    size=$(du -sh "$dir" 2>/dev/null | cut -f1)
    echo "[ok] $dir ($size)"
  else
    echo "[FAIL] $dir — see clone-errors.log"
  fi
}

# Core EMR / HIS reference systems (spec §2.1 table)
clone openemr        "https://github.com/openemr/openemr.git"
clone openmrs-core   "https://github.com/openmrs/openmrs-core.git"
clone bahmni-core    "https://github.com/Bahmni/bahmni-core.git"
clone openhospital   "https://github.com/informatici/OpenHospital.git"
clone frappe-health  "https://github.com/frappe/health.git"
clone erpnext        "https://github.com/frappe/erpnext.git"
clone care           "https://github.com/ohcnetwork/care.git"
clone medplum        "https://github.com/medplum/medplum.git"
clone foo-medical    "https://github.com/medplum/foomedical.git"
clone openelis       "https://github.com/DIGI-UW/OpenELIS-Global-2.git"
clone ohif-viewers   "https://github.com/OHIF/Viewers.git"
clone icoms          "https://github.com/Ishitayg/software_project.git"

echo "=== GNU Health: developed on GNU Savannah (Mercurial), no official GitHub repo — documented in docs/references/gnu-health.md ==="
echo "=== DONE $(date -u +%FT%TZ) ==="
du -sh . 2>/dev/null
