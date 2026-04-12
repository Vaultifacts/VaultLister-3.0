"""
Step 5 — Replace hardcoded CSS hex literals with CSS custom property references.
Only replaces in: style="...", .style.PROP = "...", .style.cssText = "..."
Skips: <style>...</style> blocks, platform brand colors, rgba/rgb, short-form hex,
       hex in data/logic contexts, comment lines.
"""

import os, re, glob

# ── Hex → CSS variable mapping ──────────────────────────────────────────────
HEX_TO_VAR = {
    '#10b981': 'var(--success)',
    '#111827': 'var(--gray-900)',
    '#15803d': 'var(--green-700)',
    '#16a34a': 'var(--green-600)',
    '#1d4ed8': 'var(--blue-700)',
    '#1f2937': 'var(--gray-800)',
    '#22c55e': 'var(--green-500)',
    '#2563eb': 'var(--blue-600)',
    '#374151': 'var(--gray-700)',
    '#3b82f6': 'var(--info)',
    '#4ade80': 'var(--green-400)',
    '#4b5563': 'var(--gray-600)',
    '#60a5fa': 'var(--blue-400)',
    '#6b7280': 'var(--gray-500)',
    '#713f12': 'var(--yellow-900)',
    '#78350f': 'var(--primary-900)',
    '#854d0e': 'var(--yellow-800)',
    '#86efac': 'var(--green-300)',
    '#92400e': 'var(--primary-800)',
    '#93c5fd': 'var(--blue-300)',
    '#9ca3af': 'var(--gray-400)',
    '#a16207': 'var(--yellow-700)',
    '#b45309': 'var(--primary-700)',
    '#b91c1c': 'var(--error-700)',
    '#bbf7d0': 'var(--green-200)',
    '#bfdbfe': 'var(--blue-200)',
    '#ca8a04': 'var(--yellow-600)',
    '#d1d5db': 'var(--gray-300)',
    '#d1fae5': 'var(--success-light)',
    '#d97706': 'var(--primary-600)',
    '#dbeafe': 'var(--info-light)',
    '#dc2626': 'var(--error-600)',
    '#dcfce7': 'var(--green-100)',
    '#e5e7eb': 'var(--gray-200)',
    '#eab308': 'var(--yellow-500)',
    '#ef4444': 'var(--error)',
    '#eff6ff': 'var(--blue-50)',
    '#f0fdf4': 'var(--green-50)',
    '#f3f4f6': 'var(--gray-100)',
    '#f59e0b': 'var(--primary-500)',
    '#f87171': 'var(--error-400)',
    '#f97316': 'var(--warning)',
    '#f9fafb': 'var(--gray-50)',
    '#facc15': 'var(--yellow-400)',
    '#fbbf24': 'var(--primary-400)',
    '#fca5a5': 'var(--error-300)',
    '#fcd34d': 'var(--primary-300)',
    '#fde047': 'var(--yellow-300)',
    '#fde68a': 'var(--primary-200)',
    '#fecaca': 'var(--error-200)',
    '#fee2e2': 'var(--error-light)',
    '#fef08a': 'var(--yellow-200)',
    '#fef2f2': 'var(--error-50)',
    '#fef3c7': 'var(--primary-100)',
    '#fef9c3': 'var(--yellow-100)',
    '#fefce8': 'var(--yellow-50)',
    '#ffedd5': 'var(--warning-light)',
    '#fffbeb': 'var(--primary-50)',
}

# Platform brand colors — skip these
BRAND_SKIP = {
    '#000000',  # --grailed
    '#1877f2',  # --facebook
    '#7f0353',  # --poshmark
    '#4dc7ec',  # --mercari
    '#e53238',  # --ebay
    '#f56400',  # --etsy
    '#ff2300',  # --depop
}

# ── Patterns that match "6-digit hex" as a word boundary ────────────────────
# We match exactly 6 hex digits (full form only — short #333 etc. are left alone)
HEX6_RE = re.compile(r'#([0-9a-fA-F]{6})\b')

# Regex to find <style>...</style> blocks so we can skip them
STYLE_BLOCK_RE = re.compile(r'<style[^>]*>.*?</style>', re.DOTALL | re.IGNORECASE)

# ── Context detection patterns (same as audit-colors.py) ────────────────────
INLINE_STYLE_RE = re.compile(r"style=['\"`]")
CSST_EXT_RE     = re.compile(r'\.style\.cssText\s*=')
STYLE_PROP_RE   = re.compile(r'\.style\.\w+\s*=')

# ── Helpers ──────────────────────────────────────────────────────────────────

def build_style_block_ranges(content):
    """Return list of (start, end) char offsets for <style>...</style> blocks."""
    ranges = []
    for m in STYLE_BLOCK_RE.finditer(content):
        ranges.append((m.start(), m.end()))
    return ranges


def in_style_block(pos, ranges):
    for s, e in ranges:
        if s <= pos < e:
            return True
    return False


def replace_hex_in_value(value_str, unmapped_collector):
    """
    Replace 6-digit hex literals found inside a CSS value string
    (the content of a style attribute, .style.prop, or .style.cssText).
    Returns (new_str, count).
    """
    count = 0

    def replacer(m):
        nonlocal count
        full = m.group(0).lower()          # e.g. '#6b7280'
        if full in BRAND_SKIP:
            return m.group(0)              # keep as-is
        if full in HEX_TO_VAR:
            count += 1
            return HEX_TO_VAR[full]
        else:
            unmapped_collector.add(full)
            return m.group(0)              # no mapping, keep as-is

    new_str = HEX6_RE.sub(replacer, value_str)
    return new_str, count


def process_file(filepath):
    """
    Process one JS file.
    Returns (new_content, total_replacements, unmapped_set).
    """
    with open(filepath, encoding='utf-8', errors='ignore') as fh:
        content = fh.read()

    style_block_ranges = build_style_block_ranges(content)
    lines = content.split('\n')
    unmapped = set()
    total_replacements = 0
    new_lines = []

    # We need character-level positions to check style-block membership.
    # Build cumulative offsets once.
    cumulative = []
    pos = 0
    for line in lines:
        cumulative.append(pos)
        pos += len(line) + 1  # +1 for the '\n'

    for i, line in enumerate(lines):
        line_start = cumulative[i]

        # Skip pure comment lines (same as audit)
        stripped = line.strip()
        if stripped.startswith('//') or stripped.startswith('*'):
            new_lines.append(line)
            continue

        # Quick bail: no 6-digit hex on this line at all
        if not HEX6_RE.search(line):
            new_lines.append(line)
            continue

        # Skip if entire line is inside a <style> block
        if in_style_block(line_start, style_block_ranges):
            new_lines.append(line)
            continue

        # Determine which context(s) apply
        is_inline  = bool(INLINE_STYLE_RE.search(line))
        is_csstext = bool(CSST_EXT_RE.search(line))
        is_prop    = bool(STYLE_PROP_RE.search(line))

        if not (is_inline or is_csstext or is_prop):
            # Not a style context — leave line untouched
            new_lines.append(line)
            continue

        # Now do targeted replacement.
        # Strategy: find the style value portion(s) and replace only within them.
        # For safety, we replace the whole line but restrict the regex to only
        # match hex that immediately follows a CSS-property pattern or is inside
        # a quoted style attribute string.

        new_line, count = replace_hex_in_value(line, unmapped)
        total_replacements += count
        new_lines.append(new_line)

    new_content = '\n'.join(new_lines)
    return new_content, total_replacements, unmapped


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    src = r'C:\Users\Matt1\OneDrive\Desktop\vaultlister-3\src\frontend'
    js_files = [
        f for f in glob.glob(src + r'\**\*.js', recursive=True)
        if 'core-bundle.js' not in f
    ]

    grand_total = 0
    all_unmapped = set()
    modified_files = []

    for filepath in sorted(js_files):
        new_content, count, unmapped = process_file(filepath)
        all_unmapped |= unmapped
        if count > 0:
            with open(filepath, 'w', encoding='utf-8') as fh:
                fh.write(new_content)
            rel = os.path.relpath(filepath, src)
            modified_files.append((rel, count))
            grand_total += count

    print('=== Step 5 — Hex → CSS var replacement ===')
    print(f'Files modified: {len(modified_files)}')
    for f, c in modified_files:
        print(f'  {f}: {c} replacement(s)')
    print(f'\nTotal replacements: {grand_total}')

    if all_unmapped:
        print(f'\nHex values in style contexts with NO CSS var mapping ({len(all_unmapped)}):')
        for h in sorted(all_unmapped):
            print(f'  {h}')
    else:
        print('\nNo unmapped hex values found in style contexts.')


if __name__ == '__main__':
    main()
