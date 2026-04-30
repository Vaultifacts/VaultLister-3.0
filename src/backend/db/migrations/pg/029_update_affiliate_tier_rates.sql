-- Update affiliate tier commission rates to match advertised 25% base rate
UPDATE affiliate_tiers SET commission_rate = 0.25 WHERE id = 'tier-bronze';
UPDATE affiliate_tiers SET commission_rate = 0.30 WHERE id = 'tier-silver';
UPDATE affiliate_tiers SET commission_rate = 0.35 WHERE id = 'tier-gold';
