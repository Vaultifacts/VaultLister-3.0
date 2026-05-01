-- Fix silver and gold tier commission rates to 25% (029 ran with progressive rates 0.30/0.35)
UPDATE affiliate_tiers SET commission_rate = 0.25 WHERE id = 'tier-silver';
UPDATE affiliate_tiers SET commission_rate = 0.25 WHERE id = 'tier-gold';
