import { describe, expect, mock, test } from 'bun:test';

const mockProfiles = {
    initProfiles: mock(() => {}),
    getNextProfile: mock(() => ({ id: 'profile-1' })),
    saveProfileUsage: mock(() => {}),
    flagProfile: mock(() => {}),
    getProfileDir: mock((id) => `data/.browser-profiles/${id}`),
    getProfileProxy: mock(() => null),
    getProfileBehavior: mock(() => ({ typingDelayMs: 0 })),
};

const mockBotSafety = {
    enhancedHumanType: mock(async () => {}),
};

const mockStealth = {
    launchCamoufox: mock(async () => ({ browser: {}, page: {} })),
    humanClick: mock(async () => {}),
    mouseWiggle: mock(async () => {}),
};

mock.module('../../worker/bots/browser-profiles.js', () => mockProfiles);
mock.module('../../worker/bots/bot-safety.js', () => mockBotSafety);
mock.module('../../worker/bots/stealth.js', () => mockStealth);

const { preloadFacebookPublishDependencies } = await import('../backend/services/platformSync/facebookPublish.js');
const { preloadGrailedPublishDependencies } = await import('../backend/services/platformSync/grailedPublish.js');
const { preloadMercariPublishDependencies } = await import('../backend/services/platformSync/mercariPublish.js');
const { preloadWhatnotPublishDependencies } = await import('../backend/services/platformSync/whatnotPublish.js');

describe('platform publish dependency preloading', () => {
    test('preloads lazy bot modules for automation publish services', async () => {
        const dependencySets = await Promise.all([
            preloadFacebookPublishDependencies(),
            preloadGrailedPublishDependencies(),
            preloadMercariPublishDependencies(),
            preloadWhatnotPublishDependencies(),
        ]);

        for (const dependencies of dependencySets) {
            expect(dependencies.profiles.getProfileBehavior).toBe(mockProfiles.getProfileBehavior);
            expect(dependencies.botSafety.enhancedHumanType).toBe(mockBotSafety.enhancedHumanType);
            expect(dependencies.stealth.humanClick).toBe(mockStealth.humanClick);
        }
    });
});
