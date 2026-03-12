// Email Service
// Handles sending verification and security-related emails

import nodemailer from 'nodemailer';
import { logger } from '../shared/logger.js';

/**
 * Escape HTML special characters to prevent XSS in email templates
 */
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@vaultlister.com';
const SMTP_HOST = process.env.SMTP_HOST || 'localhost';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

let transporter = null;

/**
 * Initialize email transporter
 */
export function initEmailService() {
    if (SMTP_USER && SMTP_PASS) {
        transporter = nodemailer.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_SECURE,
            auth: {
                user: SMTP_USER,
                pass: SMTP_PASS
            }
        });

        logger.info('[Email] Service initialized with SMTP');
        return true;
    }

    // Development mode - log emails instead of sending
    logger.info('[Email] No SMTP credentials configured - emails will be logged to console');
    return false;
}

/**
 * Send an email
 */
async function sendEmail(to, subject, html, text) {
    const mailOptions = {
        from: EMAIL_FROM,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, '')
    };

    if (transporter) {
        try {
            const result = await transporter.sendMail(mailOptions);
            logger.info(`[Email] Sent to ${to.replace(/(.{2}).*(@.*)/, '$1***$2')}: ${subject}`);
            return { success: true, messageId: result.messageId };
        } catch (error) {
            logger.error('[Email] Send failed', null, { detail: error.message });
            return { success: false, error: error.message };
        }
    }

    // Development mode - log email details via structured logger
    logger.info('[Email] DEV MODE', null, { to: to.replace(/(.{2}).*(@.*)/, '$1***$2'), subject, body: (text || html).slice(0, 200) });

    return { success: true, messageId: 'dev-' + Date.now() };
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(user, token) {
    const verifyUrl = `${APP_URL}/#verify-email?token=${token}`;

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">Verify Your Email Address</h2>
            <p>Hi ${escapeHtml(user.username || user.email)},</p>
            <p>Thank you for registering with VaultLister. Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${verifyUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Verify Email Address
                </a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #6B7280;">${verifyUrl}</p>
            <p style="color: #9CA3AF; font-size: 14px;">This link expires in 24 hours.</p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #9CA3AF; font-size: 12px;">
                If you didn't create an account with VaultLister, you can safely ignore this email.
            </p>
        </div>
    `;

    return sendEmail(user.email, 'Verify Your VaultLister Account', html);
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(user, token) {
    const resetUrl = `${APP_URL}/#reset-password?token=${token}`;

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">Reset Your Password</h2>
            <p>Hi ${escapeHtml(user.username || user.email)},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Reset Password
                </a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #6B7280;">${resetUrl}</p>
            <p style="color: #9CA3AF; font-size: 14px;">This link expires in 1 hour.</p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #9CA3AF; font-size: 12px;">
                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
            </p>
        </div>
    `;

    return sendEmail(user.email, 'Reset Your VaultLister Password', html);
}

/**
 * Send MFA enabled notification
 */
export async function sendMFAEnabledEmail(user) {
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #059669;">Two-Factor Authentication Enabled</h2>
            <p>Hi ${escapeHtml(user.username || user.email)},</p>
            <p>Two-factor authentication has been successfully enabled on your VaultLister account.</p>
            <p>From now on, you'll need to enter a code from your authenticator app when logging in.</p>
            <div style="background-color: #FEF3C7; padding: 16px; border-radius: 6px; margin: 20px 0;">
                <p style="color: #92400E; margin: 0;">
                    <strong>Important:</strong> Keep your backup codes in a safe place. You'll need them if you lose access to your authenticator app.
                </p>
            </div>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #9CA3AF; font-size: 12px;">
                If you didn't enable 2FA, please contact support immediately and change your password.
            </p>
        </div>
    `;

    return sendEmail(user.email, 'Two-Factor Authentication Enabled - VaultLister', html);
}

/**
 * Send MFA disabled notification
 */
export async function sendMFADisabledEmail(user) {
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #DC2626;">Two-Factor Authentication Disabled</h2>
            <p>Hi ${escapeHtml(user.username || user.email)},</p>
            <p>Two-factor authentication has been disabled on your VaultLister account.</p>
            <p>Your account is now less secure. We recommend re-enabling 2FA for better protection.</p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #9CA3AF; font-size: 12px;">
                If you didn't disable 2FA, please contact support immediately and change your password.
            </p>
        </div>
    `;

    return sendEmail(user.email, 'Two-Factor Authentication Disabled - VaultLister', html);
}

/**
 * Send security alert email
 */
export async function sendSecurityAlertEmail(user, alertType, details) {
    const alertMessages = {
        'new_login': 'New login detected on your account',
        'password_changed': 'Your password was changed',
        'suspicious_activity': 'Suspicious activity detected',
        'backup_code_used': 'A backup code was used to access your account'
    };

    const safeUsername = escapeHtml(user.username || user.email);
    const safeAlertMessage = escapeHtml(alertMessages[alertType] || alertType);
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #DC2626;">Security Alert</h2>
            <p>Hi ${safeUsername},</p>
            <p><strong>${safeAlertMessage}</strong></p>
            ${details ? `
                <div style="background-color: #F3F4F6; padding: 16px; border-radius: 6px; margin: 20px 0;">
                    <p style="margin: 0; color: #374151;">
                        <strong>Details:</strong><br>
                        ${Object.entries(details).map(([key, value]) => `${escapeHtml(key)}: ${escapeHtml(value)}`).join('<br>')}
                    </p>
                </div>
            ` : ''}
            <p>If this wasn't you, please secure your account immediately by changing your password.</p>
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #9CA3AF; font-size: 12px;">
                This is an automated security notification from VaultLister.
            </p>
        </div>
    `;

    return sendEmail(user.email, `Security Alert: ${alertMessages[alertType] || alertType}`, html);
}

export async function sendAutomationNotificationEmail(user, notification) {
    const statusColors = { success: '#059669', error: '#DC2626', warning: '#D97706' };
    const color = statusColors[notification.type] || '#4F46E5';
    const safeTitle = escapeHtml(notification.title || 'Automation Update');
    const safeMessage = escapeHtml(notification.message || '');
    const safeUser = escapeHtml(user.username || user.email);

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: ${color};">${safeTitle}</h2>
            <p>Hi ${safeUser},</p>
            <p>${safeMessage}</p>
            ${notification.data ? `
                <div style="background-color: #F3F4F6; padding: 16px; border-radius: 6px; margin: 20px 0;">
                    <p style="margin: 0; color: #374151;">
                        <strong>Details:</strong><br>
                        Platform: ${escapeHtml(notification.data.platform || 'N/A')}<br>
                        Rule: ${escapeHtml(notification.data.ruleName || 'N/A')}
                    </p>
                </div>
            ` : ''}
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #9CA3AF; font-size: 12px;">
                This is an automated notification from VaultLister.
            </p>
        </div>
    `;

    return sendEmail(user.email, safeTitle + ' - VaultLister', html);
}

export async function sendDailySummaryEmail(user, stats) {
    const { totalRuns, successRuns, failedRuns, totalItems, topRules } = stats;
    const successRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0;
    const safeUser = escapeHtml(user.username || user.email);

    const topRulesHtml = (topRules || []).map(r =>
        `<tr><td style="padding:6px 12px;border-bottom:1px solid #E5E7EB;">${escapeHtml(r.automation_name)}</td>` +
        `<td style="padding:6px 12px;border-bottom:1px solid #E5E7EB;text-align:center;">${r.runs}</td>` +
        `<td style="padding:6px 12px;border-bottom:1px solid #E5E7EB;text-align:center;color:${r.successes === r.runs ? '#059669' : '#D97706'};">${r.runs > 0 ? Math.round((r.successes / r.runs) * 100) : 0}%</td></tr>`
    ).join('');

    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4F46E5;">Daily Automation Summary</h2>
            <p>Hi ${safeUser},</p>
            <p>Here's your automation activity for the last 24 hours:</p>
            <div style="display:flex;gap:16px;margin:20px 0;">
                <div style="flex:1;background:#F0FDF4;padding:16px;border-radius:8px;text-align:center;">
                    <div style="font-size:24px;font-weight:700;color:#059669;">${successRuns}</div>
                    <div style="font-size:12px;color:#6B7280;">Successful</div>
                </div>
                <div style="flex:1;background:${failedRuns > 0 ? '#FEF2F2' : '#F9FAFB'};padding:16px;border-radius:8px;text-align:center;">
                    <div style="font-size:24px;font-weight:700;color:${failedRuns > 0 ? '#DC2626' : '#6B7280'};">${failedRuns}</div>
                    <div style="font-size:12px;color:#6B7280;">Failed</div>
                </div>
                <div style="flex:1;background:#F9FAFB;padding:16px;border-radius:8px;text-align:center;">
                    <div style="font-size:24px;font-weight:700;color:#374151;">${totalItems}</div>
                    <div style="font-size:12px;color:#6B7280;">Items Processed</div>
                </div>
                <div style="flex:1;background:#EFF6FF;padding:16px;border-radius:8px;text-align:center;">
                    <div style="font-size:24px;font-weight:700;color:#4F46E5;">${successRate}%</div>
                    <div style="font-size:12px;color:#6B7280;">Success Rate</div>
                </div>
            </div>
            ${topRulesHtml ? `
                <h3 style="color:#374151;font-size:16px;margin-top:24px;">Top Automations</h3>
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                    <thead><tr style="background:#F9FAFB;">
                        <th style="padding:8px 12px;text-align:left;">Rule</th>
                        <th style="padding:8px 12px;text-align:center;">Runs</th>
                        <th style="padding:8px 12px;text-align:center;">Success</th>
                    </tr></thead>
                    <tbody>${topRulesHtml}</tbody>
                </table>
            ` : ''}
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            <p style="color: #9CA3AF; font-size: 12px;">
                This is your daily automation summary from VaultLister. Manage preferences in Settings.
            </p>
        </div>
    `;

    return sendEmail(user.email, `Daily Summary: ${totalRuns} runs, ${successRate}% success - VaultLister`, html);
}

export default {
    init: initEmailService,
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendMFAEnabledEmail,
    sendMFADisabledEmail,
    sendSecurityAlertEmail,
    sendAutomationNotificationEmail,
    sendDailySummaryEmail
};
