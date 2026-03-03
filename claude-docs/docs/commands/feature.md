# /feature - Implement New Feature

End-to-end feature implementation workflow, guided by the PRD.

## Usage
```
/feature <name> [description]
```

## IMPORTANT: Check PRD First!

Before implementing any feature, **always read `claude-docs/docs/PRD.md`**:

1. **Next Steps (Prioritized)** - The immediate priority list
2. **In Scope (Phase 2)** - Planned upcoming features
3. **Recently Completed** - What's already done (avoid duplication)
4. **Out of Scope** - What NOT to build

### Current Next Steps (from PRD.md)
```
1. Phase 2 Planning - Define scope for OAuth integration
2. Cloudinary Integration - Wire up existing service to UI
3. Shipping Profiles - Backend + Frontend CRUD
4. SKU Rules Builder - Pattern-based generation
5. Email Receipt Parsing - Gmail API integration
```

### Phase 2 Features (from PRD.md)
```
1. Full OAuth Integration - Real platform credentials
2. Advanced Photo Editor with Cloudinary - AI background removal, enhance
3. Shipping Profile Management - Reusable shipping configs
4. SKU Generation Rules Builder - Custom SKU patterns
5. Email Receipt Parsing - Gmail/Outlook auto-extract
```

> **Update this section** when PRD.md changes!

---

## Workflow

### Phase 0: PRD Check (REQUIRED)
1. **Read PRD.md** - `claude-docs/docs/PRD.md`
2. **Verify feature is in scope** - Check "Next Steps" or "In Scope" sections
3. **Check it's not already done** - Review "Recently Completed" and "Existing Features"
4. **Confirm not out of scope** - Check "Out of Scope" section

If feature is not in PRD:
- Ask user if they want to add it to PRD first
- Or proceed with ad-hoc implementation

### Phase 1: Planning
1. **Understand requirements from PRD**
   - What does the feature do?
   - What's the expected behavior?
   - Any specific requirements mentioned?

2. **Design approach**
   - Database schema changes needed?
   - API endpoints needed?
   - Frontend pages/components needed?

3. **Create implementation plan**
   - List all files to create/modify
   - Identify dependencies
   - Check existing patterns in codebase

### Phase 2: Database (if needed)
1. Create migration: `/migration <feature_name>`
2. Add tables/columns with proper indexes
3. Register migration in database.js
4. Test: restart server, verify tables created

### Phase 3: Backend
1. Create route: `/route <feature_name>`
2. Implement CRUD endpoints
3. Register in server.js
4. Test with curl or API tests

### Phase 4: Frontend
1. Create page: `/page <feature_name>`
2. Add state properties
3. Implement handlers
4. Add navigation link
5. Register route
6. Test in browser

### Phase 5: Polish
1. Add loading states
2. Handle empty states
3. Add error handling
4. Style consistency check
5. Dark mode support

### Phase 6: Testing (REQUIRED)
1. Run existing tests: `/test`
2. Add new tests for feature
3. Manual QA walkthrough
4. Fix any failures before proceeding

### Phase 7: Documentation
1. **Update PRD.md** - Move from "Next Steps" to "Recently Completed"
2. Update CLAUDE.md if new patterns introduced
3. Run `/evolve` if any issues encountered

---

## Feature Checklist
```
PRD Alignment:
- [ ] Feature is in PRD "Next Steps" or "In Scope"
- [ ] Not already in "Recently Completed"
- [ ] Not in "Out of Scope"

Implementation:
- [ ] Database migration created and registered
- [ ] Backend route created and registered
- [ ] API endpoints work (tested with curl)
- [ ] Frontend page/component created
- [ ] Navigation link added (if new page)
- [ ] Route registered
- [ ] Handlers implemented

Quality:
- [ ] Empty states handled
- [ ] Error states handled
- [ ] Loading states added
- [ ] Dark mode supported
- [ ] Tests added and passing
- [ ] Manual QA passed

Documentation:
- [ ] PRD.md updated (moved to "Recently Completed")
- [ ] Session count incremented in PRD
- [ ] /evolve run if any issues
```

---

## Examples

### Example 1: Implementing "Shipping Profiles" (from PRD)
```
/feature shipping-profiles

PRD Check:
✓ In "Next Steps" (#3) and "In Scope (Phase 2)" (#3)
✓ Not in "Recently Completed"
✓ Not in "Out of Scope"

1. Migration: 021_shipping_profiles.sql
   - shipping_profiles (id, user_id, name, carrier, service, weight_oz,
     length, width, height, is_default, created_at)

2. Route: shippingProfiles.js
   - GET /api/shipping-profiles
   - POST /api/shipping-profiles
   - PUT /api/shipping-profiles/:id
   - DELETE /api/shipping-profiles/:id

3. Frontend: Add to Settings page or new Shipping page
   - Profile list with CRUD
   - Default profile selection
   - Platform-specific overrides

4. Update PRD.md:
   - Move from "Next Steps" to "Recently Completed"
   - Increment session number
```

### Example 2: Ad-hoc Feature (not in PRD)
```
/feature inventory-notes "Add notes to inventory items"

PRD Check:
✗ Not in "Next Steps"
✗ Not in "In Scope"
✓ Not in "Out of Scope"

Action: Ask user - "This feature is not in the PRD. Should I:
1. Add it to PRD 'Next Steps' first, then implement?
2. Implement as ad-hoc feature?
3. Skip for now?"
```

---

## Keeping PRD Updated

After completing a feature, update PRD.md:

1. **Move from "Next Steps" to "Recently Completed"**
```markdown
## Recently Completed (Session 14)

### 3. Shipping Profile Management
- Create reusable shipping profiles
- Platform-specific shipping settings
- Automatic shipping cost calculations
```

2. **Remove from "In Scope" if fully complete**

3. **Add new items to "Next Steps" if discovered during implementation**

4. **Update session count and date**
```markdown
*Last Updated: 2026-01-XX (Session 14)*
*Total Implementations: 16X+ across 14 sessions*
```

---

## Quick Reference

| PRD Section | Meaning |
|-------------|---------|
| Next Steps | Immediate priorities - implement these first |
| In Scope (Phase 2) | Planned features - can implement when ready |
| Recently Completed | Already done - don't duplicate |
| Out of Scope | Don't build these |
| Existing Features | Already in codebase |
