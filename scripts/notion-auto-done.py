#!/usr/bin/env python3
"""
notion-auto-done.py — Parse Notion-Done: <id> trailers from the most recent
commit message and mark those Notion pages as Done via the Notion API.

Usage: called automatically by .husky/post-commit
       NOTION_TOKEN (or NOTION_INTEGRATION_TOKEN) must be set in the environment

Trailer format (one or more lines anywhere in the commit message):
    Notion-Done: abc123def456...  (32 hex chars, with or without dashes)

Exits 0 always — never blocks the commit workflow.
"""
import json
import os
import re
import subprocess
import sys
import urllib.error  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected
import urllib.request  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected

NOTION_VERSION = "2022-06-28"
# Support both token names used across this project
TOKEN = os.environ.get("NOTION_TOKEN") or os.environ.get("NOTION_INTEGRATION_TOKEN", "")

# 32 hex chars, optionally hyphenated in the standard UUID pattern
_HEX32 = re.compile(
    r"[0-9a-fA-F]{8}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{4}-?[0-9a-fA-F]{12}"
    r"|[0-9a-fA-F]{32}"
)
_TRAILER = re.compile(r"^Notion-Done:\s*(.+)", re.MULTILINE)


def get_commit_message():
    try:
        result = subprocess.run(
            ["git", "log", "-1", "--pretty=%B"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
        return result.stdout if result.returncode == 0 else ""
    except Exception:
        return ""


def extract_ids(message):
    ids = []
    for match in _TRAILER.finditer(message):
        raw = match.group(1).strip()
        hex_match = _HEX32.search(raw)
        if hex_match:
            # Normalise: strip dashes, then reformat as UUID without dashes
            clean = hex_match.group(0).replace("-", "")
            ids.append(clean)
    return ids


def get_page_title(page_id, headers):
    """Retrieve page title for a friendlier confirmation message."""
    url = f"https://api.notion.com/v1/pages/{page_id}"
    req = urllib.request.Request(url, headers=headers, method="GET")  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
            data = json.loads(resp.read().decode("utf-8"))
            props = data.get("properties", {})
            # Try common title property names
            for key in ("Name", "Title", "title"):
                prop = props.get(key)
                if prop and prop.get("type") == "title":
                    title_parts = prop.get("title", [])
                    if title_parts:
                        return "".join(t.get("plain_text", "") for t in title_parts)
    except Exception:
        pass
    return page_id


def mark_done(page_id, headers):
    """PATCH the page status to Done. Returns (success, title_or_error)."""
    url = f"https://api.notion.com/v1/pages/{page_id}"
    payload = json.dumps(
        {"properties": {"Status": {"select": {"name": "Done"}}}}
    ).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers=headers, method="PATCH")  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected  # nosemgrep: python.lang.security.audit.insecure-transport.urllib.insecure-request-object.insecure-request-object
            resp.read()  # consume body
        title = get_page_title(page_id, headers)
        return True, title
    except urllib.error.HTTPError as exc:  # nosemgrep: python.lang.security.audit.dynamic-urllib-use-detected.dynamic-urllib-use-detected
        body = ""
        try:
            body = exc.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        return False, f"HTTP {exc.code}: {body[:200]}"
    except Exception as exc:
        return False, str(exc)


def main():
    if not TOKEN:
        # Silently exit — token not configured
        sys.exit(0)

    message = get_commit_message()
    if not message:
        sys.exit(0)

    ids = extract_ids(message)
    if not ids:
        sys.exit(0)

    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }

    for page_id in ids:
        success, info = mark_done(page_id, headers)
        if success:
            print(f"✓ Marked Done: {info}")
        else:
            print(f"✗ Failed to mark Done ({page_id}): {info}", file=sys.stderr)

    sys.exit(0)


if __name__ == "__main__":
    main()
