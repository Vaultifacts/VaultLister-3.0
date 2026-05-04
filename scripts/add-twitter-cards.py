import re, os

base = 'C:/Users/Matt1/OneDrive/Desktop/vaultlister-3/public'
files = [
    'about.html','affiliate.html','ai-info.html','api-changelog.html','api-docs.html',
    'changelog.html','contact.html','cookies.html','documentation.html','faq.html',
    'glossary.html','help.html','learning.html','platforms.html','pricing.html',
    'privacy.html','quickstart.html','rate-limits.html','request-feature.html',
    'roadmap-public.html','schema.html','status.html','terms.html',
    'blog/depop-y2k-vintage-what-sells.html','blog/how-to-cross-list-50-items.html',
    'blog/index.html','blog/mercari-trading-cards-sell-fast.html',
    'blog/poshmark-closet-sharing-2026.html','blog/using-ai-for-poshmark-listings.html',
    'blog/whatnot-live-selling-beginners.html'
]

image = 'https://vaultlister.com/assets/logo/lockups/horizontal-2048.png'
count = 0
desc_re = re.compile(r'<meta\s+name=["\x27]description["\x27]\s+content=["\x27]([^"\x27]+)["\x27]')

for fname in files:
    path = os.path.join(base, fname)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    m = re.search(r'<title>([^<]+)</title>', content)
    title = m.group(1).strip() if m else 'VaultLister'

    m = desc_re.search(content)
    desc = m.group(1).strip() if m else title

    nl = chr(10)
    twitter_block = (
        f'        <meta name="twitter:card" content="summary_large_image">{nl}'
        f'        <meta name="twitter:title" content="{title}">{nl}'
        f'        <meta name="twitter:description" content="{desc}">{nl}'
        f'        <meta name="twitter:image" content="{image}">{nl}'
    )

    if '<link rel="canonical"' in content:
        new = content.replace('<link rel="canonical"', twitter_block + '        <link rel="canonical"', 1)
    else:
        new = content.replace('</head>', twitter_block + '    </head>', 1)

    if new != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new)
        count += 1
        print(f'OK: {fname}')
    else:
        print(f'SKIP: {fname}')

print(f'{nl}Done: {count} files updated')
