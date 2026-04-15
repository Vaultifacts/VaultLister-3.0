# Facebook Chrome Extension Gap-Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add category, condition, and location fields to `fillFacebook()` in the Chrome extension with graceful fallback, so the form-fill covers all required Marketplace fields.

**Architecture:** Port `CONDITION_MAP` and `CATEGORY_MAP` from the existing Playwright implementation (`facebookPublish.js`) into `poster.js`. Add three new field-fill blocks to `fillFacebook()`, each independently try/caught. Return a list of skipped fields to the caller so the status overlay can tell the user what to fill manually.

**Tech Stack:** Vanilla JS (Chrome extension content script), DOM manipulation, React input bypass patterns already in `poster.js`

---

### Task 1: Add maps and update `fillFacebook()` with category, condition, location, and skipped-fields tracking

**Files:**
- Modify: `chrome-extension/content/poster.js` — `fillFacebook()` function (lines 199-236) and `fillAndSubmit()` (lines 441-459)

- [ ] **Step 1: Add CONDITION_MAP and CATEGORY_MAP constants**

Add these right before the `fillFacebook()` function (before line 199). These are ported directly from `src/backend/services/platformSync/facebookPublish.js:19-46`:

```javascript
// Facebook Marketplace field maps (ported from facebookPublish.js)
const FB_CONDITION_MAP = {
    'new':      'New',
    'like_new': 'Like New',
    'good':     'Good',
    'fair':     'Fair',
    'poor':     'Poor'
};

const FB_CATEGORY_MAP = {
    'clothing':     'Clothing & Accessories',
    'shoes':        'Clothing & Accessories',
    'accessories':  'Clothing & Accessories',
    'electronics':  'Electronics',
    'furniture':    'Home & Garden',
    'home':         'Home & Garden',
    'garden':       'Home & Garden',
    'toys':         'Toys & Games',
    'games':        'Toys & Games',
    'books':        'Books, Movies & Music',
    'movies':       'Books, Movies & Music',
    'music':        'Books, Movies & Music',
    'sports':       'Sporting Goods',
    'vehicles':     'Vehicles',
    'tools':        'Tools & DIY',
    'collectibles': 'Hobbies'
};
```

- [ ] **Step 2: Add helper to click a dropdown option by text**

Add this helper right after the maps. Facebook dropdowns use `[role="option"]` or `<li>` elements. This is the Chrome extension equivalent of the Playwright `page.$('[role="option"]:has-text("...")')` pattern:

```javascript
// Click a dropdown option matching text (Facebook uses role="option" or li elements)
async function clickDropdownOption(triggerSelectors, optionText, timeout = 6000) {
    const trigger = await findElement(triggerSelectors, timeout);
    if (!trigger) return false;

    trigger.click();
    await new Promise(r => setTimeout(r, 800));

    // Search for matching option in the dropdown that just opened
    const options = document.querySelectorAll('[role="option"], [role="menuitem"], li[role="presentation"] span');
    for (const opt of options) {
        if (opt.textContent.trim() === optionText) {
            opt.click();
            await new Promise(r => setTimeout(r, 400));
            return true;
        }
    }

    // No match found — close dropdown with Escape
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return false;
}
```

- [ ] **Step 3: Replace `fillFacebook()` with the complete version**

Replace the entire `fillFacebook()` function (lines 199-236) with:

```javascript
async function fillFacebook(data) {
    // Facebook Marketplace uses a mix of inputs and contenteditable divs
    const skipped = [];

    // Title
    try {
        const titleEl = await findElement([
            'input[placeholder="What are you selling?"]',
            'input[aria-label="Title"]',
            'input[aria-label*="title" i]',
            'input[name="title"]'
        ]);
        if (titleEl && data.title) setReactInputValue(titleEl, data.title);
        else if (data.title) skipped.push('Title');
    } catch { skipped.push('Title'); }

    // Price
    try {
        const priceEl = await findElement([
            'input[placeholder="Price"]',
            'input[aria-label="Price"]',
            'input[aria-label*="price" i]',
            'input[name="price"]'
        ]);
        if (priceEl && data.list_price) setReactInputValue(priceEl, String(data.list_price));
        else if (data.list_price) skipped.push('Price');
    } catch { skipped.push('Price'); }

    // Category
    try {
        const rawCat = (data.category || '').toLowerCase();
        const fbCategory = Object.entries(FB_CATEGORY_MAP).find(([k]) => rawCat.includes(k))?.[1];
        if (fbCategory) {
            const filled = await clickDropdownOption([
                '[aria-label*="category" i]',
                '[placeholder*="category" i]',
                'label:has(span:only-child)'
            ], fbCategory);
            if (!filled) skipped.push('Category');
        } else {
            skipped.push('Category');
        }
    } catch { skipped.push('Category'); }

    // Condition
    try {
        const rawCond = (data.condition || '').toLowerCase();
        const fbCondition = FB_CONDITION_MAP[rawCond] || FB_CONDITION_MAP[rawCond.replace(/ /g, '_')];
        if (fbCondition) {
            const filled = await clickDropdownOption([
                '[aria-label*="condition" i]',
                '[placeholder*="condition" i]'
            ], fbCondition);
            if (!filled) skipped.push('Condition');
        } else {
            skipped.push('Condition');
        }
    } catch { skipped.push('Condition'); }

    // Location
    try {
        const location = data.location || data.zip_code;
        if (location) {
            const locEl = await findElement([
                'input[aria-label*="location" i]',
                'input[placeholder*="location" i]',
                'input[aria-label*="city" i]'
            ], 4000);
            if (locEl) {
                setReactInputValue(locEl, String(location));
            } else {
                skipped.push('Location');
            }
        }
    } catch { skipped.push('Location'); }

    // Description — Facebook uses a contenteditable div
    try {
        const descEl = await findElement([
            'div[aria-label="Description"][role="textbox"]',
            'div[contenteditable="true"][data-lexical-editor]',
            'textarea[aria-label="Description"]',
            'textarea[aria-label*="description" i]'
        ]);
        if (descEl && data.description) {
            if (descEl.tagName === 'DIV') {
                setContentEditable(descEl, data.description);
            } else {
                setReactTextareaValue(descEl, data.description);
            }
        } else if (data.description) {
            skipped.push('Description');
        }
    } catch { skipped.push('Description'); }

    // Images — click the photo upload button area
    try {
        if (data.images && data.images.length) {
            await uploadImages(data.images, 'input[type="file"][accept*="image"]');
        }
    } catch { skipped.push('Images'); }

    return skipped;
}
```

- [ ] **Step 4: Update `fillAndSubmit()` to show skipped fields in the overlay**

In `fillAndSubmit()`, change the facebook case and the success overlay to use the returned skipped array. Replace lines 448-459:

```javascript
    try {
        let skipped = [];
        switch (platform) {
            case 'poshmark': await fillPoshmark(data); break;
            case 'depop':    await fillDepop(data);    break;
            case 'facebook': skipped = (await fillFacebook(data)) || []; break;
            case 'whatnot':  await fillWhatnot(data);  break;
            case 'mercari':  await fillMercari(data);  break;
            case 'grailed':  await fillGrailed(data);  break;
            default: throw new Error(`Unsupported platform: ${platform}`);
        }

        const skippedMsg = skipped.length
            ? `\n\nCould not auto-fill: ${skipped.join(', ')}. Please fill these manually.`
            : '';
        showStatusOverlay(syncId, platform, 'filled',
            'Form filled! Review the details and click the platform\'s submit button. Then click "Mark as Listed" above.' + skippedMsg);
```

- [ ] **Step 5: Syntax check**

Run: `node -c chrome-extension/content/poster.js`
Expected: no output (exit 0)

- [ ] **Step 6: Commit**

```bash
git add chrome-extension/content/poster.js
git commit -m "[AUTO] feat(extension): add category, condition, location to Facebook Marketplace autofill

Ports CONDITION_MAP and CATEGORY_MAP from facebookPublish.js.
Each field independently try/caught with graceful fallback.
Skipped fields shown in status overlay so user knows what to fill manually.

Verified: node -c passes"
```
