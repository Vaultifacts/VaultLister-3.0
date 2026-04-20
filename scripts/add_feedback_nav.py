"""
Add "Feedback & Support" dropdown to all 41 public HTML nav bars.
- Moves Help Center and FAQs out of Resources
- Moves Contact Us out of standalone nav link
- Adds new Feedback & Support dropdown with: Help Center, FAQs,
  Request a Feature, Report a Bug, Contact Us
- Also updates mobile nav accordingly
"""
import glob, os

SKIP = {
    'public/404.html', 'public/50x.html',
    'public/offline.html', 'public/google00d8bfcd604b6ef6.html'
}

# ── Feedback dropdown HTML (3 nav attribute variants) ──────────────────────

FEEDBACK_A = """\
        <div class="nav-dropdown">
            <button type="button" class="nav-link nav-dropdown-btn" data-dropdown="feedback-menu" aria-haspopup="true" aria-expanded="false">Feedback &amp; Support &#9662;</button>
            <div id="feedback-menu" class="nav-dropdown-menu" role="menu">
                <a href="/help.html" role="menuitem">Help Center</a>
                <a href="/faq.html" role="menuitem">FAQs</a>
                <a href="/request-feature.html" role="menuitem">Request a Feature</a>
                <a href="/contact.html" role="menuitem">Report a Bug</a>
                <a href="/contact.html" role="menuitem">Contact Us</a>
            </div>
        </div>
"""

FEEDBACK_B = """\
        <div class="nav-dropdown">
            <button class="nav-link nav-dropdown-btn" data-target="dd-feedback" aria-haspopup="true" aria-expanded="false">Feedback &amp; Support &#9662;</button>
            <div class="nav-dropdown-menu" id="dd-feedback" role="menu">
                <a href="/help.html" role="menuitem">Help Center</a>
                <a href="/faq.html" role="menuitem">FAQs</a>
                <a href="/request-feature.html" role="menuitem">Request a Feature</a>
                <a href="/contact.html" role="menuitem">Report a Bug</a>
                <a href="/contact.html" role="menuitem">Contact Us</a>
            </div>
        </div>
"""

FEEDBACK_C = """\
        <div class="nav-dropdown">
            <button class="nav-link nav-dropdown-btn" data-target="dropdown-feedback" aria-haspopup="true" aria-expanded="false">Feedback &amp; Support &#9662;</button>
            <div class="nav-dropdown-menu" id="dropdown-feedback" role="menu">
                <a href="/help.html" role="menuitem">Help Center</a>
                <a href="/faq.html" role="menuitem">FAQs</a>
                <a href="/request-feature.html" role="menuitem">Request a Feature</a>
                <a href="/contact.html" role="menuitem">Report a Bug</a>
                <a href="/contact.html" role="menuitem">Contact Us</a>
            </div>
        </div>
"""

# ── Mobile Feedback section ────────────────────────────────────────────────

MOBILE_FEEDBACK = """\
    <button type="button" class="mobile-nav-section-btn" data-mobile-section="mobile-feedback-sub" aria-expanded="false">Feedback &amp; Support</button>
    <div class="mobile-nav-sub" id="mobile-feedback-sub">
        <a href="/help.html">Help Center</a>
        <a href="/faq.html">FAQs</a>
        <a href="/request-feature.html">Request a Feature</a>
        <a href="/contact.html">Report a Bug</a>
        <a href="/contact.html">Contact Us</a>
    </div>
"""

# ── Status & Updates anchors (insert feedback dropdown before these) ───────

STATUS_A = '        <div class="nav-dropdown">\n            <button type="button" class="nav-link nav-dropdown-btn" data-dropdown="product-updates-menu"'
STATUS_B = '        <div class="nav-dropdown">\n            <button class="nav-link nav-dropdown-btn" data-target="dd-product-updates"'
STATUS_C = '        <div class="nav-dropdown">\n            <button class="nav-link nav-dropdown-btn" data-target="dropdown-product-updates"'
MOBILE_STATUS = '    <button type="button" class="mobile-nav-section-btn" data-mobile-section="mobile-product-updates-sub"'

files = glob.glob('public/**/*.html', recursive=True)
updated = []

for filepath in sorted(files):
    norm = filepath.replace('\\', '/')
    if norm in SKIP:
        continue

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Skip if no nav or already updated
    if 'nav-dropdown-btn' not in content:
        continue
    if 'feedback-menu' in content or 'dd-feedback' in content or 'dropdown-feedback' in content:
        print(f'  SKIP (already updated): {filepath}')
        continue

    original = content

    # ── Desktop: remove Help Center + FAQs from Resources ──────────────────
    content = content.replace(
        '                <a href="/help.html" role="menuitem">Help Center</a>\n', '')
    content = content.replace(
        '                <a href="/faq.html" role="menuitem">FAQs</a>\n', '')

    # ── Desktop: remove standalone Contact Us ──────────────────────────────
    content = content.replace(
        '        <a class="nav-link" href="/contact.html">Contact Us</a>\n', '')

    # ── Desktop: insert Feedback dropdown before Status & Updates ──────────
    if STATUS_A in content:
        content = content.replace(STATUS_A, FEEDBACK_A + STATUS_A, 1)
    elif STATUS_B in content:
        content = content.replace(STATUS_B, FEEDBACK_B + STATUS_B, 1)
    elif STATUS_C in content:
        content = content.replace(STATUS_C, FEEDBACK_C + STATUS_C, 1)

    # ── Mobile: remove Help Center + FAQs from Resources ───────────────────
    content = content.replace('        <a href="/help.html">Help Center</a>\n', '')
    content = content.replace('        <a href="/faq.html">FAQs</a>\n', '')

    # ── Mobile: remove standalone Contact Us ───────────────────────────────
    content = content.replace(
        '    <a class="mobile-nav-item" href="/contact.html">Contact Us</a>\n', '')

    # ── Mobile: insert Feedback section before Status & Updates ────────────
    if MOBILE_STATUS in content:
        content = content.replace(MOBILE_STATUS, MOBILE_FEEDBACK + MOBILE_STATUS, 1)

    if content != original:
        with open(filepath, 'w', encoding='utf-8', newline='\n') as f:
            f.write(content)
        updated.append(filepath)
        print(f'  OK: {filepath}')
    else:
        print(f'  NO CHANGE: {filepath}')

print(f'\nDone: {len(updated)} files updated')
