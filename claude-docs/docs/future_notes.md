# VaultLister - Future Features & Notes

## V2.0 Roadmap

### Mobile App (React Native)
- Cross-platform iOS/Android app
- Camera integration for quick item photos
- Push notifications for offers/sales
- Barcode scanning for inventory

### n8n / Workflow Integration
- External scheduler for automation rules
- Webhook triggers for platform events
- Integration with shipping services (ShipStation, Pirate Ship)
- Email notification workflows

### Additional Platform Automations
Current: Only Poshmark bot implemented
Planned:
- **eBay**: Listing creation, offer management, relisting
- **Mercari**: Share, bump, offer handling
- **Depop**: Refresh listings, follow management
- **Grailed**: Bump, offer automation
- **Facebook Marketplace**: Repost automation

### Bulk Operations
- CSV import/export for inventory
- Bulk price updates across platforms
- Mass relisting functionality
- Batch photo processing

### Team/Business Accounts
- Multi-user workspaces
- Role-based permissions (admin, manager, assistant)
- Shared inventory pools
- Team analytics dashboard

### Advanced AI Features
- **Anthropic Claude** integration for:
  - Smart listing descriptions
  - Price optimization recommendations
  - Trend analysis and suggestions
- Potential **Suno AI** for creative marketing content
- Image-to-listing auto-fill

### Plugin System
- Community-contributed extensions
- Custom automation scripts
- Third-party integrations
- Theme marketplace

## Technical Debt

### Security Improvements Needed
- HTTPS support (currently HTTP only)
- Rate limiting middleware
- API key authentication option
- Audit logging for sensitive operations

### Performance Optimizations
- Query result caching (Redis optional)
- Image compression pipeline
- Lazy loading for large inventories
- WebSocket for real-time updates

### Testing Gaps
- Load testing suite
- Visual regression tests
- Mobile responsive testing
- Offline mode stress tests

## Platform-Specific Notes

### Poshmark
- Rate limits: ~8000 shares/day, 500 follows/day, 100 offers/day
- Captcha handling may be needed
- 2FA support not implemented

### eBay
- API integration possible (no scraping needed)
- Requires eBay developer account
- OAuth2 flow for authentication

### Mercari
- Aggressive bot detection
- Slower automation recommended
- Limited API options

## Configuration Ideas

### Subscription Tiers (config/settings.json)
```
free:    25 listings, 2 platforms, no automation
starter: 150 listings, 5 platforms, basic automation
pro:     unlimited, all platforms, full automation
```

### Sustainability Tracking
Impact calculations based on:
- Water saved (gallons per clothing category)
- CO2 prevented (kg per resale vs new)
- Waste diverted (kg per item)

## External Services (Optional)

| Service | Purpose | Status |
|---------|---------|--------|
| Anthropic API | Advanced AI features | Integrated |
| Stripe | Payment processing | Not started |
| SendGrid | Email notifications | Not started |
| Twilio | SMS alerts | Not started |
| AWS S3 | Image hosting | Not started |

## Notes for Implementation

### Adding New Platform Bot
1. Create `src/shared/automations/{platform}-bot.js`
2. Extend `automation-runner.js` with platform case
3. Add platform config to `config/settings.json`
4. Create E2E tests in `e2e/tests/{platform}.spec.js`
5. Update CLAUDE.md with new feature

### Database Migrations
Currently no migration system. Changes require:
1. Update `src/backend/db/schema.sql`
2. Run `bun run db:init` (drops existing data)
3. Run `bun run db:seed` for demo data

Consider adding: `bun-sqlite-migrations` or custom migration runner
