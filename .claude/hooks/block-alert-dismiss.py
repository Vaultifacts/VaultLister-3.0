#!/usr/bin/env python3
"""
block-alert-dismiss.py — PreToolUse hook (Bash)
Blocks any Bash command that would dismiss a GitHub code scanning alert.
Alerts should close automatically when fixed in code — manual dismissal hides real vulnerabilities.

Blocks commands containing both "code-scanning/alerts" and "dismiss" in any form.

Hook config in settings.local.json:
  "PreToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command",
    "command": "python C:/Users/Matt1/OneDrive/Desktop/vaultlister-3/.claude/hooks/block-alert-dismiss.py" }] }]
"""
import sys
import json

def main():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, EOFError):
        sys.exit(0)

    if data.get("tool_name") != "Bash":
        sys.exit(0)

    cmd = data.get("tool_input", {}).get("command", "")
    if not cmd:
        sys.exit(0)

    cmd_lower = cmd.lower()
    # Only block actual gh api PATCH calls that set state=dismissed.
    # Don't block commit messages, grep, echo, or other commands that mention these strings.
    is_gh_api_call = "gh api" in cmd_lower
    has_patch = "-x patch" in cmd_lower or "--method patch" in cmd_lower
    has_alert_path = "code-scanning/alerts" in cmd_lower
    has_dismiss = "state=dismissed" in cmd_lower or "-f state=dismiss" in cmd_lower
    if is_gh_api_call and has_patch and has_alert_path and has_dismiss:
        print(
            "BLOCKED: block-alert-dismiss.py — dismissing code scanning alerts is prohibited.\n"
            "Alerts close automatically when the underlying code is fixed and the scanner re-runs.\n"
            "Manual dismissal hides real vulnerabilities from the security dashboard.\n"
            "To fix: address the finding in code, then push — the scanner will mark it fixed.",
            file=sys.stderr
        )
        sys.exit(2)

    sys.exit(0)

if __name__ == "__main__":
    main()
