-- Update affiliate tier commission rates — all tiers set to 25%
UPDATE affiliate_tiers SET commission_rate = 0.25 WHERE id = 'tier-bronze';
UPDATE affiliate_tiers SET commission_rate = 0.25 WHERE id = 'tier-silver';
UPDATE affiliate_tiers SET commission_rate = 0.25 WHERE id = 'tier-gold';
