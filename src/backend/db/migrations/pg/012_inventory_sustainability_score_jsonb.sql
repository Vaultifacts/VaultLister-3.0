DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'inventory'
          AND column_name = 'sustainability_score'
          AND data_type <> 'jsonb'
    ) THEN
        ALTER TABLE inventory
            ALTER COLUMN sustainability_score TYPE JSONB
            USING to_jsonb(sustainability_score);
    END IF;
END $$;
