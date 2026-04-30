"""
Apply label accessibility fixes based on scripts/label-fix-plan.csv.

Rule 1: Add for="<existing_id>" to <label class="form-label">
Rule 2: Add id="<new_id>" to input, add for="<new_id>" to label
Rule 3: Change <label class="form-label"> ... </label> to <p class="form-label"> ... </p>

Processes each file once, applying all fixes for that file.
"""
import re
import csv
from collections import defaultdict

PLAN_PATH = "scripts/label-fix-plan.csv"

def apply_fixes(filepath, file_rows):
    with open(filepath, encoding="utf-8") as f:
        content = f.read()

    original = content

    # Sort rows by label_line descending so character offsets stay valid
    # (we work backwards through the file)
    file_rows_sorted = sorted(file_rows, key=lambda r: int(r["label_line"]), reverse=True)

    # Build a line→char-offset index
    line_offsets = [0]
    for ch in content:
        if ch == '\n':
            line_offsets.append(line_offsets[-1] + 1)
        else:
            line_offsets[-1] += 1
    # Rebuild properly
    line_offsets = []
    pos = 0
    for line in content.split('\n'):
        line_offsets.append(pos)
        pos += len(line) + 1  # +1 for \n

    # Regexes
    LABEL_RE = re.compile(r'<label class="form-label"[^>]*>(.+?)</label>', re.DOTALL)
    INPUT_LIKE_RE = re.compile(r'<(input|select|textarea)\b([^>]*?)(/?>)', re.IGNORECASE | re.DOTALL)
    ID_ATTR_RE = re.compile(r'\bid="([^"]+)"')
    TYPE_ATTR_RE = re.compile(r'\btype="([^"]+)"', re.IGNORECASE)

    SKIP_TYPES = {'hidden', 'checkbox', 'radio'}
    SCOPE_END_RE = re.compile(r'<label\s+class="form-label"', re.IGNORECASE)

    changes = 0

    for row in file_rows_sorted:
        rule = row["rule"]
        label_line = int(row["label_line"])
        label_text_expected = row["label_text"]

        # Find the character offset of this line
        if label_line - 1 >= len(line_offsets):
            print(f"  SKIP: line {label_line} out of range")
            continue

        line_start = line_offsets[label_line - 1]
        # Search for the label on this line (±1 line tolerance for multiline labels)
        search_start = line_start
        search_end = min(line_start + 500, len(content))
        region = content[search_start:search_end]

        label_m = LABEL_RE.search(region)
        if not label_m:
            print(f"  SKIP: no label found near line {label_line} ({label_text_expected!r})")
            continue

        # Verify it matches expected text (strip HTML, check)
        found_text = re.sub(r'<[^>]+>', '', label_m.group(1)).strip()
        if found_text != label_text_expected:
            print(f"  WARN: line {label_line} expected {label_text_expected!r} got {found_text!r}")

        abs_label_start = search_start + label_m.start()
        abs_label_end = search_start + label_m.end()

        if rule == "3":
            # Convert <label class="form-label">...</label> → <p class="form-label">...</p>
            old_tag = content[abs_label_start:abs_label_end]
            new_tag = old_tag.replace('<label class="form-label"', '<p class="form-label"', 1)
            new_tag = new_tag.rstrip()
            if new_tag.endswith('</label>'):
                new_tag = new_tag[:-8] + '</p>'
            content = content[:abs_label_start] + new_tag + content[abs_label_end:]
            changes += 1

        elif rule == "1":
            # Add for="<existing_id>" to label opening tag
            existing_id = row["existing_id"]
            old_open = '<label class="form-label">'
            new_open = f'<label class="form-label" for="{existing_id}">'
            # Replace only this specific instance
            old_full = content[abs_label_start:abs_label_end]
            new_full = old_full.replace(old_open, new_open, 1)
            content = content[:abs_label_start] + new_full + content[abs_label_end:]
            changes += 1

        elif rule == "2":
            new_id = row["new_id"]
            input_line = int(row["input_line"]) if row["input_line"] else None

            # Add for= to label
            old_open = '<label class="form-label">'
            new_open = f'<label class="form-label" for="{new_id}">'
            old_full = content[abs_label_start:abs_label_end]
            new_full = old_full.replace(old_open, new_open, 1)
            content = content[:abs_label_start] + new_full + content[abs_label_end:]

            # Find the input to add id= to (search in scope after label)
            scope_start = abs_label_start + len(new_full)
            rest = content[scope_start:]
            scope_end_m = SCOPE_END_RE.search(rest)
            scope_len = min(scope_end_m.start() if scope_end_m else len(rest), 1200)
            scope = rest[:scope_len]

            # Find first primary input in scope
            for im in INPUT_LIKE_RE.finditer(scope):
                attrs = im.group(2)
                type_m = TYPE_ATTR_RE.search(attrs)
                tag_type = type_m.group(1).lower() if type_m else 'text'
                if tag_type in SKIP_TYPES:
                    continue
                if ID_ATTR_RE.search(attrs):
                    # Already has an id — shouldn't happen for Rule 2, skip
                    break
                # Insert id="new_id" as first attribute after tag name
                abs_input_start = scope_start + im.start()
                abs_input_end = scope_start + im.end()
                tag_name = im.group(1)
                old_input = content[abs_input_start:abs_input_end]
                # Insert id after the tag name
                new_input = re.sub(
                    r'(<(?:input|select|textarea)\b)',
                    rf'\1 id="{new_id}"',
                    old_input,
                    count=1,
                    flags=re.IGNORECASE
                )
                content = content[:abs_input_start] + new_input + content[abs_input_end:]
                changes += 1
                break
            else:
                # Label got for= but no input found — still count label change
                changes += 1

    return content, changes


def main():
    with open(PLAN_PATH, encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    # Group by file
    by_file = defaultdict(list)
    for row in rows:
        by_file[row["file"]].append(row)

    total_changes = 0
    for filepath, file_rows in sorted(by_file.items()):
        r1 = sum(1 for r in file_rows if r["rule"] == "1")
        r2 = sum(1 for r in file_rows if r["rule"] == "2")
        r3 = sum(1 for r in file_rows if r["rule"] == "3")
        print(f"\nProcessing {filepath}  (R1={r1} R2={r2} R3={r3})")
        new_content, changes = apply_fixes(filepath, file_rows)
        with open(filepath, "w", encoding="utf-8", newline='') as f:
            f.write(new_content)
        print(f"  {changes} changes written")
        total_changes += changes

    print(f"\nTotal changes: {total_changes}")


if __name__ == "__main__":
    main()
