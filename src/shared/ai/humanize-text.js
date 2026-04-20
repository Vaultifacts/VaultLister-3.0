// AI Description Humanization Layer
// Per spec Layer 9: AI-generated text must be indistinguishable from human-written.
// This module post-processes AI descriptions to add natural imperfections,
// vary sentence structure, and prevent NLP classifier detection.

/**
 * Humanize an AI-generated listing description.
 * Applies subtle natural imperfections that defeat AI-text classifiers.
 * @param {string} text - AI-generated description
 * @param {Object} opts
 * @param {string} opts.platform - Target platform (varies style per platform)
 * @returns {string} Humanized text
 */
export function humanizeDescription(text, { platform = '' } = {}) {
    if (!text || text.length < 10) return text;

    let result = text;

    // 1. Break up formulaic sentence openers
    result = varyOpeners(result);

    // 2. Vary punctuation — replace some periods with dashes or semicolons
    result = varyPunctuation(result);

    // 3. Add casual contractions where formal text exists
    result = addContractions(result);

    // 4. Introduce minor informality per platform
    result = platformTone(result, platform);

    // 5. Occasionally drop the final period (natural in casual listings)
    if (Math.random() < 0.3 && result.endsWith('.')) {
        result = result.slice(0, -1);
    }

    return result;
}

// Replace common AI openers with varied alternatives
function varyOpeners(text) {
    const replacements = [
        [/^This (?:item |piece )?features /im, () => pick(['Has ', 'Comes with ', 'Got ', 'Includes '])],
        [/^Perfect for /im, () => pick(['Great for ', 'Ideal for ', 'Works well for ', 'Good for '])],
        [/^Whether you're /im, () => pick(["If you're ", "For anyone who's ", "If you "])],
        [/^This is a /im, () => pick(["Here's a ", "Selling a ", "Got a "])],
        [/^Featuring /im, () => pick(['Has ', 'With ', 'Comes with '])],
        [/^Experience /im, () => pick(['Enjoy ', 'Check out ', 'Try '])],
    ];
    let result = text;
    for (const [pattern, replacer] of replacements) {
        if (Math.random() < 0.7) {
            result = result.replace(pattern, replacer());
        }
    }
    return result;
}

// Vary punctuation to avoid the "perfectly polished" AI signal
function varyPunctuation(text) {
    const sentences = text.split(/(?<=[.!]) /);
    if (sentences.length < 3) return text;

    return sentences.map((s, i) => {
        // Occasionally replace period with dash or semicolon between mid-sentences
        if (i > 0 && i < sentences.length - 1 && Math.random() < 0.15) {
            if (s.endsWith('.')) {
                return s.slice(0, -1) + (Math.random() < 0.5 ? ' -' : ';');
            }
        }
        return s;
    }).join(' ');
}

// Add natural contractions
function addContractions(text) {
    const pairs = [
        [/\bdo not\b/gi, "don't"],
        [/\bcannot\b/gi, "can't"],
        [/\bwill not\b/gi, "won't"],
        [/\bit is\b/gi, "it's"],
        [/\bthey are\b/gi, "they're"],
        [/\bwe are\b/gi, "we're"],
        [/\bI am\b/gi, "I'm"],
        [/\bwould not\b/gi, "wouldn't"],
        [/\bcould not\b/gi, "couldn't"],
        [/\bis not\b/gi, "isn't"],
    ];
    let result = text;
    for (const [pattern, replacement] of pairs) {
        if (Math.random() < 0.8) {
            result = result.replace(pattern, replacement);
        }
    }
    return result;
}

// Adjust tone per platform
function platformTone(text, platform) {
    switch (platform) {
        case 'poshmark':
        case 'depop':
            // More casual/trendy
            if (Math.random() < 0.3) text = text.replace(/\bpurchase\b/gi, 'grab');
            if (Math.random() < 0.3) text = text.replace(/\bexcellent\b/gi, 'amazing');
            break;
        case 'ebay':
        case 'mercari':
            // Slightly more formal/detailed
            if (Math.random() < 0.2) text = text.replace(/\bgreat\b/gi, 'excellent');
            break;
        case 'grailed':
            // Streetwear/fashion tone
            if (Math.random() < 0.3) text = text.replace(/\bclothing item\b/gi, 'piece');
            break;
        default:
            break;
    }
    return text;
}

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

export default { humanizeDescription };
