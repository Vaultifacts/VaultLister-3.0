#!/usr/bin/perl
# pg-migrate-sql.pl — convert SQLite SQL patterns to PostgreSQL equivalents
# Run: perl scripts/pg-migrate-sql.pl <file.js> [file2.js ...]

use strict;
use warnings;

for my $file (@ARGV) {
    open(my $fh, '<', $file) or die "Cannot open $file: $!";
    my $content = do { local $/; <$fh> };
    close($fh);

    my $original = $content;

    # --- 1. datetime() → NOW() / INTERVAL ---
    # Static negative modifier: datetime('now', '-30 days') → NOW() - INTERVAL '30 days'
    $content =~ s/datetime\('now',\s*'-(\d+(?:\.\d+)?)\s+(\w+)'\)/NOW() - INTERVAL '$1 $2'/g;
    # Static positive modifier: datetime('now', '+7 days') → NOW() + INTERVAL '7 days'
    $content =~ s/datetime\('now',\s*'\+(\d+(?:\.\d+)?)\s+(\w+)'\)/NOW() + INTERVAL '$1 $2'/g;
    # Dynamic negative: datetime('now', '-' || ? || ' days') → NOW() - (?::text || ' days')::interval
    $content =~ s/datetime\('now',\s*'-'\s*\|\|\s*\?\s*\|\|\s*'\s*(\w+)'\)/NOW() - (?::text || ' $1')::interval/g;
    # Dynamic positive: datetime('now', ? || ' hours') → NOW() + (?::text || ' hours')::interval
    $content =~ s/datetime\('now',\s*\?\s*\|\|\s*'\s*(\w+)'\)/NOW() + (?::text || ' $1')::interval/g;
    # Parameterized: datetime('now', ?) → NOW() + ?::interval
    $content =~ s/datetime\('now',\s*\?\)/NOW() + ?::interval/g;
    # Bare: datetime('now') → NOW()
    $content =~ s/datetime\('now'\)/NOW()/g;

    # --- 2. strftime() → TO_CHAR() / EXTRACT() ---
    # %w day-of-week → EXTRACT(DOW FROM col) (both 0=Sunday)
    $content =~ s/strftime\('%w',\s*([^)]+)\)/EXTRACT(DOW FROM $1)/g;
    # %H hour → EXTRACT(HOUR FROM col)
    $content =~ s/strftime\('%H',\s*([^)]+)\)/EXTRACT(HOUR FROM $1)/g;
    # %Y-%m-%d %H:00 → TO_CHAR(col, 'YYYY-MM-DD HH24:00')
    $content =~ s/strftime\('%Y-%m-%d %H:00',\s*([^)]+)\)/TO_CHAR($1, 'YYYY-MM-DD HH24:00')/g;
    # %Y-%m-%d → TO_CHAR(col, 'YYYY-MM-DD')
    $content =~ s/strftime\('%Y-%m-%d',\s*([^)]+)\)/TO_CHAR($1, 'YYYY-MM-DD')/g;
    # %Y-%W → TO_CHAR(col, 'YYYY-IW')
    $content =~ s/strftime\('%Y-%W',\s*([^)]+)\)/TO_CHAR($1, 'YYYY-IW')/g;
    # %Y-%m → TO_CHAR(col, 'YYYY-MM')
    $content =~ s/strftime\('%Y-%m',\s*([^)]+)\)/TO_CHAR($1, 'YYYY-MM')/g;
    # %Y year → TO_CHAR(col, 'YYYY')
    $content =~ s/strftime\('%Y',\s*([^)]+)\)/TO_CHAR($1, 'YYYY')/g;
    # %d day → TO_CHAR(col, 'DD')
    $content =~ s/strftime\('%d',\s*([^)]+)\)/TO_CHAR($1, 'DD')/g;

    # --- 3. julianday() differences → EXTRACT(EPOCH) / 86400 ---
    # julianday('now') - julianday(col) with one level of nested parens
    $content =~ s/julianday\(['"]now['"]\)\s*-\s*julianday\(((?:[^()]+|\([^()]*\))+)\)/EXTRACT(EPOCH FROM (NOW() - $1)) \/ 86400/g;
    # julianday(col1) - julianday(col2) with one level of nested parens
    $content =~ s/julianday\(((?:[^()]+|\([^()]*\))+)\)\s*-\s*julianday\(((?:[^()]+|\([^()]*\))+)\)/EXTRACT(EPOCH FROM ($1 - $2)) \/ 86400/g;

    # --- 4. json_extract(col, '$.key') → col::jsonb->>'key' ---
    # CAST(json_extract(...) AS type) handled naturally since the inner part is replaced
    $content =~ s/json_extract\(([^,]+),\s*'\$\.([^']+)'\)/$1\:\:jsonb->>'$2'/g;

    # --- 5. GROUP_CONCAT → STRING_AGG ---
    $content =~ s/GROUP_CONCAT\(DISTINCT\s+([^)]+)\)/STRING_AGG(DISTINCT $1, ',')/g;
    $content =~ s/GROUP_CONCAT\(([^)]+)\)/STRING_AGG($1, ',')/g;

    # --- 6. IFNULL → COALESCE ---
    $content =~ s/\bIFNULL\s*\(/COALESCE(/g;

    # --- 7. sqlite_master → information_schema.tables ---
    $content =~ s/sqlite_master/information_schema.tables/g;

    # --- 8. DATE(col) → col::date (SQL DATE() function, not JS Date) ---
    # Only match uppercase DATE() to avoid JS Date()
    $content =~ s/\bDATE\(([^()]+)\)/$1::date/g;

    # --- 9. LIKE → ILIKE (for case-insensitive search parity) ---
    $content =~ s/\bLIKE\b/ILIKE/g;

    # --- 10. INSERT OR IGNORE → INSERT (ON CONFLICT to be added at statement end) ---
    $content =~ s/INSERT OR IGNORE INTO\b/INSERT INTO/g;

    # --- 11. INSERT OR REPLACE → INSERT (ON CONFLICT to be resolved per-table) ---
    $content =~ s/INSERT OR REPLACE INTO\b/INSERT INTO/g;

    if ($content ne $original) {
        open(my $out, '>', $file) or die "Cannot write $file: $!";
        print $out $content;
        close($out);
        print "Updated: $file\n";
    }
}

print "Done.\n";
