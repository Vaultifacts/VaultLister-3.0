#!/usr/bin/env python3
"""Batch a11y fixes for VaultLister public HTML pages."""
import os
import re
import sys

PUBLIC_DIR = os.path.join(os.path.dirname(__file__), '..', 'public')


def fix_currency_dropdown(html):
    """Add role=listbox and aria-label to currency-dropdown div."""
    # currency-btn: add aria-label if missing
    html = re.sub(
        r'(<button\s[^>]*class="currency-btn"[^>]*)(?!\s*aria-label)([^>]*>)',
        lambda m: (
            m.group(1) + ' aria-label="Change currency"' + m.group(2)
            if 'aria-label' not in m.group(0) else m.group(0)
        ),
        html,
    )
    # currency-dropdown div: add role=listbox + aria-label
    html = re.sub(
        r'(<div\s[^>]*class="currency-dropdown"[^>]*)(?!\s*role)([^>]*>)',
        lambda m: (
            m.group(1) + ' role="listbox" aria-label="Select currency"' + m.group(2)
            if 'role=' not in m.group(0) else m.group(0)
        ),
        html,
    )
    # currency-option buttons: add role=option
    html = re.sub(
        r'(<button\s[^>]*class="currency-option"[^>]*)(?!\s*role)([^>]*>)',
        lambda m: (
            m.group(1) + ' role="option"' + m.group(2)
            if 'role=' not in m.group(0) else m.group(0)
        ),
        html,
    )
    return html


def fix_lang_dropdown(html):
    """Add role=listbox and aria-label to lang-dropdown div."""
    # lang-btn: add aria-label if missing
    html = re.sub(
        r'(<button\s[^>]*class="lang-btn"[^>]*)(?!\s*aria-label)([^>]*>)',
        lambda m: (
            m.group(1) + ' aria-label="Change language"' + m.group(2)
            if 'aria-label' not in m.group(0) else m.group(0)
        ),
        html,
    )
    # lang-dropdown div: add role=listbox + aria-label
    html = re.sub(
        r'(<div\s[^>]*class="lang-dropdown"[^>]*)(?!\s*role)([^>]*>)',
        lambda m: (
            m.group(1) + ' role="listbox" aria-label="Select language"' + m.group(2)
            if 'role=' not in m.group(0) else m.group(0)
        ),
        html,
    )
    # lang-option buttons: add role=option
    html = re.sub(
        r'(<button\s[^>]*class="lang-option"[^>]*)(?!\s*role)([^>]*>)',
        lambda m: (
            m.group(1) + ' role="option"' + m.group(2)
            if 'role=' not in m.group(0) else m.group(0)
        ),
        html,
    )
    return html


def fix_mobile_nav_hamburger(html):
    """Ensure hamburger button has aria-controls if missing."""
    # Add aria-controls="mobile-nav-drawer" to hamburger if missing
    html = re.sub(
        r'(<button\s[^>]*class="nav-hamburger"[^>]*)(?!\s*aria-controls)([^>]*>)',
        lambda m: (
            m.group(1) + ' aria-controls="mobile-nav-drawer"' + m.group(2)
            if 'aria-controls' not in m.group(0) else m.group(0)
        ),
        html,
    )
    return html


def fix_component_dots(html):
    """Add aria-hidden to purely decorative status dots."""
    html = re.sub(
        r'(<div\s[^>]*class="(?:component-dot|pulse-dot|release-dot)[^"]*"[^>]*)(?!\s*aria-hidden)([^>]*>)',
        lambda m: (
            m.group(1) + ' aria-hidden="true"' + m.group(2)
            if 'aria-hidden' not in m.group(0) else m.group(0)
        ),
        html,
    )
    return html


def fix_footer_nav(html):
    """Wrap footer link columns in a nav with aria-label if not already wrapped."""
    # If footer has a footer-cols div but no inner nav for footer links, add nav wrap
    # Only add if footer-inner contains footer-cols but no <nav>
    if '<footer' in html and 'footer-cols' in html:
        # Check if footer already has a nav inside footer-inner
        footer_match = re.search(r'<footer[^>]*>.*?</footer>', html, re.DOTALL)
        if footer_match:
            footer_content = footer_match.group(0)
            # If there's a footer-inner div but no nav inside it, wrap footer-cols in nav
            if 'footer-inner' in footer_content and '<nav' not in footer_content:
                html = re.sub(
                    r'(<div class="footer-cols">)',
                    '<nav aria-label="Footer navigation"><div class="footer-cols">',
                    html,
                )
                html = re.sub(
                    r'(</div>\s*<div class="footer-bottom">)',
                    '</div></nav>\n                <div class="footer-bottom">',
                    html,
                )
    return html


def fix_search_input_label(html):
    """Fix changelog search input label wrapping — <label> should have for= attribute."""
    # The changelog uses <label class="search-shell"> wrapping the input directly.
    # That's valid implicit association. No fix needed for that pattern.
    # But if there are standalone labels without for=, fix them.
    return html


def fix_badge_aria(html):
    """Add aria-label to badge spans to improve screen reader output in change-list."""
    # The badge text is already read by screen readers as part of li text.
    # BrowserStack may flag that badge text is not distinguished.
    # Add visually-hidden separator hint: no change needed since text is inline.
    return html


def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        original = f.read()

    html = original
    html = fix_currency_dropdown(html)
    html = fix_lang_dropdown(html)
    html = fix_mobile_nav_hamburger(html)
    html = fix_component_dots(html)
    html = fix_footer_nav(html)

    if html != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(html)
        return True
    return False


def main():
    changed = []
    unchanged = []

    for root, dirs, files in os.walk(PUBLIC_DIR):
        # Skip non-html dirs
        dirs[:] = [d for d in dirs if d not in ('assets', 'fonts', 'uploads', 'styles', 'api-docs')]
        for filename in files:
            if not filename.endswith('.html'):
                continue
            filepath = os.path.join(root, filename)
            if process_file(filepath):
                rel = os.path.relpath(filepath, PUBLIC_DIR)
                changed.append(rel)
            else:
                rel = os.path.relpath(filepath, PUBLIC_DIR)
                unchanged.append(rel)

    print(f'Modified: {len(changed)} files')
    for f in sorted(changed):
        print(f'  CHANGED: {f}')
    print(f'Unchanged: {len(unchanged)} files')


if __name__ == '__main__':
    main()
