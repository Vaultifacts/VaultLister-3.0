# Refer a Friend -- Walkthrough Findings

## Open Items

None.

## Resolved

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| H-17 | Refer a Friend | Referral link `https://vaultlister.com/signup?ref=VAULTDEMO` -- referral backend wiring unclear | Session 2 | VERIFIED -- bc2c9f4 -- migration 005 adds referral_code column; signup now records affiliate_commissions |
| L-14 | Refer a Friend | Referral code "VAULTDEMO" hardcoded -- should be user-specific | Session 2 | VERIFIED -- pages-community-help.js:742: code is user.referral_code or 'VAULT' + user.id.substring(0,6).toUpperCase() -- dynamic per user, confirmed "VAULTU1" in live render 2026-04-07 |
| L-24 | Refer a Friend | "VAULTDEMO" referral code -- hardcoded, not user-specific (duplicate of L-14) | Session 3 | CONFIRMED N/A -- duplicate of L-14 |
| CO-6 | Refer a Friend | Logo shows "V" overlaid on purple -- inconsistent with other pages | Session 3 | CONFIRMED N/A -- no logo element in Refer a Friend page content (pages-community-help.js:740-879). Only "V" present is the global sidebar-logo, consistent across all pages (2026-04-07) |
