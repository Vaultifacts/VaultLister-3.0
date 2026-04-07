import re, glob

files = (
    glob.glob('src/frontend/pages/*.js') +
    glob.glob('src/frontend/handlers/*.js') +
    glob.glob('src/frontend/ui/*.js')
)

# Match literal $ followed by ${ (template expression), but NOT already prefixed with C
# In the file: `$${value}` renders as "$value" — fix to `C$${value}` renders as "C$value"
pattern = re.compile(r'(?<!C)\$\$\{')

total_changes = 0
changed_files = []

for f in files:
    if 'pages-inventory-catalog' in f:
        continue
    with open(f, 'r', encoding='utf-8') as fh:
        content = fh.read()
    matches = pattern.findall(content)
    if matches:
        new_content = pattern.sub(r'C$${', content)
        with open(f, 'w', encoding='utf-8', newline='') as fh:
            fh.write(new_content)
        total_changes += len(matches)
        changed_files.append((f, len(matches)))
        print(f"Fixed {len(matches)} instances in {f}")

print(f"\nTotal: {total_changes} instances fixed across {len(changed_files)} files")
