#!/bin/bash
# VaultLister Internal Link Checker
# Scans all HTML files in public/ for internal href and src attributes,
# checks whether the target file exists on disk.
# Anchor-only links (#...) are skipped — the SPA handles those.
#
# Usage:
#   bash scripts/check-links.sh
#
# Exit codes: 0 = all links resolve, 1 = broken links found

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PUBLIC_DIR="${ROOT_DIR}/public"

broken=0
checked=0

# Collect all href="..." and src="..." values from HTML files
while IFS= read -r html_file; do
    # Extract raw attribute values for href and src
    while IFS= read -r raw; do
        # Strip surrounding quotes and leading/trailing whitespace
        link="${raw//\"/}"
        link="${link//\'/}"
        link="$(echo "$link" | tr -d '[:space:]')"

        # Skip empty
        [ -z "$link" ] && continue

        # Skip external URLs
        case "$link" in
            http://*|https://*|mailto:*|tel:*|data:*|javascript:*) continue ;;
        esac

        # Skip pure anchor links — SPA handles these
        case "$link" in
            \#*) continue ;;
        esac

        # Strip query string and in-page fragment
        path="${link%%\?*}"
        path="${path%%#*}"

        [ -z "$path" ] && continue

        # Resolve to an absolute filesystem path
        if [[ "$path" == /* ]]; then
            # Absolute path relative to public root
            candidate="${PUBLIC_DIR}${path}"
        else
            # Relative path — resolve from the HTML file's directory
            html_dir="$(dirname "$html_file")"
            candidate="${html_dir}/${path}"
        fi

        # If the candidate has no extension it might be a directory index
        if [ ! -e "$candidate" ] && [ ! -e "${candidate}.html" ]; then
            rel_html="${html_file#${ROOT_DIR}/}"
            echo "BROKEN  ${rel_html}  ->  ${link}"
            broken=$((broken + 1))
        fi

        checked=$((checked + 1))
    done < <(grep -oE '(href|src)=["\x27][^"'\'']+["\x27]' "$html_file" \
              | sed -E 's/^(href|src)=["\x27]//' \
              | sed -E "s/[\"'][[:space:]]*$//")

done < <(find "$PUBLIC_DIR" -name "*.html" -type f | sort)

echo ""
echo "Checked ${checked} internal links across $(find "$PUBLIC_DIR" -name "*.html" | wc -l | tr -d ' ') HTML files."

if [ "$broken" -gt 0 ]; then
    echo "FAIL — ${broken} broken link(s) found."
    exit 1
else
    echo "PASS — all internal links resolve."
    exit 0
fi
