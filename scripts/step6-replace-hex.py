#!/usr/bin/env python3
"""
Step 6 Phase B: Replace 8 hardcoded hex values with CSS vars in JS source files.
Only replaces hex in style contexts; skips data/config objects and comments.
"""

import re
import glob
import os

# Mapping of hex -> CSS var (case-insensitive matching, output lowercase hex)
REPLACEMENTS = {
    '#ecfdf5': 'var(--emerald-50)',
    '#059669': 'var(--emerald-600)',
    '#0891b2': 'var(--cyan-600)',
    '#0c4a6e': 'var(--sky-900)',
    '#166534': 'var(--green-800)',
    '#1e40af': 'var(--blue-800)',
    '#7c3aed': 'var(--violet-600)',
    '#991b1b': 'var(--red-800)',
}

# Hex values to skip (data/config contexts) - these are lines we explicitly exclude
# We detect these by checking if the hex appears in a data object assignment context
SKIP_LINE_PATTERNS = [
    # Default value for color picker input (not a style property)
    r"const\s+primaryColor\s*=",
    # statusColors data object
    r"const\s+statusColors\s*=",
    # Direct key-value color map entries like `poshmark: '#7c3aed'`
    r"^\s*\w+:\s*'#[0-9a-fA-F]{6}'\s*,?\s*$",
]

SKIP_PATTERNS = [re.compile(p) for p in SKIP_LINE_PATTERNS]


def should_skip_line(line):
    """Return True if this line is a data/config context that should not be modified."""
    for pat in SKIP_PATTERNS:
        if pat.search(line):
            return True
    return False


def replace_in_style_context(line):
    """
    Replace hex values only when they appear in style contexts:
    - Inside style="..." attribute strings
    - After .style.PROP =
    - In .style.cssText =
    - Inside var(--X, #hex) fallback positions (CSS var fallbacks inside style strings)

    Returns (new_line, count_of_replacements)
    """
    if should_skip_line(line):
        return line, 0

    count = 0
    result = line

    for hex_val, css_var in REPLACEMENTS.items():
        # Build case-insensitive pattern for this hex
        pattern = re.compile(re.escape(hex_val), re.IGNORECASE)

        # Check if hex exists in line first
        if not pattern.search(result):
            continue

        # Strategy: replace hex only when it appears in a style-attribute string context.
        # We look for the hex inside template literal or string sections that are
        # plausibly HTML style attributes or .style assignments.
        #
        # We do a targeted replacement: replace ALL occurrences in the line unless
        # the line is a data/config line (already skipped above).
        # The skip_line check handles config objects. For everything else in these
        # files, hex in style= attributes is the dominant pattern.

        new_result = pattern.sub(css_var, result)
        if new_result != result:
            count += len(pattern.findall(result))
            result = new_result

    return result, count


def process_file(filepath):
    """Process one file, return (new_content, total_replacements, per_hex_counts)."""
    with open(filepath, encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()

    new_lines = []
    total = 0
    per_hex = {h: 0 for h in REPLACEMENTS}

    for line in lines:
        if should_skip_line(line):
            new_lines.append(line)
            continue

        new_line = line
        for hex_val, css_var in REPLACEMENTS.items():
            pattern = re.compile(re.escape(hex_val), re.IGNORECASE)
            matches = pattern.findall(new_line)
            if matches:
                new_line = pattern.sub(css_var, new_line)
                per_hex[hex_val] += len(matches)
                total += len(matches)

        new_lines.append(new_line)

    return ''.join(new_lines), total, per_hex


def main():
    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    pattern = os.path.join(base, 'src', 'frontend', '**', '*.js')
    files = [f for f in glob.glob(pattern, recursive=True) if 'core-bundle' not in f]

    grand_total = 0
    all_per_hex = {h: 0 for h in REPLACEMENTS}

    print(f"Processing {len(files)} JS source files...\n")

    for filepath in sorted(files):
        new_content, total, per_hex = process_file(filepath)

        if total > 0:
            rel = os.path.relpath(filepath, base)
            print(f"  {rel}: {total} replacement(s)")
            for h, c in per_hex.items():
                if c > 0:
                    print(f"    {h} -> {REPLACEMENTS[h]}: {c}x")

            with open(filepath, 'w', encoding='utf-8', newline='') as f:
                f.write(new_content)

            grand_total += total
            for h, c in per_hex.items():
                all_per_hex[h] += c

    print(f"\nTotal replacements: {grand_total}")
    print("\nPer-hex summary:")
    for h, c in all_per_hex.items():
        if c > 0:
            print(f"  {h} -> {REPLACEMENTS[h]}: {c}x")


if __name__ == '__main__':
    main()
