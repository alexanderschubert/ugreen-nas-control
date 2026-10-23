#!/bin/bash
#
# Fails if led/ is not exactly what scripts/sync-led.sh produces from the commit
# recorded in led/VERSION ("<describe> <commit> <repo url>"). Hand edits to led/ show
# up as a diff; fix them in the LED repository and sync again.
#
#   scripts/check-led.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

read -r _ SHA REPO extra < "${ROOT}/led/VERSION"
if [[ ! "${SHA}" =~ ^[0-9a-f]{40}$ || -z "${REPO:-}" || -n "${extra:-}" ]]; then
    echo "led/VERSION must read '<describe> <40-digit commit> <repo url>'" >&2
    exit 1
fi

git init -q "${TMP}/src"
git -C "${TMP}/src" fetch -q --depth 1 "${REPO}" "${SHA}"
git -C "${TMP}/src" -c advice.detachedHead=false checkout -q FETCH_HEAD

# VERSION is skipped: its describe part differs between a full clone and this shallow
# one. The commit and the URL in it are what the fetch above used.
LED_REPO="${REPO}" LED_OUT="${TMP}/led" "${ROOT}/scripts/sync-led.sh" "${TMP}/src" "${SHA}" > /dev/null

if ! diff -ru -x VERSION "${TMP}/led" "${ROOT}/led"; then
    echo >&2
    echo "led/ differs from ${SHA:0:7} of ${REPO} (diff above: - synced, + in led/)." >&2
    exit 1
fi
echo "led/ matches ${SHA:0:7} of ${REPO}."
