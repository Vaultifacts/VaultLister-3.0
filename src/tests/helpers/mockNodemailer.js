// Mock Nodemailer Helper
// Replaces the nodemailer module with a tracked mock
// Usage:
//   import { installNodemailerMock } from './helpers/mockNodemailer.js';
//   const mailer = installNodemailerMock();
//   // ... import module under test ...
//   expect(mailer.sendMail).toHaveBeenCalledWith(...)

import { mock } from 'bun:test';

/**
 * Install a mock.module() override for nodemailer.
 * Returns handles to the mock functions for assertions.
 */
export function installNodemailerMock() {
    const sendMail = mock(async (opts) => ({
        messageId: `mock-${Date.now()}@test.local`,
        accepted: [opts.to],
        rejected: [],
    }));

    const verify = mock(async () => true);

    const transporter = {
        sendMail,
        verify,
        close: mock(() => {}),
    };

    const createTransport = mock(() => transporter);

    mock.module('nodemailer', () => ({
        createTransport,
        default: { createTransport },
    }));

    return {
        createTransport,
        sendMail,
        verify,
        transporter,

        /** Make sendMail fail */
        failWith(error) {
            sendMail.mockRejectedValue(error instanceof Error ? error : new Error(error));
        },

        /** Reset all mocks */
        reset() {
            sendMail.mockClear();
            sendMail.mockResolvedValue({ messageId: `mock-${Date.now()}@test.local`, accepted: [], rejected: [] });
            verify.mockClear();
            createTransport.mockClear();
        },
    };
}
