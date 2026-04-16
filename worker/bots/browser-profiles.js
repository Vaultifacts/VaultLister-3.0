// Persistent browser profile pool for Camoufox-based bots.
// Profiles are stored as directories in data/.browser-profiles/.
// Each profile is a Camoufox user_data_dir that persists cookies, localStorage,
// and session storage across bot runs — replaces the manual storageState pattern.

import fs from 'fs';
import path from 'path';

const PROFILES_DIR = path.join(process.cwd(), 'data', '.browser-profiles');
const PROFILES_JSON = path.join(PROFILES_DIR, 'profiles.json');
const DEFAULT_PROFILE_COUNT = 3;

function readProfiles() {
    try {
        if (fs.existsSync(PROFILES_JSON)) {
            return JSON.parse(fs.readFileSync(PROFILES_JSON, 'utf8'));
        }
    } catch {}
    return [];
}

function writeProfiles(profiles) {
    fs.writeFileSync(PROFILES_JSON, JSON.stringify(profiles, null, 2), 'utf8');
}

/**
 * Create profile directories and metadata file if they don't exist.
 * Safe to call on every bot startup — no-ops if already initialised.
 * @param {number} count - Number of profiles to create (default: 3)
 */
export function initProfiles(count = DEFAULT_PROFILE_COUNT) {
    if (!fs.existsSync(PROFILES_DIR)) {
        fs.mkdirSync(PROFILES_DIR, { recursive: true });
    }

    let profiles = readProfiles();

    if (profiles.length < count) {
        const now = new Date().toISOString();
        for (let i = profiles.length + 1; i <= count; i++) {
            const id = `profile-${i}`;
            const dir = path.join(PROFILES_DIR, id);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            profiles.push({ id, createdAt: now, lastUsedAt: null, usageCount: 0, flagged: false, proxyUrl: null });
        }
        writeProfiles(profiles);
    }

    // Ensure directories exist for any profile in metadata that lost its dir
    for (const p of profiles) {
        const dir = path.join(PROFILES_DIR, p.id);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Return the least-recently-used non-flagged profile and update its lastUsedAt.
 * @returns {{ id, createdAt, lastUsedAt, usageCount, flagged }}
 * @throws if no usable profiles are available
 */
export function getNextProfile() {
    const profiles = readProfiles();
    const usable = profiles.filter(p => !p.flagged);
    if (usable.length === 0) {
        throw new Error('No usable browser profiles available — all profiles are flagged. Manually unflag profiles in data/.browser-profiles/profiles.json to continue.');
    }

    // Sort: never-used first (lastUsedAt === null), then by oldest lastUsedAt
    usable.sort((a, b) => {
        if (a.lastUsedAt === null) return -1;
        if (b.lastUsedAt === null) return 1;
        return new Date(a.lastUsedAt) - new Date(b.lastUsedAt);
    });

    const chosen = usable[0];
    const idx = profiles.findIndex(p => p.id === chosen.id);
    profiles[idx].lastUsedAt = new Date().toISOString();
    writeProfiles(profiles);
    return { ...profiles[idx] };
}

/**
 * Increment usageCount and refresh lastUsedAt for a profile after a successful run.
 * @param {string} id - Profile ID
 */
export function saveProfileUsage(id) {
    const profiles = readProfiles();
    const idx = profiles.findIndex(p => p.id === id);
    if (idx === -1) return;
    profiles[idx].usageCount = (profiles[idx].usageCount || 0) + 1;
    profiles[idx].lastUsedAt = new Date().toISOString();
    writeProfiles(profiles);
}

/**
 * Flag a profile as unsafe after a CAPTCHA or account lockout.
 * Flagged profiles will not be selected by getNextProfile() until manually unflagged.
 * @param {string} id - Profile ID
 */
export function flagProfile(id) {
    const profiles = readProfiles();
    const idx = profiles.findIndex(p => p.id === id);
    if (idx === -1) return;
    profiles[idx].flagged = true;
    writeProfiles(profiles);
}

/**
 * Return the absolute path to a profile's user_data_dir.
 * @param {string} id - Profile ID
 * @returns {string} Absolute path
 */
export function getProfileDir(id) {
    return path.join(PROFILES_DIR, id);
}

/**
 * Get the proxy URL assigned to a profile.
 * Each profile should use a dedicated proxy to prevent cross-account IP correlation.
 * Proxy URLs are assigned via setProfileProxy() or FACEBOOK_PROXY_URL_N env vars.
 * @param {string} id - Profile ID
 * @returns {string|null} Proxy URL or null
 */
export function getProfileProxy(id) {
    const profiles = readProfiles();
    const profile = profiles.find(p => p.id === id);
    if (profile?.proxyUrl) return profile.proxyUrl;
    // Fallback: check env var FACEBOOK_PROXY_URL_1, _2, _3 etc
    const num = id.replace('profile-', '');
    const envProxy = process.env[`FACEBOOK_PROXY_URL_${num}`];
    if (envProxy) return envProxy;
    // Final fallback: shared proxy
    return process.env.FACEBOOK_PROXY_URL || null;
}

/**
 * Assign a dedicated proxy URL to a profile.
 * @param {string} id - Profile ID
 * @param {string} proxyUrl - Proxy URL (e.g., socks5://user:pass@host:port)
 */
export function setProfileProxy(id, proxyUrl) {
    const profiles = readProfiles();
    const idx = profiles.findIndex(p => p.id === id);
    if (idx === -1) return;
    profiles[idx].proxyUrl = proxyUrl;
    writeProfiles(profiles);
}

/**
 * Generate unique behavioral parameters for a profile.
 * Each profile gets distinct typing speed, pause, and mouse distributions
 * so cross-account behavioral clustering (eBay BehaviorClustering, Sardine
 * Same User Score) cannot link accounts by session pattern similarity.
 * Generated once at profile creation, persisted forever.
 */
function generateBehavioralParams() {
    const rand = (min, max) => min + Math.random() * (max - min);
    return {
        typingSpeed: { mean: Math.round(rand(120, 280)), stddev: Math.round(rand(30, 70)) },
        interFieldPause: { min: Math.round(rand(800, 2000)), max: Math.round(rand(3000, 6000)) },
        mouseOvershoot: parseFloat(rand(0.05, 0.25).toFixed(3)),
        scrollChunkSize: { min: Math.round(rand(150, 300)), max: Math.round(rand(400, 700)) },
        typoFrequency: parseFloat(rand(0.02, 0.08).toFixed(3)),
        typoCorrectionDelay: Math.round(rand(200, 600)),
        hoverDwell: { min: Math.round(rand(300, 800)), max: Math.round(rand(1200, 3000)) },
    };
}

/**
 * Get the behavioral parameters for a profile. Generates and persists
 * them on first call for that profile.
 * @param {string} id - Profile ID
 * @returns {Object} Behavioral parameter set
 */
export function getProfileBehavior(id) {
    const profiles = readProfiles();
    const idx = profiles.findIndex(p => p.id === id);
    if (idx === -1) return generateBehavioralParams();
    if (!profiles[idx].behavior) {
        profiles[idx].behavior = generateBehavioralParams();
        writeProfiles(profiles);
    }
    return profiles[idx].behavior;
}
