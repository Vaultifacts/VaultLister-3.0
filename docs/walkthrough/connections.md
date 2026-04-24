# Connections / Platform OAuth -- Walkthrough Findings

## Open Items

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| CR-10 | My Shops / OAuth | OAuth incomplete: eBay live, Shopify live, Depop 503, Poshmark/Grailed/Whatnot/Facebook Playwright bot only, Mercari/Etsy deferred post-launch | Session 1 | OPEN -- verified 2026-04-24 |
| MANUAL-conn-1 | My Shops | VaultLister logo missing in top right corner; platform integration cards not displayed correctly; Depop and Facebook should be Official API integrations with OAuth 2.0 (image-22) | Backlog | OPEN / NEEDS MANUAL CHECK |
| MANUAL-conn-2 | Listings / Automations / Integrations | Proper platform icons not being used; platform names not including (CA); Shopify import listings missing (image-51, image-59, image-81) | Backlog | OPEN / NEEDS MANUAL CHECK |

## Resolved

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| CR-3 | Stripe | Stripe price IDs not configured | Session 1 | VERIFIED -- STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, STRIPE_PRICE_BUSINESS set in Railway 2026-04-20 |
| M-33 | Privacy / Email | Privacy policy mailbox and transactional email setup | Session 3 | OPEN -- MX points to Google Workspace, references correct in public pages, but actual mailbox delivery not re-proven -- send test email to privacy@vaultlister.com and hello@vaultlister.com before launch |
