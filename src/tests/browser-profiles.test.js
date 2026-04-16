import { describe, test, expect, beforeEach, mock } from 'bun:test';

const mockExistsSync = mock(() => false);
const mockReadFileSync = mock(() => '[]');
const mockWriteFileSync = mock(() => {});
const mockMkdirSync = mock(() => {});
const mockRmSync = mock(() => {});

mock.module('fs', () => ({
    default: {
        existsSync: mockExistsSync,
        readFileSync: mockReadFileSync,
        writeFileSync: mockWriteFileSync,
        mkdirSync: mockMkdirSync,
        rmSync: mockRmSync,
    },
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    writeFileSync: mockWriteFileSync,
    mkdirSync: mockMkdirSync,
    rmSync: mockRmSync,
}));

const {
    initProfiles,
    getNextProfile,
    saveProfileUsage,
    flagProfile,
    getProfileDir,
    getProfileProxy,
    setProfileProxy,
    getProfileBehavior,
    cleanProfileServiceWorkers,
    validateProfileIsolation,
} = await import('../../worker/bots/browser-profiles.js');

function makeProfiles(overrides = []) {
    return [
        { id: 'profile-1', createdAt: '2026-01-01T00:00:00.000Z', lastUsedAt: null, usageCount: 0, flagged: false, proxyUrl: null },
        { id: 'profile-2', createdAt: '2026-01-01T00:00:00.000Z', lastUsedAt: null, usageCount: 0, flagged: false, proxyUrl: null },
        { id: 'profile-3', createdAt: '2026-01-01T00:00:00.000Z', lastUsedAt: null, usageCount: 0, flagged: false, proxyUrl: null },
        ...overrides,
    ];
}

beforeEach(() => {
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
    mockWriteFileSync.mockReset();
    mockMkdirSync.mockReset();
    mockRmSync.mockReset();

    mockExistsSync.mockImplementation(() => false);
    mockReadFileSync.mockImplementation(() => '[]');
    mockWriteFileSync.mockImplementation(() => {});
    mockMkdirSync.mockImplementation(() => {});
    mockRmSync.mockImplementation(() => {});

    delete process.env.FACEBOOK_PROXY_URL;
    delete process.env.FACEBOOK_PROXY_URL_1;
    delete process.env.FACEBOOK_PROXY_URL_2;
    delete process.env.FACEBOOK_PROXY_URL_3;
});

describe('initProfiles', () => {
    test('should create profiles dir when it does not exist', () => {
        mockExistsSync.mockImplementation(() => false);
        mockReadFileSync.mockImplementation(() => '[]');

        initProfiles(3);

        expect(mockMkdirSync).toHaveBeenCalled();
    });

    test('should write profiles.json with requested count when starting from zero', () => {
        mockExistsSync.mockImplementation(() => false);
        mockReadFileSync.mockImplementation(() => '[]');

        initProfiles(2);

        expect(mockWriteFileSync).toHaveBeenCalled();
        const written = JSON.parse(mockWriteFileSync.mock.calls[0][1]);
        expect(written).toHaveLength(2);
        expect(written[0].id).toBe('profile-1');
        expect(written[1].id).toBe('profile-2');
    });

    test('should not add profiles when existing count already meets requested count', () => {
        const existing = makeProfiles();
        mockExistsSync.mockImplementation(() => true);
        mockReadFileSync.mockImplementation(() => JSON.stringify(existing));

        initProfiles(3);

        expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    test('should create profile metadata with correct default fields', () => {
        mockExistsSync.mockImplementation(() => false);
        mockReadFileSync.mockImplementation(() => '[]');

        initProfiles(1);

        const written = JSON.parse(mockWriteFileSync.mock.calls[0][1]);
        const p = written[0];
        expect(p.usageCount).toBe(0);
        expect(p.flagged).toBe(false);
        expect(p.proxyUrl).toBeNull();
        expect(p.lastUsedAt).toBeNull();
        expect(typeof p.createdAt).toBe('string');
    });
});

describe('getNextProfile', () => {
    test('should return a non-flagged profile', () => {
        const profiles = makeProfiles();
        mockExistsSync.mockImplementation(() => true);
        mockReadFileSync.mockImplementation(() => JSON.stringify(profiles));

        const result = getNextProfile();

        expect(result.flagged).toBe(false);
        expect(result.id).toMatch(/^profile-\d+$/);
    });

    test('should skip flagged profiles and return first unflagged', () => {
        const profiles = makeProfiles();
        profiles[0].flagged = true;
        profiles[1].flagged = true;
        mockExistsSync.mockImplementation(() => true);
        mockReadFileSync.mockImplementation(() => JSON.stringify(profiles));

        const result = getNextProfile();

        expect(result.id).toBe('profile-3');
    });

    test('should throw when all profiles are flagged', () => {
        const profiles = makeProfiles();
        profiles.forEach(p => { p.flagged = true; });
        mockExistsSync.mockImplementation(() => true);
        mockReadFileSync.mockImplementation(() => JSON.stringify(profiles));

        expect(() => getNextProfile()).toThrow('No usable browser profiles available');
    });

    test('should prefer never-used profile over one with a lastUsedAt', () => {
        const profiles = makeProfiles();
        profiles[0].lastUsedAt = '2026-01-02T00:00:00.000Z';
        profiles[1].lastUsedAt = null;
        profiles[2].lastUsedAt = '2026-01-03T00:00:00.000Z';
        mockExistsSync.mockImplementation(() => true);
        mockReadFileSync.mockImplementation(() => JSON.stringify(profiles));

        const result = getNextProfile();

        expect(result.id).toBe('profile-2');
    });

    test('should update lastUsedAt on the chosen profile when returning it', () => {
        const profiles = makeProfiles();
        mockExistsSync.mockImplementation(() => true);
        mockReadFileSync.mockImplementation(() => JSON.stringify(profiles));

        const result = getNextProfile();

        expect(result.lastUsedAt).not.toBeNull();
        expect(mockWriteFileSync).toHaveBeenCalled();
    });
});

describe('saveProfileUsage', () => {
    test('should increment usageCount and update lastUsedAt', () => {
        const profiles = makeProfiles();
        mockExistsSync.mockImplementation(() => true);
        mockReadFileSync.mockImplementation(() => JSON.stringify(profiles));

        saveProfileUsage('profile-1');

        const written = JSON.parse(mockWriteFileSync.mock.calls[0][1]);
        const p = written.find(x => x.id === 'profile-1');
        expect(p.usageCount).toBe(1);
        expect(p.lastUsedAt).not.toBeNull();
    });

    test('should silently do nothing when profile id does not exist', () => {
        const profiles = makeProfiles();
        mockExistsSync.mockImplementation(() => true);
        mockReadFileSync.mockImplementation(() => JSON.stringify(profiles));

        expect(() => saveProfileUsage('profile-99')).not.toThrow();
        expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
});

describe('flagProfile', () => {
    test('should set flagged=true on the target profile', () => {
        const profiles = makeProfiles();
        mockExistsSync.mockImplementation(() => true);
        mockReadFileSync.mockImplementation(() => JSON.stringify(profiles));

        flagProfile('profile-2');

        const written = JSON.parse(mockWriteFileSync.mock.calls[0][1]);
        expect(written.find(p => p.id === 'profile-2').flagged).toBe(true);
        expect(written.find(p => p.id === 'profile-1').flagged).toBe(false);
    });

    test('should silently do nothing when profile id does not exist', () => {
        const profiles = makeProfiles();
        mockExistsSync.mockImplementation(() => true);
        mockReadFileSync.mockImplementation(() => JSON.stringify(profiles));

        expect(() => flagProfile('profile-99')).not.toThrow();
        expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
});

describe('getProfileDir', () => {
    test('should return absolute path containing the profile id', () => {
        const dir = getProfileDir('profile-1');
        expect(dir).toContain('profile-1');
        expect(dir).toContain('.browser-profiles');
    });
});

describe('getProfileProxy', () => {
    test('should return proxyUrl stored on profile when set', () => {
        const profiles = makeProfiles();
        profiles[0].proxyUrl = 'socks5://user:pass@host:1080';
        mockExistsSync.mockImplementation(() => true);
        mockReadFileSync.mockImplementation(() => JSON.stringify(profiles));

        const result = getProfileProxy('profile-1');

        expect(result).toBe('socks5://user:pass@host:1080');
    });

    test('should fall back to FACEBOOK_PROXY_URL_N env var when profile has no proxy', () => {
        const profiles = makeProfiles();
        mockExistsSync.mockImplementation(() => true);
        mockReadFileSync.mockImplementation(() => JSON.stringify(profiles));
        process.env.FACEBOOK_PROXY_URL_1 = 'http://proxy1:8080';

        const result = getProfileProxy('profile-1');

        expect(result).toBe('http://proxy1:8080');
    });

    test('should fall back to shared FACEBOOK_PROXY_URL when no per-profile env var exists', () => {
        const profiles = makeProfiles();
        mockExistsSync.mockImplementation(() => true);
        mockReadFileSync.mockImplementation(() => JSON.stringify(profiles));
        process.env.FACEBOOK_PROXY_URL = 'http://shared-proxy:8080';

        const result = getProfileProxy('profile-1');

        expect(result).toBe('http://shared-proxy:8080');
    });

    test('should return null when no proxy is configured at all', () => {
        const profiles = makeProfiles();
        mockExistsSync.mockImplementation(() => true);
        mockReadFileSync.mockImplementation(() => JSON.stringify(profiles));

        const result = getProfileProxy('profile-1');

        expect(result).toBeNull();
    });
});

describe('setProfileProxy', () => {
    test('should persist the proxy URL on the specified profile', () => {
        const profiles = makeProfiles();
        mockExistsSync.mockImplementation(() => true);
        mockReadFileSync.mockImplementation(() => JSON.stringify(profiles));

        setProfileProxy('profile-2', 'socks5://p2:pass@host:1080');

        const written = JSON.parse(mockWriteFileSync.mock.calls[0][1]);
        expect(written.find(p => p.id === 'profile-2').proxyUrl).toBe('socks5://p2:pass@host:1080');
    });
});

describe('getProfileBehavior', () => {
    test('should generate and persist behavior params on first call', () => {
        const profiles = makeProfiles();
        mockExistsSync.mockImplementation(() => true);
        mockReadFileSync.mockImplementation(() => JSON.stringify(profiles));

        const behavior = getProfileBehavior('profile-1');

        expect(behavior).toBeDefined();
        expect(typeof behavior.typingSpeed).toBe('object');
        expect(typeof behavior.mouseOvershoot).toBe('number');
        expect(mockWriteFileSync).toHaveBeenCalled();
    });

    test('should return already-persisted behavior without re-writing when already set', () => {
        const profiles = makeProfiles();
        const existingBehavior = { typingSpeed: { mean: 150, stddev: 40 }, mouseOvershoot: 0.1 };
        profiles[0].behavior = existingBehavior;
        mockExistsSync.mockImplementation(() => true);
        mockReadFileSync.mockImplementation(() => JSON.stringify(profiles));

        const behavior = getProfileBehavior('profile-1');

        expect(behavior).toEqual(existingBehavior);
        expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    test('should return generated params even when profile id is not found', () => {
        mockExistsSync.mockImplementation(() => true);
        mockReadFileSync.mockImplementation(() => '[]');

        const behavior = getProfileBehavior('profile-99');

        expect(behavior).toBeDefined();
        expect(typeof behavior.typingSpeed).toBe('object');
    });
});

describe('cleanProfileServiceWorkers', () => {
    test('should call rmSync on existing service_worker directories', () => {
        mockExistsSync.mockImplementation((p) => p.includes('service_worker'));

        cleanProfileServiceWorkers('profile-1');

        expect(mockRmSync).toHaveBeenCalled();
        const removedPaths = mockRmSync.mock.calls.map(c => c[0]);
        expect(removedPaths.some(p => p.includes('service_worker'))).toBe(true);
    });

    test('should not call rmSync when no SW or favicon directories exist', () => {
        mockExistsSync.mockImplementation(() => false);

        cleanProfileServiceWorkers('profile-1');

        expect(mockRmSync).not.toHaveBeenCalled();
    });

    test('should also remove Favicons directory when it exists', () => {
        mockExistsSync.mockImplementation((p) => p.includes('Favicons'));

        cleanProfileServiceWorkers('profile-1');

        const removedPaths = mockRmSync.mock.calls.map(c => c[0]);
        expect(removedPaths.some(p => p.includes('Favicons'))).toBe(true);
    });
});

describe('validateProfileIsolation', () => {
    test('should warn when a profile has no proxy assigned', () => {
        const profiles = makeProfiles();
        mockExistsSync.mockImplementation(() => true);
        mockReadFileSync.mockImplementation(() => JSON.stringify(profiles));

        const { warnings } = validateProfileIsolation();

        expect(warnings.some(w => w.includes('No proxy assigned'))).toBe(true);
    });

    test('should warn when two profiles share the same proxy', () => {
        const profiles = makeProfiles();
        profiles[0].proxyUrl = 'socks5://shared:1080';
        profiles[1].proxyUrl = 'socks5://shared:1080';
        profiles[2].proxyUrl = 'socks5://unique:1081';
        mockExistsSync.mockImplementation(() => true);
        mockReadFileSync.mockImplementation(() => JSON.stringify(profiles));

        const { warnings } = validateProfileIsolation();

        expect(warnings.some(w => w.includes('CRITICAL') && w.includes('share proxy'))).toBe(true);
    });

    test('should warn when a profile has no behavioral params', () => {
        const profiles = makeProfiles();
        profiles.forEach(p => { p.proxyUrl = `socks5://proxy-${p.id}:1080`; });
        mockExistsSync.mockImplementation(() => true);
        mockReadFileSync.mockImplementation(() => JSON.stringify(profiles));

        const { warnings } = validateProfileIsolation();

        expect(warnings.some(w => w.includes('behavioral params'))).toBe(true);
    });

    test('should return empty warnings when all profiles are fully isolated', () => {
        const profiles = makeProfiles();
        profiles[0].proxyUrl = 'socks5://p1:1080';
        profiles[1].proxyUrl = 'socks5://p2:1081';
        profiles[2].proxyUrl = 'socks5://p3:1082';
        profiles.forEach(p => { p.behavior = { typingSpeed: { mean: 150, stddev: 40 } }; });
        mockExistsSync.mockImplementation(() => true);
        mockReadFileSync.mockImplementation(() => JSON.stringify(profiles));

        const { warnings } = validateProfileIsolation();

        expect(warnings).toHaveLength(0);
    });
});
