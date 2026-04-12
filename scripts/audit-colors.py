import os, re, glob

src = r'C:\Users\Matt1\OneDrive\Desktop\vaultlister-3\src\frontend'
js_files = [f for f in glob.glob(src + r'\**\*.js', recursive=True)
            if 'core-bundle.js' not in f]

hex_re = re.compile(r'#[0-9a-fA-F]{3,6}\b')
var_re = re.compile(r'var\(--')

inline_style = []
style_prop   = []
css_text_lst = []
embedded_css = []

embedded_re = re.compile(r'<style[^>]*>.*?</style>', re.DOTALL | re.IGNORECASE)

for f in js_files:
    content = open(f, encoding='utf-8', errors='ignore').read()
    fname = os.path.relpath(f, src)
    lines = content.split('\n')

    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        if stripped.startswith('//') or stripped.startswith('*'):
            continue
        if not hex_re.search(line) or var_re.search(line):
            continue
        if re.search(r"style=['\"`]", line):
            inline_style.append((fname, i))
        elif re.search(r'\.style\.cssText\s*=', line):
            css_text_lst.append((fname, i))
        elif re.search(r'\.style\.\w+\s*=', line):
            style_prop.append((fname, i))

    for m in embedded_re.finditer(content):
        block = m.group()
        hex_hits = hex_re.findall(block)
        if hex_hits:
            line_no = content[:m.start()].count('\n') + 1
            embedded_css.append((fname, line_no, len(hex_hits), hex_hits[:4]))

total_embedded = sum(x[2] for x in embedded_css)

print(f'JS files scanned: {len(js_files)}')
print(f'Cat 1 - inline style= with hardcoded hex: {len(inline_style)}')
print(f'Cat 2 - .style.PROP = hex: {len(style_prop)}')
print(f'Cat 3 - .style.cssText hex: {len(css_text_lst)}')
print(f'Cat 4 - embedded <style> blocks: {len(embedded_css)} blocks, {total_embedded} hex values')
print(f'TOTAL lines/instances: {len(inline_style)+len(style_prop)+len(css_text_lst)+total_embedded}')
print()
print('Embedded <style> block locations:')
for f,l,c,ex in embedded_css:
    print(f'  {f}:{l}  ({c} hex values)  e.g. {ex}')
