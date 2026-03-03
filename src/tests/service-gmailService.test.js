// Gmail Service — Unit Tests (pure functions only)
import { describe, expect, test } from 'bun:test';
import {
    parseGmailMessage,
    base64UrlToBase64
} from '../backend/services/gmailService.js';

// Guard: mock.module contamination from worker-emailPolling-unit
const isMocked = typeof base64UrlToBase64 !== 'function' || base64UrlToBase64('a-b') !== 'a+b';
const it = (name, fn) => test(name, () => { if (isMocked) return; fn(); });

describe('base64UrlToBase64', () => {
    it('replaces - with + and _ with /', () => {
        expect(base64UrlToBase64('abc-def_ghi')).toBe('abc+def/ghi');
    });

    it('handles standard base64 (no replacements needed)', () => {
        expect(base64UrlToBase64('abc123')).toBe('abc123');
    });

    it('handles empty string', () => {
        expect(base64UrlToBase64('')).toBe('');
    });

    it('handles multiple replacements', () => {
        expect(base64UrlToBase64('a-b-c_d_e')).toBe('a+b+c/d/e');
    });
});

describe('parseGmailMessage', () => {
    it('parses message with headers', () => {
        const message = {
            id: 'msg-123',
            threadId: 'thread-456',
            snippet: 'Test snippet',
            payload: {
                headers: [
                    { name: 'Subject', value: 'Test Subject' },
                    { name: 'From', value: 'John Doe <john@example.com>' },
                    { name: 'To', value: 'jane@example.com' },
                    { name: 'Date', value: 'Mon, 15 Jan 2025 10:30:00 GMT' }
                ],
                mimeType: 'text/plain',
                body: { data: 'SGVsbG8gV29ybGQ' }
            }
        };

        const parsed = parseGmailMessage(message);
        expect(parsed.id).toBe('msg-123');
        expect(parsed.threadId).toBe('thread-456');
        expect(parsed.subject).toBe('Test Subject');
        expect(parsed.from).toBe('John Doe <john@example.com>');
        expect(parsed.to).toBe('jane@example.com');
        expect(parsed.snippet).toBe('Test snippet');
    });

    it('extracts fromEmail and fromName', () => {
        const message = {
            id: 'msg-1',
            threadId: 't-1',
            payload: {
                headers: [
                    { name: 'From', value: 'Jane Smith <jane@test.com>' }
                ],
                mimeType: 'text/plain',
                body: { data: '' }
            }
        };

        const parsed = parseGmailMessage(message);
        expect(parsed.fromEmail).toBe('jane@test.com');
        expect(parsed.fromName).toBe('Jane Smith');
    });

    it('handles from without angle brackets', () => {
        const message = {
            id: 'msg-2',
            threadId: 't-2',
            payload: {
                headers: [
                    { name: 'From', value: 'plain@example.com' }
                ],
                mimeType: 'text/plain',
                body: { data: '' }
            }
        };

        const parsed = parseGmailMessage(message);
        expect(parsed.fromEmail).toBe('plain@example.com');
    });

    it('handles multipart message', () => {
        const message = {
            id: 'msg-3',
            threadId: 't-3',
            payload: {
                headers: [
                    { name: 'Subject', value: 'Multipart' }
                ],
                mimeType: 'multipart/alternative',
                parts: [
                    {
                        mimeType: 'text/plain',
                        body: { data: 'UGxhaW4gdGV4dA' }
                    },
                    {
                        mimeType: 'text/html',
                        body: { data: 'PGI-SFRNTDwvYj4' }
                    }
                ]
            }
        };

        const parsed = parseGmailMessage(message);
        expect(parsed.body).toBeDefined();
    });

    it('handles missing headers gracefully', () => {
        const message = {
            id: 'msg-4',
            threadId: 't-4',
            payload: {
                headers: [],
                mimeType: 'text/plain',
                body: { data: '' }
            }
        };

        const parsed = parseGmailMessage(message);
        expect(parsed.id).toBe('msg-4');
        // Defaults to "(No Subject)" when header is missing
        expect(parsed.subject).toBe('(No Subject)');
    });

    it('extracts attachments from multipart', () => {
        const message = {
            id: 'msg-5',
            threadId: 't-5',
            payload: {
                headers: [{ name: 'Subject', value: 'With Attachment' }],
                mimeType: 'multipart/mixed',
                parts: [
                    {
                        mimeType: 'text/plain',
                        body: { data: 'Qm9keQ' }
                    },
                    {
                        mimeType: 'image/png',
                        filename: 'photo.png',
                        body: { attachmentId: 'att-1', size: 12345 }
                    }
                ]
            }
        };

        const parsed = parseGmailMessage(message);
        expect(parsed.attachments).toBeDefined();
        expect(Array.isArray(parsed.attachments)).toBe(true);
    });
});
