// Mock Notion Client Helper
// Replaces @notionhq/client with tracked mocks
// Usage:
//   import { installNotionMock } from './helpers/mockNotionClient.js';
//   const notion = installNotionMock();
//   // ... import module under test ...
//   expect(notion.pages.create).toHaveBeenCalled();

import { mock } from 'bun:test';

/**
 * Install a mock.module() override for @notionhq/client.
 * Returns handles to all mock methods for assertions.
 */
export function installNotionMock() {
    const databases = {
        list: mock(async () => ({ results: [], has_more: false })),
        query: mock(async () => ({ results: [], has_more: false })),
        create: mock(async () => ({ id: 'mock-db-id', title: [] })),
        update: mock(async () => ({ id: 'mock-db-id' })),
        retrieve: mock(async () => ({ id: 'mock-db-id', properties: {} })),
    };

    const pages = {
        create: mock(async () => ({ id: 'mock-page-id', properties: {} })),
        update: mock(async () => ({ id: 'mock-page-id' })),
        retrieve: mock(async () => ({ id: 'mock-page-id', properties: {} })),
    };

    const blocks = {
        children: {
            list: mock(async () => ({ results: [], has_more: false })),
            append: mock(async () => ({ results: [] })),
        },
        retrieve: mock(async () => ({ id: 'mock-block-id' })),
    };

    const search = mock(async () => ({ results: [], has_more: false }));
    const users = { list: mock(async () => ({ results: [] })) };

    class MockClient {
        constructor() {
            this.databases = databases;
            this.pages = pages;
            this.blocks = blocks;
            this.search = search;
            this.users = users;
        }
    }

    mock.module('@notionhq/client', () => ({
        Client: MockClient,
        default: { Client: MockClient },
    }));

    return {
        databases,
        pages,
        blocks,
        search,
        users,
        ClientClass: MockClient,

        /** Reset all mocks to defaults */
        reset() {
            Object.values(databases).forEach(fn => fn.mockClear());
            Object.values(pages).forEach(fn => fn.mockClear());
            Object.values(blocks.children).forEach(fn => fn.mockClear());
            blocks.retrieve.mockClear();
            search.mockClear();
            users.list.mockClear();
        },
    };
}
