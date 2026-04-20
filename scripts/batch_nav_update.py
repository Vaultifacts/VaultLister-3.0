#!/usr/bin/env python3
"""
batch_nav_update.py — VaultLister public site batch nav changes
Tasks:
  4A. Move Status Page from standalone nav link into product-updates dropdown
  4B. Add Learning to Resources dropdown (first item)
  4C. Add currency selector before lang-selector
  5.  Replace Reddit SVG with img tag in footer
  6.  Inject currency JS into pages that have currency-selector
"""
import os
import re
import glob

# Find all HTML files
base = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public')
html_files = []
for root, dirs, files in os.walk(base):
    for f in files:
        if f.endswith('.html'):
            html_files.append(os.path.join(root, f))

html_files.sort()
print(f"Found {len(html_files)} HTML files")

modified_count = 0
skipped_count = 0
skip_reasons = {}

CURRENCY_HTML = '''<div class="currency-selector">
    <button type="button" class="currency-btn" aria-label="Change currency" aria-expanded="false">
        <span id="current-currency-code">CAD</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
    </button>
    <div class="currency-dropdown" id="currency-dropdown">
        <button type="button" class="currency-option" data-currency="CAD" data-symbol="$">$ CAD</button>
        <button type="button" class="currency-option" data-currency="USD" data-symbol="$">$ USD</button>
        <button type="button" class="currency-option" data-currency="GBP" data-symbol="£">£ GBP</button>
        <button type="button" class="currency-option" data-currency="EUR" data-symbol="€">€ EUR</button>
        <button type="button" class="currency-option" data-currency="AUD" data-symbol="$">$ AUD</button>
    </div>
</div>'''

CURRENCY_JS = '''// Currency selector
(function() {
    var saved = localStorage.getItem('vl_currency') || 'CAD';
    var el = document.getElementById('current-currency-code');
    if (el) el.textContent = saved;
    document.querySelectorAll('.currency-option').forEach(function(btn) {
        if (btn.dataset.currency === saved) btn.classList.add('active');
        btn.addEventListener('click', function() {
            var c = this.dataset.currency;
            localStorage.setItem('vl_currency', c);
            document.querySelectorAll('.currency-option').forEach(function(b){ b.classList.remove('active'); });
            this.classList.add('active');
            var codeEl = document.getElementById('current-currency-code');
            if (codeEl) codeEl.textContent = c;
            var dd = document.getElementById('currency-dropdown');
            if (dd) dd.classList.remove('open');
        }.bind(this));
    });
    var btn = document.querySelector('.currency-btn');
    if (btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var dd = document.getElementById('currency-dropdown');
            dd.classList.toggle('open');
            btn.setAttribute('aria-expanded', dd.classList.contains('open'));
        });
    }
    document.addEventListener('click', function() {
        var dd = document.getElementById('currency-dropdown');
        if (dd) { dd.classList.remove('open'); }
        if (btn) btn.setAttribute('aria-expanded', 'false');
    });
})();'''

REDDIT_IMG = '<img src="/assets/logos/reddit/Reddit_Icon_FullColor.svg" width="22" height="22" alt="Reddit" style="display:block;">'

# Regex to match the Reddit SVG inside its anchor
REDDIT_SVG_PATTERN = re.compile(
    r'(<a\s[^>]*href="https://www\.reddit\.com/user/VaultLister/"[^>]*>)\s*<svg[^>]*>.*?</svg>\s*(</a>)',
    re.DOTALL
)

for filepath in html_files:
    with open(filepath, encoding='utf-8') as f:
        content = f.read()

    original = content
    changed = False
    file_skips = []

    # Skip files with no nav (404, 50x, offline, google verify, api-docs/index, er-diagram check)
    has_nav = 'lang-selector' in content or 'nav-link' in content
    if not has_nav:
        skipped_count += 1
        skip_reasons[filepath] = 'no nav'
        continue

    # ---- 4A. Move Status Page into product-updates dropdown ----
    # Desktop nav: remove standalone Status Page link
    # We need to match all 3 variants of the product-updates dropdown

    # Check if Status Page is already inside the product-updates dropdown div
    dropdown_content_pat = re.compile(
        r'<div[^>]*id="(?:product-updates-menu|dropdown-product-updates|dd-product-updates)"[^>]*>(.*?)</div>',
        re.DOTALL
    )
    status_already_in_dropdown = any(
        '/status.html' in m.group(1)
        for m in dropdown_content_pat.finditer(content)
    )

    if not status_already_in_dropdown:
        # Remove the standalone desktop nav link
        # Pattern: <a class="nav-link" href="/status.html">Status Page</a>
        # (with any whitespace/newlines before it on the line)
        new_content = re.sub(
            r'\n[ \t]*<a class="nav-link" href="/status\.html">Status Page</a>',
            '',
            content
        )
        if new_content != content:
            content = new_content
            changed = True

            # Now insert Status Page as menuitem into the product-updates dropdown
            # After the Roadmap menuitem
            # All 3 variants have: <a href="/roadmap-public.html" role="menuitem">Roadmap</a>
            # followed by closing </div>
            content = re.sub(
                r'(<a href="/roadmap-public\.html" role="menuitem">Roadmap</a>)(\s*</div>)',
                r'\1\n                <a href="/status.html" role="menuitem">Status Page</a>\2',
                content
            )

        # Mobile nav: remove standalone mobile Status Page link and add to mobile-product-updates-sub
        # Only applies to files that have mobile-nav-sub
        if 'mobile-product-updates-sub' in content:
            # Remove standalone mobile Status Page link
            new_content = re.sub(
                r'\n[ \t]*<a class="mobile-nav-item" href="/status\.html">Status Page</a>',
                '',
                content
            )
            if new_content != content:
                content = new_content
                changed = True

                # Add inside mobile-product-updates-sub after Roadmap
                content = re.sub(
                    r'(<a href="/roadmap-public\.html">Roadmap</a>)(\s*</div>\s*(?:</div>)?)',
                    lambda m: m.group(1) + '\n        <a href="/status.html">Status Page</a>' + m.group(2),
                    content
                )
    else:
        file_skips.append('4A:already-done')

    # ---- 4B. Add Learning to Resources dropdown ----
    learning_already_present = '/learning.html' in content

    if not learning_already_present:
        # Find the resources dropdown div content opening and insert Learning as first item
        # Patterns:
        # Type A: <div id="resources-menu" class="nav-dropdown-menu" role="menu">
        # Type B: <div class="nav-dropdown-menu" id="dropdown-resources" role="menu">
        # Type C: <div class="nav-dropdown-menu" id="dd-resources" role="menu">
        # Generic match: any div that has id containing "resources" and role="menu"

        def add_learning_to_resources(m):
            opening_tag = m.group(1)
            return opening_tag + '\n                <a href="/learning.html" role="menuitem">Learning</a>'

        new_content = re.sub(
            r'(<div[^>]*id="(?:resources-menu|dropdown-resources|dd-resources)"[^>]*>)',
            add_learning_to_resources,
            content
        )
        if new_content != content:
            content = new_content
            changed = True

        # Mobile resources sub
        if 'mobile-resources-sub' in content:
            new_content = re.sub(
                r'(<div class="mobile-nav-sub" id="mobile-resources-sub">\s*\n)',
                r'\1        <a href="/learning.html">Learning</a>\n',
                content
            )
            if new_content != content:
                content = new_content
                changed = True
    else:
        file_skips.append('4B:already-done')

    # ---- 4C. Add currency selector before lang-selector ----
    currency_already_present = 'currency-selector' in content

    if not currency_already_present:
        # Find <div class="lang-selector"> and insert currency-selector before it
        # The lang-selector may have leading whitespace
        new_content = re.sub(
            r'([ \t]*)(<div class="lang-selector">)',
            lambda m: m.group(1) + CURRENCY_HTML.replace('\n', '\n' + m.group(1)) + '\n' + m.group(1) + m.group(2),
            content
        )
        if new_content != content:
            content = new_content
            changed = True
    else:
        file_skips.append('4C:already-done')

    # ---- 5. Replace Reddit SVG with img tag ----
    reddit_already_img = 'Reddit_Icon_FullColor.svg' in content

    if not reddit_already_img:
        new_content = REDDIT_SVG_PATTERN.sub(
            lambda m: m.group(1) + REDDIT_IMG + m.group(2),
            content
        )
        if new_content != content:
            content = new_content
            changed = True
    else:
        file_skips.append('5:already-done')

    # ---- 6. Inject currency JS (only if currency-selector is now present) ----
    currency_js_already = 'vl_currency' in content

    if not currency_js_already and 'currency-selector' in content:
        # Find the LAST </script> tag in the body (not head)
        # Strategy: find the last occurrence of </script> in the file
        last_script_pos = content.rfind('</script>')
        if last_script_pos != -1:
            insert_text = '\n' + CURRENCY_JS + '\n'
            content = content[:last_script_pos] + insert_text + content[last_script_pos:]
            changed = True
    elif currency_js_already:
        file_skips.append('6:already-done')

    if changed:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        modified_count += 1
        rel = os.path.relpath(filepath, base)
        print(f"  MODIFIED: {rel}" + (f" (skipped: {', '.join(file_skips)})" if file_skips else ""))
    else:
        skipped_count += 1
        reason = ', '.join(file_skips) if file_skips else 'no matching patterns'
        skip_reasons[filepath] = reason

print(f"\nSummary: {modified_count} modified, {skipped_count} skipped")
print("\nSkipped files:")
for path, reason in skip_reasons.items():
    rel = os.path.relpath(path, base)
    print(f"  {rel}: {reason}")
