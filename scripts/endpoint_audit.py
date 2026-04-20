import re
import os

ROUTES_DIR = r"C:/Users/Matt1/OneDrive/Desktop/vaultlister-3/src/backend/routes"
FEATURE_DOC = r"C:/Users/Matt1/OneDrive/Desktop/vaultlister-3/docs/FEATURE_INVENTORY.md"
SERVER_JS   = r"C:/Users/Matt1/OneDrive/Desktop/vaultlister-3/src/backend/server.js"

# ===========================================================
# STEP 1: Build prefix->filename map from server.js
# ===========================================================

import_map = {}  # routerVarName -> filename
with open(SERVER_JS, encoding='utf-8') as f:
    server_text = f.read()

for m in re.finditer(r"import\s*\{([^}]+)\}\s*from\s*['\"]\.\/(?:routes|services)\/([a-zA-Z0-9_-]+)\.js['\"]", server_text):
    names = [n.strip() for n in m.group(1).split(',')]
    fname = m.group(2) + '.js'
    for name in names:
        if 'Router' in name or 'router' in name:
            import_map[name] = fname

prefix_map = {}  # prefix -> filename
for m in re.finditer(r"'(/api/[^']+)'\s*:\s*(\w+)\b", server_text):
    prefix = m.group(1)
    var = m.group(2)
    if var in import_map:
        prefix_map[prefix] = import_map[var]

print(f"Prefix->file map: {len(prefix_map)} entries")

# ===========================================================
# STEP 2: Parse FEATURE_INVENTORY.md for doc endpoints
# ===========================================================
doc_endpoints = []  # list of (filename, method, full_path)
current_file = None

with open(FEATURE_DOC, encoding='utf-8') as f:
    lines = f.readlines()

for line in lines:
    m = re.match(r'^####\s+`/src/backend/routes/([a-zA-Z0-9_-]+\.js)`', line.strip())
    if m:
        current_file = m.group(1)
        continue

    if current_file is None:
        continue

    # Table row: | METHOD | /api/path | ... |
    m = re.match(r'^\|\s*(GET|POST|PUT|DELETE|PATCH)\s*\|\s*`?(/api/[^\s|`]+)`?\s*\|', line.strip())
    if m:
        method = m.group(1)
        path = m.group(2).rstrip('/')
        doc_endpoints.append((current_file, method, path))

print(f"Doc endpoints parsed: {len(doc_endpoints)}")

# ===========================================================
# STEP 3: Extract endpoints from route file COMMENTS
# Pattern: // METHOD /api/full/path - description
# This is the authoritative signal for both literal and parameterized routes.
# ===========================================================

file_to_prefixes = {}
for prefix, fname in prefix_map.items():
    file_to_prefixes.setdefault(fname, []).append(prefix)


def extract_endpoints_from_comments(filepath):
    """Extract (method, full_path) from inline route comments like:
       // GET /api/inventory/:id - description
    """
    results = []
    try:
        with open(filepath, encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return results

    # Match: //[optional space] METHOD /api/path - optional description
    # Path ends at whitespace, or " -" (description separator), or end of line
    for m in re.finditer(
        r'//\s*(GET|POST|PUT|DELETE|PATCH)\s+(/api/\S+?)(?:\s+-|\s*$)',
        content,
        re.MULTILINE
    ):
        method = m.group(1)
        path = m.group(2).rstrip('/')
        results.append((method, path))

    return results


code_endpoints = []  # (filename, method, full_path)

for fname in sorted(os.listdir(ROUTES_DIR)):
    if not fname.endswith('.js'):
        continue
    fpath = os.path.join(ROUTES_DIR, fname)

    raw_endpoints = extract_endpoints_from_comments(fpath)

    for method, full_path in raw_endpoints:
        code_endpoints.append((fname, method, full_path))

print(f"Code endpoints extracted (from comments): {len(code_endpoints)}")

# ===========================================================
# STEP 4: Build sets and compare
# ===========================================================

def normalize(fname, method, path):
    return (fname, method.upper(), path.rstrip('/') or '/')


doc_set = {}
for entry in doc_endpoints:
    key = normalize(*entry)
    doc_set[key] = entry

code_set = {}
for entry in code_endpoints:
    key = normalize(*entry)
    code_set[key] = entry

# Phantoms: doc entries not found in code
phantoms = []
for key, entry in doc_set.items():
    if key not in code_set:
        phantoms.append(entry)

# Missing: code entries not in doc
missing = []
for key, entry in code_set.items():
    if key not in doc_set:
        missing.append(entry)

matches = len(doc_set) - len(phantoms)

# ===========================================================
# STEP 5: Report
# ===========================================================
print()
print("=" * 66)
print(" ENDPOINT AUDIT RESULTS")
print("=" * 66)
print(f" Total doc endpoints:   {len(doc_endpoints)}")
print(f" Total code endpoints:  {len(code_endpoints)}")
print(f" Unique doc entries:    {len(doc_set)}")
print(f" Unique code entries:   {len(code_set)}")
print(f" Matches (doc n code):  {matches}")
print(f" Phantoms (doc-code):   {len(phantoms)}")
print(f" Missing (code-doc):    {len(missing)}")
print("=" * 66)

if phantoms:
    print(f"\n--- PHANTOMS: {len(phantoms)} (in doc, NOT found in code) ---")
    phantoms.sort(key=lambda x: (x[0], x[1], x[2]))
    for fname, method, path in phantoms:
        print(f"  {method:6s}  {path}  [{fname}]")

if missing:
    print(f"\n--- MISSING FROM DOC: {len(missing)} (in code, not in doc) ---")
    missing.sort(key=lambda x: (x[0], x[1], x[2]))
    for fname, method, path in missing:
        print(f"  {method:6s}  {path}  [{fname}]")

print()
# Show any route files with no prefix (unregistered)
registered_files = set(prefix_map.values())
all_route_files = [f for f in os.listdir(ROUTES_DIR) if f.endswith('.js')]
unregistered = [f for f in all_route_files if f not in registered_files]
if unregistered:
    print(f"Route files with NO registered prefix ({len(unregistered)}):")
    for f in sorted(unregistered):
        print(f"  {f}")
