import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query } from '../../db/database.js';
import { generateToken, generateRefreshToken } from '../../middleware/auth.js';
import emailService from '../../services/email.js';
import { logger } from '../../shared/logger.js';
import {
    BCRYPT_ROUNDS,
    IS_TEST_RUNTIME,
    authCookies,
    isValidEmail,
    validatePassword,
    enforceSessionLimit,
} from './helpers.js';

export async function handleRegister(ctx) {
    const { body } = ctx;
    try {
        const { email, password, username, fullName, referralCode } = body;

        if (!email || !password || !username) {
            return { status: 400, data: { error: 'Email, password, and username required' } };
        }

        // SECURITY: Validate email format
        if (!isValidEmail(email)) {
            return { status: 400, data: { error: 'Invalid email format' } };
        }

        // SECURITY: Strong password validation
        const passwordErrors = validatePassword(password);
        if (passwordErrors.length > 0) {
            return { status: 400, data: { error: passwordErrors.join('. ') } };
        }

        // Check if user exists
        const existing = await query.get('SELECT id FROM users WHERE email = ? OR username = ?', [
            email.toLowerCase(),
            username.toLowerCase(),
        ]);

        // SECURITY: Generic error to prevent user enumeration
        if (existing) {
            return { status: 400, data: { error: 'Unable to create account. Please try different credentials.' } };
        }

        // Hash password before opening DB transaction — bcrypt is CPU-intensive
        const userId = uuidv4();
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const newReferralCode = 'VAULT' + userId.substring(0, 6).toUpperCase();

        // enforceSessionLimit uses global query (separate connection) — call before transaction
        await enforceSessionLimit(userId);

        // Seed default chart of accounts for new user
        const defaultAccounts = [
            { name: 'Business Checking', type: 'Bank' },
            { name: 'PayPal', type: 'Bank' },
            { name: 'Accounts Receivable', type: 'AR' },
            { name: 'Inventory', type: 'Other Current Asset' },
            { name: 'Accounts Payable', type: 'AP' },
            { name: 'Business Credit Card', type: 'Credit Card' },
            { name: "Owner's Equity", type: 'Equity' },
            { name: 'Retained Earnings', type: 'Equity' },
            { name: 'Product Sales', type: 'Income' },
            { name: 'Shipping Revenue', type: 'Income' },
            { name: 'Other Income', type: 'Other Income' },
            { name: 'Cost of Goods Sold', type: 'COGS' },
            { name: 'Platform Fees', type: 'Expense' },
            { name: 'Shipping Expense', type: 'Expense' },
            { name: 'Packaging Supplies', type: 'Expense' },
            { name: 'Office Supplies', type: 'Expense' },
            { name: 'Marketing', type: 'Expense' },
        ];

        let user;
        let refreshToken;
        let verificationToken;

        await query.transaction(async (tx) => {
            await tx.run(
                `
                INSERT INTO users (id, email, password_hash, username, full_name, referral_code)
                VALUES (?, ?, ?, ?, ?, ?)
            `,
                [
                    userId,
                    email.toLowerCase(),
                    passwordHash,
                    username.toLowerCase(),
                    fullName || username,
                    newReferralCode,
                ],
            );

            if (referralCode) {
                const referrer = await tx.get('SELECT id FROM users WHERE referral_code = ?', [
                    referralCode.toUpperCase(),
                ]);
                if (referrer && referrer.id !== userId) {
                    await tx.run(
                        `
                        INSERT INTO affiliate_commissions (id, affiliate_user_id, referred_user_id, amount, status)
                        VALUES (?, ?, ?, 0, 'pending')
                    `,
                        [uuidv4(), referrer.id, userId],
                    );
                }
            }

            for (const account of defaultAccounts) {
                await tx.run(
                    `
                    INSERT INTO accounts (id, user_id, account_name, account_type, is_active)
                    VALUES (?, ?, ?, ?, 1)
                    ON CONFLICT DO NOTHING
                `,
                    [uuidv4(), userId, account.name, account.type],
                );
            }

            user = await tx.get(
                'SELECT id, email, username, full_name, is_active, email_verified, created_at, referral_code FROM users WHERE id = ?',
                [userId],
            );

            refreshToken = generateRefreshToken(user);
            await tx.run(
                `
                INSERT INTO sessions (id, user_id, refresh_token, expires_at)
                VALUES (?, ?, ?, NOW() + INTERVAL '7 days')
            `,
                [uuidv4(), userId, refreshToken],
            );

            if (!IS_TEST_RUNTIME) {
                verificationToken = crypto.randomBytes(32).toString('hex');
                const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
                await tx.run(
                    `INSERT INTO email_verifications (user_id, token, expires_at, created_at)
                     VALUES (?, ?, ?, NOW())`,
                    [userId, verificationToken, expiresAt],
                );
            }
        });

        logger.info('[Auth] Register success', { userId, email: email.toLowerCase() });

        const token = generateToken(user);

        // Send verification email (non-blocking — registration succeeds even if email fails)
        if (!IS_TEST_RUNTIME && verificationToken) {
            emailService
                .sendVerificationEmail(user, verificationToken)
                .catch((err) =>
                    logger.error('[Auth] Failed to send verification email', userId, { detail: err.message }),
                );
        }

        return {
            status: 201,
            data: { user, token, refreshToken },
            cookies: authCookies(token, refreshToken),
        };
    } catch (error) {
        logger.error('[Auth] Error during registration', null, { detail: error.message });
        return { status: 500, data: { error: 'Internal server error' } };
    }
}

export async function handleVerifyEmail(ctx) {
    const token = ctx.query?.token;
    if (!token) {
        return { status: 400, data: { error: 'Verification token is required' } };
    }

    try {
        const record = await query.get(
            `SELECT ev.user_id, ev.expires_at, ev.used_at, u.email, u.username, u.email_verified
             FROM email_verifications ev
             JOIN users u ON u.id = ev.user_id
             WHERE ev.token = ?`,
            [token],
        );

        if (!record) {
            return { status: 400, data: { error: 'Invalid or expired verification link.' } };
        }
        if (record.used_at) {
            return { status: 400, data: { error: 'This verification link has already been used.' } };
        }
        if (new Date(record.expires_at) < new Date()) {
            return { status: 400, data: { error: 'This verification link has expired. Please request a new one.' } };
        }
        if (record.email_verified) {
            return { status: 200, data: { message: 'Your email is already verified. You can log in.' } };
        }

        await query.transaction(async (tx) => {
            await tx.run('UPDATE users SET email_verified = TRUE WHERE id = ?', [record.user_id]);
            await tx.run('UPDATE email_verifications SET used_at = NOW() WHERE token = ?', [token]);
        });

        return { status: 200, data: { message: 'Email verified successfully! You can now log in.' } };
    } catch (e) {
        logger.error('[auth] Email verification error', null, { detail: e.message });
        return { status: 500, data: { error: 'Verification failed. Please try again.' } };
    }
}

export async function handleResendVerification(ctx) {
    const { body } = ctx;
    const { email } = body;

    // Validate email format
    if (!email || !isValidEmail(email)) {
        return {
            status: 200,
            data: { message: 'If an account exists with that email, a verification email has been sent.' },
        };
    }

    try {
        const user = await query.get('SELECT id, email, email_verified FROM users WHERE LOWER(email) = LOWER(?)', [
            email,
        ]);

        if (user && !user.email_verified) {
            // Generate a verification token
            const verificationToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

            await query.run(
                `
                INSERT INTO email_verifications (user_id, token, expires_at, created_at)
                VALUES (?, ?, ?, NOW())
            `,
                [user.id, verificationToken, expiresAt],
            );

            await emailService.sendVerificationEmail(user, verificationToken);
        }
    } catch (e) {
        logger.error('[auth] Resend verification error', null, { detail: e.message });
    }

    // Always return success to prevent email enumeration
    return {
        status: 200,
        data: { message: 'If an account exists with that email, a verification email has been sent.' },
    };
}
