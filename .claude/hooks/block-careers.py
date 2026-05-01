#!/usr/bin/env python3
"""Block any Write/Edit that creates or recreates careers content."""
import json, sys, re

data = json.load(sys.stdin)
tool = data.get("tool_name", "")
inp = data.get("tool_input", {})

PATTERNS = [
    r"careers\.html",
    r"careers@vaultlister",
    r"Careers at VaultLister",
    r"/careers\.html",
]

content = ""
if tool == "Write":
    content = inp.get("file_path", "") + "\n" + inp.get("content", "")
elif tool == "Edit":
    content = inp.get("file_path", "") + "\n" + inp.get("new_string", "")

for pat in PATTERNS:
    if re.search(pat, content, re.IGNORECASE):
        print(json.dumps({
            "decision": "block",
            "reason": f"BLOCKED: careers content is permanently removed from VaultLister. Pattern matched: '{pat}'. See CLAUDE.md 'Things You Must NEVER Do'."
        }))
        sys.exit(0)

sys.exit(0)
