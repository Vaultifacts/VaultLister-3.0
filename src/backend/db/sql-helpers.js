// Convert ? positional params to $1, $2, ... for postgres.js
// Skips ? inside single-quoted string literals
function convertPlaceholders(sqlStr) {
    let index = 0;
    let result = '';
    let inString = false;
    for (let i = 0; i < sqlStr.length; i++) {
        const ch = sqlStr[i];
        if (ch === "'" && !inString) { inString = true; result += ch; }
        else if (ch === "'" && inString) { inString = false; result += ch; }
        else if (ch === '?' && !inString) { result += '$' + (++index); }
        else { result += ch; }
    }
    return result;
}

// Normalize SQL boolean literals (TRUE/FALSE) to integers (1/0) for INTEGER columns.
// PostgreSQL rejects `= TRUE` on INTEGER columns ("operator does not exist: integer = boolean").
// Skips replacements inside single-quoted string literals.
function normalizeSqlBooleans(sqlStr) {
    let result = '';
    let inString = false;
    let i = 0;
    while (i < sqlStr.length) {
        if (!inString && sqlStr[i] === "'") {
            inString = true;
            result += sqlStr[i++];
        } else if (inString && sqlStr[i] === "'") {
            inString = false;
            result += sqlStr[i++];
        } else if (!inString) {
            const sub = sqlStr.slice(i);
            const m = sub.match(/^((?:!=|<>|=)\s*)(TRUE|FALSE)\b/i);
            if (m) {
                result += m[1] + (m[2].toUpperCase() === 'TRUE' ? '1' : '0');
                i += m[0].length;
            } else {
                result += sqlStr[i++];
            }
        } else {
            result += sqlStr[i++];
        }
    }
    return result;
}

// Chain placeholder conversion and boolean normalization
export function prepareSQL(sqlStr) {
    return normalizeSqlBooleans(convertPlaceholders(sqlStr));
}

// SQL identifier validation — prevents injection via dynamic column/table names
const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
export function validateIdentifier(name) {
    if (!VALID_IDENTIFIER.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
    return name;
}

// Escape ILIKE wildcards for safe use in ILIKE clauses (use with ESCAPE '\\')
export function escapeLike(str) {
    return String(str).replace(/[%_\\]/g, '\\$&');
}
