import re, glob

unmapped = [
    '#0078d4','#059669','#0891b2','#0c4a6e','#0ea5e9','#14b8a6','#166534',
    '#18181b','#1e40af','#3448c5','#4169e1','#4285f4','#635bff','#6366f1',
    '#7a5900','#7b2d8e','#7c3aed','#8b5cf6','#946800','#991b1b','#a855f7',
    '#ac1a2f','#cc785c','#db2777','#e5e5e5','#ea4335','#ea580c','#ec4899',
    '#ecfdf5','#f0f0f0','#fce7f3','#ff3b58','#ff5a5f','#ffcc02','#fff8e1'
]

src = 'src/frontend'
files = [f for f in glob.glob(src + '/**/*.js', recursive=True)
         if 'core-bundle.js' not in f]

hex_re = re.compile(r'(#[0-9a-fA-F]{3,8})\b')
style_inline_re = re.compile(r'style=["\`]([^"\`]+)["\`]', re.IGNORECASE)
style_prop_re = re.compile(r'\.style\.[a-zA-Z]+\s*=\s*["\']')

counts = {h: 0 for h in unmapped}
for f in files:
    content = open(f, encoding='utf-8', errors='ignore').read()
    # inline style=
    for m in style_inline_re.finditer(content):
        val = m.group(1).lower()
        for h in unmapped:
            counts[h] += val.count(h)
    # .style.PROP = 'hex'
    for m in style_prop_re.finditer(content):
        start = m.end()
        rest = content[start:start+12]
        hex_match = hex_re.match(rest)
        if hex_match:
            h = hex_match.group(1).lower()
            if h in counts:
                counts[h] += 1

found = [(h, c) for h, c in counts.items() if c > 0]
found.sort(key=lambda x: -x[1])
print('Unmapped hex still in style contexts:')
for h, c in found:
    print(f'  {h}: {c}x')
print(f'\nTotal unique: {len(found)}, total occurrences: {sum(c for _, c in found)}')
print('\nNot found (0 occurrences):')
for h, c in counts.items():
    if c == 0:
        print(f'  {h}')
