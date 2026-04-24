# Settings — Walkthrough Findings

## Open Items

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| M-28 | Teams | "Create Team" available on Free plan -- needs tier gating | Session 3 | VERIFIED -- clicking Create Team on free plan fires toast "Team features require a Pro or Business plan" with no modal (2026-04-07) |
| MANUAL-settings-1 | Settings | Please change the tabs on the settings page to a horizontal orientation instead of a vertical orientation (image-52) | Backlog | OPEN / NEEDS MANUAL CHECK |
| MANUAL-settings-2 | Settings | Please format the tabs on the settings page in this order → Integrations, Account, Subscription, Affiliate Program, Customization, Notifications, and Data | Backlog | OPEN / NEEDS MANUAL CHECK |
| MANUAL-settings-3 | Settings | Please add these dropdown menus as options in the Account tab of the Settings page inside the app, next to the Timezone field (image-83, image-84) | Backlog | OPEN / NEEDS MANUAL CHECK |
| MANUAL-settings-4 | Settings | Remove this from the Appearance tab on the settings page (image-14) | Backlog | OPEN / NEEDS MANUAL CHECK |
| MANUAL-settings-5 | Settings | Platforms say connected in integrations, even though they are not actually connected (image-15) | Backlog | OPEN / NEEDS MANUAL CHECK |
| MANUAL-settings-6 | Settings | Migrate Shipping Profiles in the tools tab of the settings page, to instead the Shipping tab of the Offers, Orders, & Shipping Page | Backlog | OPEN / NEEDS MANUAL CHECK |
| MANUAL-settings-7 | Settings | Move Affiliate Program to its own tab on the Settings Page | Backlog | OPEN / NEEDS MANUAL CHECK |
| MANUAL-settings-8 | Settings | Integrate the Account Tab to the Settings page | Backlog | OPEN / NEEDS MANUAL CHECK |
| MANUAL-settings-9 | Settings | Integrate the "Plans & Billing" Tab to the Settings page | Backlog | OPEN / NEEDS MANUAL CHECK |
| MANUAL-settings-10 | Settings | Please move all of this to the "Plans & Billing" (image-16) | Backlog | OPEN / NEEDS MANUAL CHECK |
| MANUAL-settings-11 | Settings | Proper platform Icons are not being used. Platform Names are not including (CA) at the end of them. Also Shopify import listings is not an option but should be. Same thing on the Integrations tab on the settings page (image-81) | Backlog | OPEN / NEEDS MANUAL CHECK |

## Resolved

| # | Page / Component | Issue | Session | Status |
|---|-----------------|-------|---------|--------|
| H-5 | Settings | "Enable 2FA" button — STATUS.md marks as Fail *(See also: #174 — same issue, discovered independently)* | Session 1 | VERIFIED ✅ — eb9e086 |
| M-8 | Settings | Timezone defaults to Eastern, not user's timezone — should auto-detect or default to MST for Calgary launch | Session 1 | VERIFIED ✅ — e097efa |
| L-7 | Settings | "Full Name" empty — registration doesn't collect full name | Session 1 | VERIFIED ✅ — pages-core.js — "Full Name" field is first field in registration form, confirmed live |
| L-8 | Help / Support | "Contact support to change email" — no support channel defined | Session 1 | VERIFIED ✅ — e97b0bf — <a href="mailto:hello@vaultlister.com"> confirmed live in Settings > Profile |
| #174 | Settings | Settings "Enable 2FA" button — no response when clicked *(See also: H-5 — same issue, discovered independently)* | Session 11 | CONFIRMED FIXED — duplicate of H-5 (VERIFIED ✅ eb9e086) |

## Extended QA Session Findings (Settings Tab)

### Resolved

| Finding | Status |
|---------|--------|
| Recurring HTML Injection Bug — Change Profile Picture Modal | VERIFIED ✅ — 9f6f50d — changeAvatar() modal rebuilt with correct single-arg modals.show(html) structure |
| Integrations Tab Shows Fake "Connected" Platform Data | VERIFIED ✅ — 9f6f50d — hardcoded cards replaced with dynamic loop over store.state.shops using s.is_connected |
| "Account" Sub-Nav Item Navigates Away from Settings | VERIFIED ✅ — 9f6f50d — changed to handlers.setSettingsTab('account') |
| "Save Changes" Button Does Not Detect Changes in Appearance Section | VERIFIED ✅ — 9f6f50d — toggles/selects now call markSettingsChanged() to enable Save button |
| Accent Color Swatches (Purple, Orange, Pink, Red, Teal, Indigo) Are Invisible | VERIFIED ✅ — 9f6f50d — swatches now use hardcoded hex values instead of transparent CSS var |
| Keyboard Shortcuts Show macOS ⌘ Symbol on All Platforms | VERIFIED ✅ — 9f6f50d — platform detection shows Ctrl+ on Windows/Linux, ⌘ on Mac |
| "Automatic Cleanup" Title and Description Concatenated | VERIFIED ✅ — 9f6f50d — toggle-label/description use display:block |
| Navigating to #settings Always Lands on Last Visited Sub-Section | VERIFIED ✅ — 9f6f50d — router resets settingsTab to 'profile' on each #settings navigation |
| "Reset to Defaults" in Appearance Has No Confirmation Dialog | VERIFIED ✅ — 9f6f50d — confirm modal added before reset executes |
| Notification Channel Buttons Missing aria-label | VERIFIED ✅ — 9f6f50d — aria-label added to push/email channel buttons |
| "View Account" Button Within Settings > Profile Opens Separate Page Without Warning | VERIFIED ✅ — 9f6f50d — title attribute + external-link icon added |
| FIXED — Settings sidebar tab targeting so the clicked tab renders immediately (image-80) | FIXED — 2026-04-23 local route-normalization patch; live/manual recheck pending |
