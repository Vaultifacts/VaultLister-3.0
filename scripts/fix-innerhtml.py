#!/usr/bin/env python3
import re, sys, os, glob

def find_string_end(s, start, quote):
    i = start + 1
    while i < len(s):
        if s[i] == chr(92): i += 2
        elif s[i] == quote: return i + 1
        else: i += 1
    return None

def find_template_end(s, start):
    stack = ["T"]
    i = start + 1
    while i < len(s) and stack:
        if stack[-1] == "T":
            c = s[i]
            if c == chr(92): i += 2
            elif c == chr(96):
                stack.pop(); i += 1
                if not stack: return i
            elif c == chr(36) and i+1 < len(s) and s[i+1] == chr(123):
                stack.append(("E",1)); i += 2
            else: i += 1
        else:
            depth = stack[-1][1]; c = s[i]
            if c == chr(92): i += 2
            elif c == chr(96): stack.append("T"); i += 1
            elif c in ('"', "'"): end = find_string_end(s,i,c); i = end if end else i+1
            elif c == chr(123): stack[-1] = ("E",depth+1); i += 1
            elif c == chr(125):
                if depth <= 1: stack.pop()
                else: stack[-1] = ("E",depth-1)
                i += 1
            else: i += 1
    return None

def find_expr_end(s, start):
    # +,-,*,/,%,?,  :,,,|,&,=,.
    CONT = set([43,45,42,47,37,63,58,44,124,38,61,46])
    depth = 0; i = start
    while i < len(s):
        c = s[i]
        if c in (chr(40), chr(91)): depth += 1; i += 1
        elif c in (chr(41), chr(93)):
            if depth == 0: break
            depth -= 1; i += 1
        elif c == chr(96): end = find_template_end(s,i); i = end if end else i+1
        elif c in ('"',"'"): end = find_string_end(s,i,c); i = end if end else i+1
        elif c == chr(59) and depth == 0: break
        elif c == chr(10) and depth == 0:
            seg = s[start:i].rstrip()
            if seg and ord(seg[-1]) in CONT: i += 1; continue
            nxt = i+1
            while nxt < len(s) and s[nxt] in (' ',chr(9)): nxt += 1
            if nxt < len(s) and ord(s[nxt]) in CONT: i += 1; continue
            break
        else: i += 1
    return i

IH = chr(105)+chr(110)+chr(110)+chr(101)+chr(114)+chr(72)+chr(84)+chr(77)+chr(76)
PATTERN = re.compile(r"\."+IH+r"\s*\+?=(?!=)\s*(?!sanitizeHTML\()")

def process(content):
    result = []; pos = 0; count = 0
    while pos < len(content):
        m = PATTERN.search(content, pos)
        if not m: result.append(content[pos:]); break
        ln_start = content.rfind(chr(10), 0, m.start()) + 1
        prefix = content[ln_start:m.start()]
        if chr(47)+chr(47) in prefix:
            result.append(content[pos:m.end()]); pos = m.end(); continue
        result.append(content[pos:m.end()]); vs = m.end()
        if vs >= len(content): pos = vs; break
        c = content[vs]
        if c == chr(96): ve = find_template_end(content, vs)
        elif c in ('"',"'"): ve = find_string_end(content, vs, c)
        else: ve = find_expr_end(content, vs)
        if ve is None or ve <= vs:
            result.append(content[vs:vs+1]); pos = vs+1; continue
        raw = content[vs:ve]; value = raw.rstrip()
        if not value: result.append(raw); pos = ve; continue
        result.append("sanitizeHTML("+value+")"); pos = vs+len(value); count += 1
    return "".join(result), count

def main():
    dry_run = "--dry-run" in sys.argv
    file_args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if file_args: files = file_args
    else:
        base = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),"src","frontend")
        files = glob.glob(os.path.join(base,"**","*.js"),recursive=True)
    total_c = 0; total_f = 0
    for path in sorted(files):
        try:
            with open(path,"r",encoding="utf-8") as f: content = f.read()
        except Exception as e: print(f"ERROR {path}: {e}",file=sys.stderr); continue
        new_content,n = process(content)
        if n > 0:
            print(f"  {path}: {n} change(s)"); total_c += n; total_f += 1
            if not dry_run:
                with open(path,"w",encoding="utf-8") as f: f.write(new_content)
    print(f"Total: {total_c} change(s) in {total_f} file(s)")
    if dry_run: print("(dry run)")

if __name__ == "__main__": main()
