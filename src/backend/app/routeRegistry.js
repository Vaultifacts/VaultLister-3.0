// src/backend/app/routeRegistry.js
// Static prefix→router mappings, extracted from server.js for readability.
// Inline handlers (feature-flags, csrf-token, health, user-analytics, etc.) stay in
// server.js because they close over module-local state variables (_APP_VERSION,
// _platformHealthCache, featureFlags, analyticsService, etc.) that would require
// a factory pattern to move safely.
//
// The exported object is spread into `apiRoutes` in server.js before the inline handlers.

import { authRouter } from '../routes/auth.js';
import { inventoryRouter } from '../routes/inventory.js';
import { listingsRouter } from '../routes/listings.js';
import { shopsRouter } from '../routes/shops.js';
import { salesRouter } from '../routes/sales.js';
import { offersRouter } from '../routes/offers.js';
import { automationsRouter } from '../routes/automations.js';
import { analyticsRouter } from '../routes/analytics.js';
import { aiRouter } from '../routes/ai.js';
import { tasksRouter } from '../routes/tasks.js';
import { templatesRouter } from '../routes/templates.js';
import { oauthRouter } from '../routes/oauth.js';
import { imageBankRouter } from '../routes/imageBank.js';
import { chatbotRouter } from '../routes/chatbot.js';
import { communityRouter } from '../routes/community.js';
import { extensionRouter } from '../routes/extension.js';
import { helpRouter } from '../routes/help.js';
import { roadmapRouter } from '../routes/roadmap.js';
import { feedbackRouter } from '../routes/feedback.js';
import { adminIncidentsRouter } from '../routes/adminIncidents.js';
import { incidentSubscriptionsRouter } from '../routes/incidentSubscriptions.js';
import { calendarRouter } from '../routes/calendar.js';
import { checklistsRouter } from '../routes/checklists.js';
import { financialsRouter } from '../routes/financials.js';
import { shippingProfilesRouter } from '../routes/shippingProfiles.js';
import { skuRulesRouter } from '../routes/skuRules.js';
import { receiptParserRouter } from '../routes/receiptParser.js';
import { batchPhotoRouter } from '../routes/batchPhoto.js';
import { notificationsRouter } from '../routes/notifications.js';
import { emailOAuthRouter } from '../routes/emailOAuth.js';
import { ordersRouter } from '../routes/orders.js';
import { webhooksRouter } from '../routes/webhooks.js';
import { pushSubscriptionsRouter } from '../routes/pushSubscriptions.js';
import { predictionsRouter } from '../routes/predictions.js';
import { suppliersRouter } from '../routes/suppliers.js';
import { marketIntelRouter } from '../routes/marketIntel.js';
import { sizeChartsRouter } from '../routes/sizeCharts.js';
import { legalRouter } from '../routes/legal.js';
import { affiliateRouter } from '../routes/affiliate.js';
import { recentlyDeletedRouter } from '../routes/recentlyDeleted.js';
import { billingRouter } from '../routes/billing.js';
import { salesEnhancementsRouter } from '../routes/salesEnhancements.js';
import { duplicatesRouter } from '../routes/duplicates.js';
import { barcodeRouter } from '../routes/barcode.js';
import { teamsRouter } from '../routes/teams.js';
import { relistingRouter } from '../routes/relisting.js';
import { shippingLabelsRouter } from '../routes/shippingLabels.js';
import { inventoryImportRouter } from '../routes/inventoryImport.js';
import { whatnotRouter } from '../routes/whatnot.js';
import { reportsRouter } from '../routes/reports.js';
import { securityRouter } from '../routes/security.js';
import { rateLimitDashboardRouter } from '../routes/rateLimitDashboard.js';
import { socialAuthRouter } from '../routes/socialAuth.js';
import { gdprRouter } from '../routes/gdpr.js';
import { accountRouter } from '../routes/account.js';
import { outgoingWebhooksRouter } from '../services/outgoingWebhooks.js';
import { emailMarketingRouter } from '../services/emailMarketing.js';
import { enhancedMFARouter } from '../services/enhancedMFA.js';
import { auditLogRouter } from '../services/auditLog.js';
import { pushNotificationsRouter } from '../routes/pushNotifications.js';
import { competitorTrackingRouter } from '../routes/competitorTracking.js';
import { searchAnalyticsRouter } from '../routes/searchAnalytics.js';
import { expenseTrackerRouter } from '../routes/expenseTracker.js';
import { skuSyncRouter } from '../routes/skuSync.js';
import { syncAuditLogRouter } from '../routes/syncAuditLog.js';
import { qrAnalyticsRouter } from '../routes/qrAnalytics.js';
import { watermarkRouter } from '../routes/watermark.js';
import { whatnotEnhancedRouter } from '../routes/whatnotEnhanced.js';
import { onboardingRouter } from '../routes/onboarding.js';
import { offlineSyncRouter } from '../routes/offlineSync.js';
import { integrationsRouter } from '../routes/integrations.js';
import { currencyRouter } from '../routes/currency.js';
import { monitoringRouter } from '../routes/monitoring.js';
import { settingsRouter } from '../routes/settings.js';
import { contactRouter } from '../routes/contact.js';
import { affiliateApplyRouter } from '../routes/affiliate-apply.js';
import { featureRequestsRouter } from '../routes/feature-requests-routes.js';

export const routeRegistry = {
    '/api/auth': authRouter,
    '/api/inventory': inventoryRouter,
    '/api/listings': listingsRouter,
    '/api/shops': shopsRouter,
    '/api/sales': salesRouter,
    '/api/offers': offersRouter,
    '/api/automations': automationsRouter,
    '/api/analytics': analyticsRouter,
    '/api/ai': aiRouter,
    '/api/tasks': tasksRouter,
    '/api/templates': templatesRouter,
    '/api/oauth': oauthRouter,
    '/api/image-bank': imageBankRouter,
    '/api/chatbot': chatbotRouter,
    '/api/community': communityRouter,
    '/api/extension': extensionRouter,
    '/api/help': helpRouter,
    '/api/roadmap': roadmapRouter,
    '/api/feedback': feedbackRouter,
    '/api/admin/incidents': adminIncidentsRouter,
    '/api/incidents': incidentSubscriptionsRouter,
    '/api/calendar': calendarRouter,
    '/api/checklists': checklistsRouter,
    '/api/financials': financialsRouter,
    '/api/shipping-profiles': shippingProfilesRouter,
    '/api/sku-rules': skuRulesRouter,
    '/api/receipts': receiptParserRouter,
    '/api/batch-photo': batchPhotoRouter,
    '/api/notifications': notificationsRouter,
    '/api/email': emailOAuthRouter,
    '/api/orders': ordersRouter,
    '/api/webhooks': webhooksRouter,
    '/api/push-subscriptions': pushSubscriptionsRouter,
    '/api/predictions': predictionsRouter,
    '/api/suppliers': suppliersRouter,
    '/api/market-intel': marketIntelRouter,
    '/api/size-charts': sizeChartsRouter,
    '/api/legal': legalRouter,
    '/api/affiliate': affiliateRouter,
    '/api/recently-deleted': recentlyDeletedRouter,
    '/api/billing': billingRouter,
    '/api/sales-tools': salesEnhancementsRouter,
    '/api/duplicates': duplicatesRouter,
    '/api/barcode': barcodeRouter,
    '/api/teams': teamsRouter,
    '/api/relisting': relistingRouter,
    '/api/shipping-labels-mgmt': shippingLabelsRouter,
    '/api/inventory-import': inventoryImportRouter,
    '/api/whatnot': whatnotRouter,
    '/api/reports': reportsRouter,
    '/api/security': securityRouter,
    '/api/rate-limits': rateLimitDashboardRouter,
    '/api/social-auth': socialAuthRouter,
    '/api/gdpr': gdprRouter,
    '/api/account': accountRouter,
    '/api/outgoing-webhooks': outgoingWebhooksRouter,
    '/api/email-marketing': emailMarketingRouter,
    '/api/mfa': enhancedMFARouter,
    '/api/audit': auditLogRouter,
    '/api/push-notifications': pushNotificationsRouter,
    // '/api/notion': removed 2026-04-03
    '/api/competitor-tracking': competitorTrackingRouter,
    '/api/search-analytics': searchAnalyticsRouter,
    '/api/expenses': expenseTrackerRouter,
    '/api/sku-sync': skuSyncRouter,
    '/api/sync': syncAuditLogRouter,
    '/api/qr-analytics': qrAnalyticsRouter,
    '/api/watermark': watermarkRouter,
    '/api/whatnot-enhanced': whatnotEnhancedRouter,
    '/api/onboarding': onboardingRouter,
    '/api/offline-sync': offlineSyncRouter,
    '/api/integrations': integrationsRouter,
    '/api/currency': currencyRouter,
    '/api/monitoring': monitoringRouter,
    '/api/settings': settingsRouter,
    '/api/contact': contactRouter,
    '/api/affiliate-apply': affiliateApplyRouter,
    '/api/feature-requests': featureRequestsRouter,
};
