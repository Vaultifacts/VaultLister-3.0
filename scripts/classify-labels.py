"""
Classify unassociated <label class="form-label"> elements and produce a fix plan.
Outputs: scripts/label-fix-plan.csv

Rules:
  1 = label → primary input WITH id in scope → add for= to label
  2 = label → primary input WITHOUT id in scope → add id to input + for= to label
  3 = section heading: no primary input in scope → convert to <p>

"Primary input" excludes type=checkbox, type=radio, type=hidden.
"Scope" = text from end of </label> to next <label class="form-label" or 600 chars.
"""
import re
import csv

FILES = [
    ("src/frontend/handlers/handlers-sales-orders.js", "hso"),
    ("src/frontend/handlers/handlers-settings-account.js", "hsa"),
    ("src/frontend/handlers/handlers-inventory-catalog.js", "hic"),
]

LABEL_RE = re.compile(r'<label class="form-label"[^>]*>(.+?)</label>', re.DOTALL)
LABEL_WITH_FOR_RE = re.compile(r'<label class="form-label"\s+for=')
# Matches input/select/textarea tags including multiline (non-greedy up to >)
INPUT_RE = re.compile(r'<(input|select|textarea)\b([\s\S]*?)(?:/>|>(?!</textarea>))', re.IGNORECASE)
TEXTAREA_RE = re.compile(r'<textarea\b([\s\S]*?)>', re.IGNORECASE)
ID_ATTR_RE = re.compile(r'\bid="([^"]+)"')
TYPE_ATTR_RE = re.compile(r'\btype="([^"]+)"', re.IGNORECASE)
# Stop scope at next form-label
SCOPE_END_RE = re.compile(r'<label\s+class="form-label"', re.IGNORECASE)

SKIP_TYPES = {'hidden', 'checkbox', 'radio'}

def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s]+', '-', text.strip())
    text = re.sub(r'-+', '-', text)
    return text[:40].rstrip('-')

def char_offset_to_line(content, offset):
    """Return 1-based line number for a character offset in content."""
    return content[:offset].count('\n') + 1

def find_primary_input_in_scope(scope_text, base_offset, content):
    """
    Search scope_text for the first primary <input|select|textarea>.
    Returns (line_number_1based, full_tag, existing_id_or_None) or None.
    """
    for m in INPUT_RE.finditer(scope_text):
        tag_name = m.group(1).lower()
        attrs = m.group(2)
        type_m = TYPE_ATTR_RE.search(attrs)
        tag_type = type_m.group(1).lower() if type_m else ('text' if tag_name == 'input' else tag_name)
        if tag_type in SKIP_TYPES:
            continue
        id_m = ID_ATTR_RE.search(attrs)
        line_no = char_offset_to_line(content, base_offset + m.start())
        return (line_no, m.group(0), id_m.group(1) if id_m else None)
    return None

def process_file(filepath, prefix):
    with open(filepath, encoding="utf-8") as f:
        content = f.read()

    lines = content.splitlines()

    used_ids = set()
    for m in ID_ATTR_RE.finditer(content):
        used_ids.add(m.group(1))

    rows = []
    for m in LABEL_RE.finditer(content):
        label_start = m.start()
        label_end_pos = m.end()
        label_text = m.group(1).strip()

        # Skip if this label already has for=
        if LABEL_WITH_FOR_RE.search(m.group(0)):
            continue

        label_line = char_offset_to_line(content, label_start)

        # Scope: from end of this label to next form-label or +600 chars
        rest = content[label_end_pos:]
        scope_end_m = SCOPE_END_RE.search(rest)
        scope_len = min(scope_end_m.start() if scope_end_m else len(rest), 1200)
        scope_text = rest[:scope_len]

        hit = find_primary_input_in_scope(scope_text, label_end_pos, content)

        if hit is None:
            rows.append({
                "file": filepath, "prefix": prefix,
                "label_line": label_line, "rule": "3",
                "label_text": label_text,
                "input_line": "", "existing_id": "", "new_id": "",
            })
        else:
            input_line, full_tag, existing_id = hit
            if existing_id:
                rows.append({
                    "file": filepath, "prefix": prefix,
                    "label_line": label_line, "rule": "1",
                    "label_text": label_text,
                    "input_line": input_line,
                    "existing_id": existing_id, "new_id": "",
                })
            else:
                slug = slugify(label_text)
                candidate = f"{prefix}-{slug}"
                counter = 2
                while candidate in used_ids:
                    candidate = f"{prefix}-{slug}-{counter}"
                    counter += 1
                used_ids.add(candidate)
                rows.append({
                    "file": filepath, "prefix": prefix,
                    "label_line": label_line, "rule": "2",
                    "label_text": label_text,
                    "input_line": input_line,
                    "existing_id": "", "new_id": candidate,
                })

    return rows

all_rows = []
for filepath, prefix in FILES:
    all_rows.extend(process_file(filepath, prefix))

out_path = "scripts/label-fix-plan.csv"
with open(out_path, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=["file", "prefix", "label_line", "rule", "label_text", "input_line", "existing_id", "new_id"])
    writer.writeheader()
    writer.writerows(all_rows)

r1 = sum(1 for r in all_rows if r["rule"] == "1")
r2 = sum(1 for r in all_rows if r["rule"] == "2")
r3 = sum(1 for r in all_rows if r["rule"] == "3")
print(f"Total: {len(all_rows)}  Rule1={r1}  Rule2={r2}  Rule3={r3}")
print(f"Plan written to {out_path}")
