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
            profiles.push({ id, createdAt: now, lastUsedAt: null, usageCount: 0, flagged: false });
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
