# Nifty Poshmark + Depop Automation Configs — 2026-04-19

## Access state

- **Before connection:** Both Poshmark and Depop showed "Get started" buttons but all automation panels were locked behind "not connected" state
- **After connection:** All 5 Poshmark + Depop automation panels fully accessible; config panels expand inline on `/automation`
- **Account state:** Subscription `BUNDLE_II` (Bundle Pro), trialing monthly, renewalDate 2026-04-24
- **isOttoBetaUser:** `false` — Otto beta features are role-gated, not plan-gated
- **Platform connections verified in page JSON:** Poshmark uid `681d95395c13772cc17b53a4`, Depop uid `439847664`, both `isConnected: true`
- **Total automation cards on page:** 9 across 4 platforms (Poshmark 3, eBay 2, Mercari 2, Depop 2)

---

## Poshmark — Shares & Relists config

**Panel label:** "Shares & relists"  
**Trigger:** Inline expansion (not a modal) on `/automation`  
**Help link:** `docs.nifty.ai/automation/automatic-shares`  
**Start/Stop:** "Save" and "Cancel" buttons present; no "Start" toggle visible until saved  
**Activity log:** Not visible in config panel; accessible via `/automation/history`

### Main controls

| Control | Type | Default | Notes |
|---------|------|---------|-------|
| Self-shares toggle | Switch | ON | "sharing your active items, bottom to top" |
| Self-shares daily goal | Number input | **1,764** | System recommends 1,764 — reflects closet size |
| Share to Posh Parties | Switch | ON | "Share eligible items to Posh Parties" |
| Community shares toggle | Switch | ON | "sharing items from other closets" |
| Community shares daily goal | Number input | **196** | No recommendation text |
| Relist unsold items toggle | Switch | ON | "older than [N] days" |
| Relist age threshold | Number input | **60** days | |
| Relist daily limit | Number input | **1** relist | |
| Price adjustment toggle | Switch | ON | "Adjust the price to be [N] [unit] [direction]" |
| Price adjustment amount | Number input | **0** | |
| Price unit | Combobox | **percent** | Options: percent / dollar (inferred) |
| Price direction | Combobox | **lower** | Options: lower / higher (inferred) |

### Scheduling

| Control | Type | Default |
|---------|------|---------|
| Daily schedule | 24-chip hour-picker | All 24 hours unselected (new config) |
| Timezone display | Label | EDT (display-only, reflects account timezone) |
| Bulk edit | Button | Present — click to select/deselect ranges |

### Advanced options (modal: "Advanced relists")

Clicking "Show advanced options" opens a dialog titled "PoshmarkRelists — Advanced relists."  
Warning text: "Typically, applying these filters is not recommended unless you need to exclude certain items explicitly."

| Filter | Type | Default | Enabled by default |
|--------|------|---------|-------------------|
| Likes threshold | Number input | < **3** likes | Toggle OFF (disabled) |
| Price range | Two number inputs | $**0** – $**50** | Toggle OFF |
| Condition | Combobox (Include/Exclude) | Include / **New** (NWT) | Toggle OFF |
| Title includes | Text/tag input | empty | N/A (always present) |
| Title excludes | Text/tag input | empty | N/A (always present) |

**Multi-rule for relists:** Not supported — single filter set only. No "Add another" button.

---

## Poshmark — Offers config

**Panel label:** "Offers"  
**Help link:** `docs.nifty.ai/automation/automatic-offers/automatic-offers-Poshmark`  
**Start/Stop:** Save / Cancel present

### Main controls

| Control | Type | Default | Notes |
|---------|------|---------|-------|
| Single-item offer toggle | Switch | ON | "sent when a shopper likes one item" |
| Offer type | Radio group | **Offer to all likers** | Alt: "Bundle offer to last liker" (BUNDLE_OFFER) |
| Wait delay | Number input | **10** | "15 minutes before sending" — the "15 min" is the platform-enforced minimum; the field is extra wait |
| Discount | Number input | **10** % off | |
| Shipping discount | Combobox | **no shipping discount** | |
| Multi-item offer toggle | Switch | ON | "sent when a shopper likes multiple items" |
| Waterfall offers toggle | Switch | ON | "send progressively deeper discounts after first offer" |

### Advanced options (modal: "PoshmarkOffers — Advanced offers")

Multi-rule dialog. Text: "we recommend putting specific offers first, and generic offers last. An item must match all criteria."

| Control | Type | Default |
|---------|------|---------|
| Offer discount per rule | Number input | **10** % |
| Shipping discount per rule | Combobox | no shipping discount |
| Age filter toggle | Checkbox | OFF (unchecked) |
| Age filter | Include/Exclude combobox + number | Include / **7** days |
| Price filter toggle | Checkbox | OFF |
| Price filter | Include/Exclude combobox + range | Include / $**0** – $**50** |
| Condition filter toggle | Checkbox | OFF |
| Condition filter | Include/Exclude + value combobox | Include / **New** (NWT) |
| Title includes | Tag input | empty |
| Title excludes | Tag input | empty |
| Add another offer | Button | Present — **multi-rule IS supported** |
| Rule ordering | Drag-and-drop | "Offer 1" draggable handle present |

**Multi-rule for offers: YES** — "Add another offer" button present. Rules are drag-reorderable.

---

## Poshmark — Follows config

**Panel label:** "Follows"  
**Help link:** `docs.nifty.ai/automation/automatic-follows`  
**Start/Stop:** Save / Cancel present

### Main controls

| Control | Type | Default | Notes |
|---------|------|---------|-------|
| Reciprocate received follows | Switch | ON | Auto-follows back anyone who followed you |
| Additionally follow N sellers | Switch + Number | ON / **0** | Can add extra follows beyond reciprocal |
| Unsubscribe from Posh Show notifications | Switch | ON | Unique utility toggle |
| Unfollow N sellers | Switch + Number | ON / **0** | Auto-unfollow; amount = 0 means not active |

**No advanced options button** for Follows.  
**No scheduling panel** — runs continuously.  
**No source filter** (can't specify "from parties" or "from closet X").

---

## Depop — Offers config

**Panel label:** "Offers"  
**Help link:** `docs.nifty.ai/automation/automatic-offers/automatic-offers-Depop`  
**Start/Stop:** Save / Cancel present

### Main controls

| Control | Type | Default | Notes |
|---------|------|---------|-------|
| Offer to all likers toggle | Switch | ON | Single offer mode only (no multi-item variant) |
| Base price | Radio group | **Current price** | Alt: "Original price" — unique to Depop |
| Wait delay | Number input | **10** | "15 minutes before sending" — same 15-min platform minimum |
| Discount | Number input | **10** % off | No shipping discount field (Depop doesn't support it) |
| Waterfall offers toggle | Switch | ON | Same as Poshmark |

### Advanced options (modal: "DepopOffers — Advanced offers")

Identical structure to Poshmark advanced offers.

| Filter | Default | Notes |
|--------|---------|-------|
| Age threshold | **7** days | Toggle OFF by default |
| Price range | $**0** – $**50** | Toggle OFF |
| Condition | Include / **New** (NWT) | Toggle OFF |
| Title includes | empty | |
| Title excludes | empty | |
| Add another offer | Present | **Multi-rule IS supported** |

**Key difference from Poshmark offers:** No shipping discount field. Has "Base price" radio (Current vs Original) — Poshmark doesn't.

---

## Depop — Relists config

**Panel label:** "Relists"  
**Help link:** `docs.nifty.ai/automation/automatic-relists/automatic-relists-Depop`  
**Start/Stop:** Save / Cancel present

### Main controls

| Control | Type | Default | Notes |
|---------|------|---------|-------|
| Relist unsold items toggle | Switch | ON | "older than [N] days" |
| Age threshold | Number input | **30** days | Note: Poshmark default is 60 days |
| Daily limit | Number input | **1** relist | |
| Price adjustment toggle | Switch | ON | Same percent/lower combobox pattern |
| Price adjustment amount | Number input | **0** | |
| Price unit | Combobox | **percent** | |
| Price direction | Combobox | **lower** | |

**No scheduling panel** (Depop relists run continuously, not hour-scheduled).

### Advanced options (modal: "DepopRelists — Advanced relists")

| Filter | Default | Enabled by default |
|--------|---------|-------------------|
| Likes threshold | < **3** likes | Toggle OFF |
| Price range | $**0** – $**50** | Toggle OFF |
| Condition | Include / **New** (NWT) | Toggle OFF |
| Title includes | empty | always present |
| Title excludes | empty | always present |

**Multi-rule for relists:** NOT supported — no "Add another" button.

---

## Comparison — Nifty vs PrimeLister vs Flyp

| Feature | Nifty (verified) | PrimeLister | Flyp |
|---------|-----------------|-------------|------|
| **Closet Share daily goal** | Number input, default 1,764 (closet-size-dynamic) | 1–9000/day slider | 6,000/day cap; Scheduled / Continuous / Just-once modes |
| **Share scheduling** | 24-hour chip picker (hourly granularity), Bulk edit | 24-hr time-block | HDT time-picker, Fast/Slow speed |
| **Party share** | Toggle ON/OFF (simple) | N/A | Party toggle present |
| **Community share** | Number input, default 196 | 1–9000/day | Return shares + follows, 100/closet, 30-day range; 4-speed slider (Fast/Medium/Slow/Sloth) |
| **Relist age threshold** | Number input (Poshmark default 60d, Depop default 30d) | Hourly rate + time-block + max 200/day | Multi-rule with age threshold |
| **Relist daily limit** | Number input, default 1 | Max 200/day | N/A |
| **Relist price adjustment** | % or $ up/down toggle | N/A | N/A |
| **Relist filters (adv)** | Likes (<3), price ($0–$50), condition, title include/exclude | Age, likes, price filters | Age threshold only |
| **Offers wait delay** | Number input (extra wait) + 15-min enforced minimum | 15-min enforced delay | Every N minutes |
| **Offers discount** | % only (no $ amount) | Multi-rule + 6 item filters | Discount %, shipping tiers, min price, exclude recent N days |
| **Offers shipping discount** | Poshmark: yes (combobox); Depop: none | N/A | Shipping tiers |
| **Offers multi-rule** | YES — "Add another offer" + drag-reorder | YES | YES |
| **Offer filters** | Age (7d), price ($0–$50), condition, title include/exclude | 6 filters | Fewer visible |
| **Waterfall offers** | Toggle ON/OFF | N/A | N/A (unique to Nifty) |
| **Bundle offer** | Radio: "Bundle offer to last liker" option | N/A | N/A (unique to Nifty) |
| **Depop base price** | Current / Original price radio | N/A | N/A (unique to Nifty) |
| **Follows — reciprocal** | Toggle ON/OFF | Return Follow | Return shares+follows |
| **Follows — extra follows** | Number input (additional sellers) | Follow New Closets 1–9000/day | Follow N from my/another/random closet |
| **Unfollow** | Number input (sellers to unfollow) | N/A explicit | Explicit unfollow option |
| **Posh Show notification unsub** | Toggle ON/OFF | N/A | N/A (unique to Nifty) |
| **Bundle creation automation** | NOT present | Min likes + comment + multi-rule + 5 filters | N/A |
| **Activity log** | History tab at `/automation/history` | N/A visible | N/A visible |

---

## Notable findings

### Unique Nifty features (not in PrimeLister or Flyp)
- **Waterfall offers** — automated progressive discounts after first offer is sent
- **Bundle offer to last liker** — offer sent specifically to the most recent liker as a bundle
- **Depop "base price" option** — choose between current vs original list price for offer calculation
- **Posh Show notification unsubscribe** — utility toggle bundled into Follows automation
- **Dynamic self-share recommendation** — system calculates and displays recommended daily share count (1,764) based on closet inventory size
- **Drag-reorderable multi-rule offers** — rules processed in user-defined order (specific first, generic last)

### Missing features vs competitors
- **No bundle creation automation** — PrimeLister has a dedicated bundle creation flow (min likes trigger + comment + 5 filters); Nifty has no equivalent
- **No speed controls** — Flyp has Fast/Medium/Slow/Sloth; PrimeLister has hourly rate control; Nifty's schedule is hourly chip-picking only with no speed/interval option
- **No party closet sharing with return-follows** — Flyp allows "return shares + follows" from party closets with 100/closet caps; Nifty's community share is a simple daily number
- **No explicit "follow from party/closet" source** — Nifty follows are reciprocal-only or additional N sellers (no source targeting)
- **No relist hourly rate control** — both PrimeLister and Flyp expose relist timing/rate; Nifty only has a daily limit of 1
- **Shipping discount for Poshmark offers** — present but only a single combobox ("no shipping discount" default); Flyp has tiered shipping discounts

### Default values (out-of-box experience)
- All major feature toggles default **ON** — new users start with everything enabled
- Poshmark self-share goal: **1,764** (dynamic per closet size)
- Community share goal: **196**
- Poshmark relist age: **60 days**, Depop relist age: **30 days**
- Daily relist limit: **1** for both platforms
- Offer wait: **10** minutes extra (+ 15-min platform minimum = 25 min earliest)
- Offer discount: **10%** off
- Advanced offer filters all default **OFF** (filters disabled; all items eligible)
- Advanced offer age default: 7 days | price default: $0–$50 | condition default: New/NWT

### Scheduling notes
- Poshmark Shares & Relists: **hourly chip picker** (24 chips, one per hour). New configs have 0 hours selected — user must pick active hours before saving
- Depop Relists: **no schedule panel** — runs continuously throughout the day
- Poshmark Follows: **no schedule panel** — runs continuously

---

## Still blocked / gated

- **Otto** — `isOttoBetaUser: false` in account JSON. "Ask Otto" nav link present but beta access is role-gated server-side. No UI prompt to request access or buy credits visible on `/automation`
- **Smart Credits / "Buy more"** — not surfaced anywhere on `/automation`. Likely only appears within the Otto interface once beta access is granted
- **Whatnot** — `isWhatnotBetaUser: false`; no Whatnot automation card present on `/automation`
- **eBay Recreates / Mercari Relists** — not Poshmark/Depop but noted: these panels exist and are accessible (not gated), just not in scope for this document
