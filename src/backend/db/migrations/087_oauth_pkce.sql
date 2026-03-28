-- Add PKCE support to oauth_states
-- Required for Etsy v3 OAuth (code_challenge / code_verifier flow)
ALTER TABLE oauth_states ADD COLUMN code_verifier TEXT;

-- DOWN: ALTER TABLE oauth_states DROP COLUMN IF EXISTS code_verifier;
