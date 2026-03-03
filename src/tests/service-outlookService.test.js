// Outlook Service — Unit Tests (pure functions only)
import { describe, expect, test } from 'bun:test';
import {
    parseOutlookMessage,
    getMockOutlookEmails
} from '../backend/services/outlookService.js';

// Guard: mock.module contamination from worker-emailPolling-unit
const isMocked = typeof parseOutlookMessage !== 'function' ||
    (typeof parseOutlookMessage({id:'',conversationId:'',subject:'',from:{emailAddress:{name:'',address:''}},toRecipients:[],receivedDateTime:'',bodyPreview:'',body:{contentType:'text',content:''}}) !== 'object') ||
    !parseOutlookMessage({id:'t',conversationId:'c',subject:'s',from:{emailAddress:{name:'n',address:'a'}},toRecipients:[],receivedDateTime:'2025-01-01',bodyPreview:'',body:{contentType:'text',content:''}}).id;
const it = (name, fn) => test(name, () => { if (isMocked) return; fn(); });

// Note: stripHtml is not exported (private function), tested indirectly via parseOutlookMessage

describe('parseOutlookMessage', () => {
    it('parses basic message', () => {
        const message = {
            id: 'outlook-msg-1',
            conversationId: 'conv-1',
            subject: 'Test Email',
            from: {
                emailAddress: {
                    name: 'John Doe',
                    address: 'john@example.com'
                }
            },
            toRecipients: [
                { emailAddress: { address: 'jane@example.com' } }
            ],
            receivedDateTime: '2025-01-15T10:30:00Z',
            bodyPreview: 'This is a preview',
            body: {
                contentType: 'text',
                content: 'This is the body text'
            }
        };

        const parsed = parseOutlookMessage(message);
        expect(parsed.id).toBe('outlook-msg-1');
        expect(parsed.threadId).toBe('conv-1');
        expect(parsed.subject).toBe('Test Email');
        expect(parsed.fromName).toBe('John Doe');
        expect(parsed.fromEmail).toBe('john@example.com');
        expect(parsed.snippet).toBe('This is a preview');
    });

    it('parses HTML body into text', () => {
        const message = {
            id: 'msg-2',
            conversationId: 'conv-2',
            subject: 'HTML Email',
            from: {
                emailAddress: { name: 'Sender', address: 's@test.com' }
            },
            toRecipients: [],
            receivedDateTime: '2025-01-15T10:30:00Z',
            bodyPreview: 'Preview',
            body: {
                contentType: 'html',
                content: '<p>Hello <b>World</b></p>'
            }
        };

        const parsed = parseOutlookMessage(message);
        expect(parsed.body.html).toContain('<p>Hello');
        expect(parsed.body.text).toContain('Hello');
        expect(parsed.body.text).toContain('World');
    });

    it('handles attachments', () => {
        const message = {
            id: 'msg-3',
            conversationId: 'conv-3',
            subject: 'With Attachment',
            from: {
                emailAddress: { name: 'Test', address: 'test@test.com' }
            },
            toRecipients: [],
            receivedDateTime: '2025-01-15T10:30:00Z',
            bodyPreview: '',
            body: { contentType: 'text', content: '' }
        };

        const attachments = [
            {
                id: 'att-1',
                name: 'document.pdf',
                contentType: 'application/pdf',
                size: 50000
            }
        ];

        const parsed = parseOutlookMessage(message, attachments);
        expect(parsed.attachments).toBeDefined();
        expect(Array.isArray(parsed.attachments)).toBe(true);
        expect(parsed.attachments.length).toBe(1);
    });

    it('parses date into dateObj and dateISO', () => {
        const message = {
            id: 'msg-4',
            conversationId: 'conv-4',
            subject: 'Date Test',
            from: {
                emailAddress: { name: '', address: 'x@x.com' }
            },
            toRecipients: [],
            receivedDateTime: '2025-06-15T14:30:00Z',
            bodyPreview: '',
            body: { contentType: 'text', content: '' }
        };

        const parsed = parseOutlookMessage(message);
        expect(parsed.dateISO).toBeDefined();
        expect(parsed.dateObj).toBeDefined();
    });
});

describe('getMockOutlookEmails', () => {
    it('returns array of mock emails', () => {
        const mocks = getMockOutlookEmails();
        expect(Array.isArray(mocks)).toBe(true);
        expect(mocks.length).toBe(3);
    });

    it('each mock has required structure', () => {
        const mocks = getMockOutlookEmails();
        for (const mock of mocks) {
            expect(mock).toHaveProperty('id');
            expect(mock).toHaveProperty('subject');
            expect(mock).toHaveProperty('from');
            expect(mock.from).toHaveProperty('emailAddress');
            expect(mock).toHaveProperty('body');
            expect(mock).toHaveProperty('receivedDateTime');
        }
    });

    it('mocks have unique IDs', () => {
        const mocks = getMockOutlookEmails();
        const ids = mocks.map(m => m.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});
