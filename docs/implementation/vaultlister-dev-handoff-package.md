# VAULTLISTER — DEV HANDOFF PACKAGE
Version: v1
Status: Design Spec
Classification: HIGH-PROBABILITY

## 1. Objective

Build a low-cost, faceless, beta-first, automation-friendly growth and conversion system for VaultLister.

This package defines:

- SQL schema
- API contract
- analytics event dictionary
- onboarding UI component spec
- billing webhook state machine
- referral logic
- content pipeline spec

---

## 2. System goals

Primary goals:

1. convert traffic into beta signups
2. get beta users to first success quickly
3. collect structured feedback
4. convert qualified beta users into paid founding users
5. automate lifecycle and content where safe
6. maintain solo-founder operability

Success criteria:

- onboarding completion is measurable
- activation is measurable
- billing state is authoritative
- referrals are abuse-resistant
- content automation uses structured source data
- beta feedback is categorized and actionable

---

## 3. Core definitions

### Activation
A user is activated when they complete at least one of:

- first listing completed
- marketplace connected

### Onboarding complete
A user is onboarding-complete when they have finished the guided onboarding flow and reached the first-success state.

### Beta-engaged user
A user with meaningful product interaction after signup, such as:
- first listing completed
- marketplace connected
- crosslist triggered
- feedback submitted

### Founding user
A beta user eligible for discounted paid pricing after beta.

---

## 4. Core funnel

Traffic
→ landing page
→ beta CTA
→ signup
→ onboarding
→ first success
→ activation
→ engagement
→ feedback
→ pricing exposure
→ upgrade
→ retention/referral

---

## 5. Architecture summary

### Frontend
- marketing/beta landing pages
- auth pages
- onboarding flow
- listing flow
- dashboard
- pricing/billing pages
- referrals page
- changelog page

### Backend
- auth/session
- user/profile
- onboarding
- listings
- marketplace connections
- feedback
- events
- referrals
- billing
- changelog

### Database
- users
- profiles
- onboarding_state
- listings
- events
- feedback
- referrals
- referral_rewards
- billing_customers
- subscriptions
- billing_events
- changelog_entries

### Automation
- transactional email
- lifecycle email
- beta invite flows
- referral invite emails
- changelog-based content generation
- analytics reporting
