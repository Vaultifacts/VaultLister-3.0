import os

pub = 'C:/Users/Matt1/OneDrive/Desktop/vaultlister-3/public'

EM = '\u2014'

FIXES = {
    'affiliate.html':        (f'Affiliate Program {EM} VaultLister',      f'VaultLister Affiliate Program {EM} Earn Money Reselling'),
    'ai-info.html':          (f'AI Info {EM} VaultLister',                 f'VaultLister AI Tools for Resellers {EM} Smart Listings'),
    'api-changelog.html':    (f'API Changelog {EM} VaultLister',           f'VaultLister API Changelog {EM} Release Notes and Versions'),
    'api-docs.html':         ('VaultLister API Docs',                      f'VaultLister API Documentation {EM} Developer Reference'),
    'blog/index.html':       (f'Blog {EM} VaultLister',                    f'VaultLister Reseller Blog {EM} Selling Tips and Guides'),
    'changelog.html':        (f'Changelog {EM} VaultLister',               f'VaultLister Product Changelog {EM} New Features and Fixes'),
    'compare/closo.html':    (f'VaultLister vs Closo {EM} VaultLister',    f'VaultLister vs Closo {EM} Cross-Listing Tool Comparison'),
    'compare/crosslist-magic.html': (f'VaultLister vs Crosslist Magic {EM} VaultLister', f'VaultLister vs Crosslist Magic {EM} Reseller Comparison'),
    'compare/crosslist.html':(f'VaultLister vs Crosslist {EM} VaultLister',f'VaultLister vs Crosslist {EM} Full Feature Comparison'),
    'compare/flyp.html':     (f'VaultLister vs Flyp {EM} VaultLister',     f'VaultLister vs Flyp {EM} Which Is Better for Resellers'),
    'compare/list-perfectly.html': (f'VaultLister vs List Perfectly {EM} VaultLister', f'VaultLister vs List Perfectly {EM} Reseller Tool Review'),
    'compare/nifty.html':    (f'VaultLister vs Nifty {EM} VaultLister',    f'VaultLister vs Nifty {EM} Which Should Resellers Use'),
    'compare/oneshop.html':  (f'VaultLister vs OneShop {EM} VaultLister',  f'VaultLister vs OneShop {EM} Best Cross-Listing Tool'),
    'compare/primelister.html': (f'VaultLister vs Primelister {EM} VaultLister', f'VaultLister vs PrimeLister {EM} Reseller Tool Comparison'),
    'compare/selleraider.html': (f'VaultLister vs SellerAider {EM} VaultLister', f'VaultLister vs SellerAider {EM} Which Reseller Tool Wins'),
    'compare/vendoo.html':   (f'VaultLister vs Vendoo {EM} VaultLister',   f'VaultLister vs Vendoo {EM} Reseller Tool Feature Review'),
    'contact.html':          (f'Contact Us {EM} VaultLister',              f'Contact VaultLister {EM} Reseller Help and Support Team'),
    'cookies.html':          (f'Cookie Policy {EM} VaultLister',           f'VaultLister Cookie Policy {EM} How We Use Your Cookies'),
    'documentation.html':    (f'Documentation {EM} VaultLister',           f'VaultLister Documentation {EM} Complete Setup Reference'),
    'faq.html':              (f'FAQs {EM} VaultLister',                    f'VaultLister FAQ {EM} Frequently Asked Questions and Help'),
    'glossary.html':         (f'Reseller Glossary {EM} VaultLister',       f'Reseller Glossary {EM} Cross-Listing and Selling Defined'),
    'help.html':             (f'Help Center {EM} VaultLister',             f'VaultLister Help Center {EM} Reseller Support and Guides'),
    'help/automations.html': (f'Automations {EM} VaultLister Help Center', f'VaultLister Automations Guide {EM} Bots and Scheduling Help'),
    'help/cross-listing.html': (f'Cross-Listing {EM} VaultLister Help Center', f'VaultLister Cross-Listing Guide {EM} How to Cross-List'),
    'help/getting-started.html': (f'Getting Started {EM} VaultLister Help Center', f'Getting Started with VaultLister {EM} Complete Setup Guide'),
    'help/inventory-management.html': (f'Inventory Management {EM} VaultLister Help Center', f'VaultLister Inventory Management {EM} Help and User Guide'),
    'help/troubleshooting.html': (f'Troubleshooting {EM} VaultLister Help Center', f'VaultLister Troubleshooting Guide {EM} Fix Common Issues'),
    'landing.html':          (f'VaultLister {EM} Multi-Channel Reselling Platform', f'VaultLister {EM} Multi-Channel Reselling Made Simpler'),
    'learning.html':         (f'Learning {EM} VaultLister',                f'VaultLister Reseller Learning Center {EM} Tips and Guides'),
    'platforms.html':        (f'Marketplace Integrations {EM} VaultLister',f'VaultLister Marketplace Integrations {EM} 9 Platforms'),
    'pricing.html':          (f'Pricing {EM} VaultLister',                 f'VaultLister Pricing Plans {EM} Affordable Reseller Tools'),
    'privacy.html':          (f'Privacy Policy {EM} VaultLister',          f'VaultLister Privacy Policy {EM} Your Data and Security'),
    'quickstart.html':       (f'Developer Setup Guide {EM} VaultLister',   f'VaultLister Developer Quickstart and Full Setup Guide'),
    'rate-limits.html':      (f'Rate Limits {EM} VaultLister',             f'VaultLister API Rate Limits {EM} Full Throttling Guide'),
    'request-feature.html':  ('Feature Requests - VaultLister',            f'Request a VaultLister Feature {EM} Shape Our Roadmap'),
    'roadmap-public.html':   (f'Roadmap {EM} VaultLister',                 f'VaultLister Public Roadmap {EM} Upcoming Features and Plans'),
    'status.html':           (f'Status {EM} VaultLister',                  f'VaultLister System Status {EM} Uptime and Incident History'),
    'terms.html':            (f'Terms of Service {EM} VaultLister',        f'VaultLister Terms of Service {EM} Full Legal Agreement'),
    'api-docs/index.html':   ('VaultLister API Documentation',             f'VaultLister REST API {EM} Full Reference Documentation'),
    'blog/depop-y2k-vintage-what-sells.html': (f'Depop in 2026: Which Y2K and Vintage Items Actually Sell {EM} VaultLister Blog', f'Depop Y2K and Vintage: What Sells in 2026 {EM} VaultLister'),
    'blog/how-to-cross-list-50-items.html': (f'How to Cross-List 50 Items in Under an Hour {EM} VaultLister Blog', f'Cross-List 50 Items in Under an Hour {EM} VaultLister'),
    'blog/mercari-trading-cards-sell-fast.html': (f'How to Sell Trading Cards Fast on Mercari in 2026 {EM} VaultLister Blog', f'Sell Trading Cards Fast on Mercari 2026 {EM} VaultLister'),
    'blog/poshmark-closet-sharing-2026.html': (f'Poshmark Closet Sharing in 2026: What Actually Works {EM} VaultLister Blog', f'Poshmark Closet Sharing in 2026 {EM} VaultLister Blog'),
    'blog/using-ai-for-poshmark-listings.html': (f'Using AI to Write Better Poshmark Listings {EM} VaultLister Blog', f'AI-Written Poshmark Listings That Sell {EM} VaultLister'),
    'blog/whatnot-live-selling-beginners.html': (f'Whatnot Live Selling for Beginners: A Complete Starter Guide {EM} VaultLister Blog', f'Whatnot Live Selling for Beginners 2026 {EM} VaultLister'),
}

changed, skipped, errors = [], [], []
for rel, (old, new) in FIXES.items():
    path = f'{pub}/{rel}'
    try:
        content = open(path, encoding='utf-8').read()
        old_tag = f'<title>{old}</title>'
        new_tag = f'<title>{new}</title>'
        if old_tag in content:
            open(path, 'w', encoding='utf-8').write(content.replace(old_tag, new_tag, 1))
            changed.append((rel, len(new)))
        else:
            skipped.append((rel, repr(old[:50])))
    except Exception as e:
        errors.append((rel, str(e)))

print(f'Changed: {len(changed)}')
for r, l in changed:
    print(f'  {l:3d}  {r}')
print(f'Skipped: {len(skipped)}')
for r, m in skipped:
    print(f'  {r}: {m}')
print(f'Errors: {len(errors)}')
