#!/usr/bin/env node
// Security Audit Script for VaultLister
// Checks for common security vulnerabilities and best practices

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal

// Audit results
const results = {
    passed: [],
    warnings: [],
    critical: [],
    info: []
};

// Patterns to check for security issues
const SECURITY_PATTERNS = {
    // Critical issues
    hardcodedSecrets: {
        patterns: [
            /password\s*[:=]\s*['"][^'"]+['"]/gi,
            /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi,
            /secret\s*[:=]\s*['"][^'"]+['"]/gi,
            /token\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/gi,
        ],
        severity: 'critical',
        message: 'Potential hardcoded secret found'
    },
    sqlInjection: {
        patterns: [
            /query\([^)]*\$\{/g,
            /query\([^)]*\+\s*[a-zA-Z]/g,
            /`SELECT.*\$\{/g,
            /`INSERT.*\$\{/g,
            /`UPDATE.*\$\{/g,
            /`DELETE.*\$\{/g,
        ],
        severity: 'critical',
        message: 'Potential SQL injection vulnerability'
    },
    commandInjection: {
        patterns: [
            /exec\([^)]*\$\{/g,
            /spawn\([^)]*\$\{/g,
            /execSync\([^)]*\$\{/g,
        ],
        severity: 'critical',
        message: 'Potential command injection vulnerability'
    },
    // Warnings
    insecureRandom: {
        patterns: [
            /Math\.random\(\)/g,
        ],
        severity: 'warning',
        message: 'Using Math.random() - consider crypto.randomBytes for security-sensitive operations'
    },
    consoleLog: {
        patterns: [
            /console\.log\([^)]*password/gi,
            /console\.log\([^)]*secret/gi,
            /console\.log\([^)]*token/gi,
        ],
        severity: 'warning',
        message: 'Logging potentially sensitive data'
    },
    eval: {
        patterns: [
            /\beval\s*\(/g,
            /new\s+Function\s*\(/g,
        ],
        severity: 'warning',
        message: 'Using eval() or Function() constructor - potential security risk'
    },
    dangerouslySetInnerHTML: {
        patterns: [
            /dangerouslySetInnerHTML/g,
            /innerHTML\s*=/g,
        ],
        severity: 'warning',
        message: 'Setting innerHTML - potential XSS vulnerability'
    }
};

// Files/patterns to ignore
const IGNORE_PATTERNS = [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    'coverage',
    '*.min.js',
    '*.bundle.js'
];

// Check if path should be ignored
function shouldIgnore(path) {
    return IGNORE_PATTERNS.some(pattern => {
        if (pattern.includes('*')) {
            const regex = new RegExp(pattern.replace(/\*/g, '.*'));  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
            return regex.test(path);
        }
        return path.includes(pattern);
    });
}

// Scan file for security issues
function scanFile(filePath) {
    if (shouldIgnore(filePath)) return;

    const ext = extname(filePath);
    if (!['.js', '.ts', '.jsx', '.tsx', '.mjs'].includes(ext)) return;

    try {
        const content = readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const relativePath = filePath.replace(ROOT_DIR + '/', '');

        for (const [name, check] of Object.entries(SECURITY_PATTERNS)) {
            for (const pattern of check.patterns) {
                let match;
                const regex = new RegExp(pattern.source, pattern.flags);  // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp

                while ((match = regex.exec(content)) !== null) {
                    // Find line number
                    let lineNum = 1;
                    let charCount = 0;
                    for (const line of lines) {
                        charCount += line.length + 1;
                        if (charCount > match.index) break;
                        lineNum++;
                    }

                    const issue = {
                        file: relativePath,
                        line: lineNum,
                        check: name,
                        message: check.message,
                        snippet: match[0].substring(0, 100)
                    };

                    if (check.severity === 'critical') {
                        results.critical.push(issue);
                    } else {
                        results.warnings.push(issue);
                    }
                }
            }
        }
    } catch (error) {
        // Skip files that can't be read
    }
}

// Recursively scan directory
function scanDirectory(dir) {
    if (shouldIgnore(dir)) return;

    const items = readdirSync(dir);

    for (const item of items) {
        const fullPath = join(dir, item);  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal

        try {
            const stats = statSync(fullPath);

            if (stats.isDirectory()) {
                scanDirectory(fullPath);
            } else {
                scanFile(fullPath);
            }
        } catch (error) {
            // Skip items that can't be accessed
        }
    }
}

// Check for security best practices
function checkBestPractices() {
    // Check for .env file in git
    if (existsSync(join(ROOT_DIR, '.gitignore'))) {  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        const gitignore = readFileSync(join(ROOT_DIR, '.gitignore'), 'utf8');  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        if (!gitignore.includes('.env')) {
            results.critical.push({
                file: '.gitignore',
                message: '.env file is not in .gitignore - secrets may be committed'
            });
        } else {
            results.passed.push('✓ .env is properly gitignored');
        }
    }

    // Check for package-lock.json / bun.lockb
    if (existsSync(join(ROOT_DIR, 'package-lock.json')) || existsSync(join(ROOT_DIR, 'bun.lockb'))) {  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        results.passed.push('✓ Lock file present for reproducible builds');
    } else {
        results.warnings.push({
            file: 'package.json',
            message: 'No lock file found - dependencies may vary between installs'
        });
    }

    // Check for security headers middleware
    const serverFile = join(ROOT_DIR, 'src/backend/server.js');  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    if (existsSync(serverFile)) {
        const serverContent = readFileSync(serverFile, 'utf8');

        if (serverContent.includes('securityHeaders') || serverContent.includes('helmet')) {
            results.passed.push('✓ Security headers middleware detected');
        } else {
            results.warnings.push({
                file: 'src/backend/server.js',
                message: 'No security headers middleware detected'
            });
        }

        if (serverContent.includes('rateLimit') || serverContent.includes('rateLimiter')) {
            results.passed.push('✓ Rate limiting detected');
        } else {
            results.warnings.push({
                file: 'src/backend/server.js',
                message: 'No rate limiting detected'
            });
        }

        if (serverContent.includes('csrf') || serverContent.includes('CSRF')) {
            results.passed.push('✓ CSRF protection detected');
        } else {
            results.warnings.push({
                file: 'src/backend/server.js',
                message: 'No CSRF protection detected'
            });
        }
    }

    // Check for HTTPS redirect in production
    if (existsSync(join(ROOT_DIR, 'src/backend/middleware/securityHeaders.js'))) {  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        const headersContent = readFileSync(join(ROOT_DIR, 'src/backend/middleware/securityHeaders.js'), 'utf8');  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        if (headersContent.includes('Strict-Transport-Security')) {
            results.passed.push('✓ HSTS header configured');
        }
    }

    // Check for bcrypt/argon2 for password hashing
    const authFiles = [
        join(ROOT_DIR, 'src/backend/routes/auth.js'),  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        join(ROOT_DIR, 'src/backend/middleware/auth.js')  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    ];

    for (const authFile of authFiles) {
        if (existsSync(authFile)) {
            const authContent = readFileSync(authFile, 'utf8');
            if (authContent.includes('bcrypt') || authContent.includes('argon2')) {
                results.passed.push('✓ Secure password hashing detected');
                break;
            }
        }
    }

    // Check for input validation
    if (existsSync(join(ROOT_DIR, 'src/backend/middleware'))) {  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        const middlewareFiles = readdirSync(join(ROOT_DIR, 'src/backend/middleware'));  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        const hasValidation = middlewareFiles.some(f =>
            f.includes('validation') || f.includes('sanitize')
        );
        if (hasValidation) {
            results.passed.push('✓ Input validation middleware detected');
        } else {
            results.info.push({
                message: 'Consider adding dedicated input validation middleware'
            });
        }
    }
}

// Run npm audit
async function runNpmAudit() {
    console.log('Running dependency audit...');

    try {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

        // Try bun audit first, fall back to npm
        try {
            const { stdout } = await execAsync('npm audit --json', { cwd: ROOT_DIR });
            const audit = JSON.parse(stdout);

            if (audit.metadata?.vulnerabilities) {
                const { critical, high, moderate, low } = audit.metadata.vulnerabilities;

                if (critical > 0) {
                    results.critical.push({
                        file: 'package.json',
                        message: `${critical} critical vulnerabilities in dependencies`
                    });
                }
                if (high > 0) {
                    results.critical.push({
                        file: 'package.json',
                        message: `${high} high severity vulnerabilities in dependencies`
                    });
                }
                if (moderate > 0) {
                    results.warnings.push({
                        file: 'package.json',
                        message: `${moderate} moderate vulnerabilities in dependencies`
                    });
                }
                if (low > 0) {
                    results.info.push({
                        message: `${low} low severity vulnerabilities in dependencies`
                    });
                }

                if (critical === 0 && high === 0 && moderate === 0) {
                    results.passed.push('✓ No known vulnerabilities in dependencies');
                }
            }
        } catch (e) {
            results.info.push({
                message: 'Could not run npm audit - install npm to check dependencies'
            });
        }
    } catch (error) {
        results.info.push({
            message: 'Could not run dependency audit'
        });
    }
}

// Print results
function printResults() {
    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('                    SECURITY AUDIT RESULTS');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');

    // Critical issues
    if (results.critical.length > 0) {
        console.log('🚨 CRITICAL ISSUES (' + results.critical.length + ')');
        console.log('─────────────────────────────────────────────────────────────────');
        for (const issue of results.critical) {
            console.log(`  ✗ ${issue.message}`);
            if (issue.file) console.log(`    File: ${issue.file}${issue.line ? ':' + issue.line : ''}`);
            if (issue.snippet) console.log(`    Code: ${issue.snippet.substring(0, 60)}...`);
            console.log('');
        }
    }

    // Warnings
    if (results.warnings.length > 0) {
        console.log('⚠️  WARNINGS (' + results.warnings.length + ')');
        console.log('─────────────────────────────────────────────────────────────────');
        for (const issue of results.warnings) {
            console.log(`  ⚠ ${issue.message}`);
            if (issue.file) console.log(`    File: ${issue.file}${issue.line ? ':' + issue.line : ''}`);
            console.log('');
        }
    }

    // Passed checks
    if (results.passed.length > 0) {
        console.log('✅ PASSED CHECKS (' + results.passed.length + ')');
        console.log('─────────────────────────────────────────────────────────────────');
        for (const check of results.passed) {
            console.log(`  ${check}`);
        }
        console.log('');
    }

    // Info
    if (results.info.length > 0) {
        console.log('ℹ️  INFO');
        console.log('─────────────────────────────────────────────────────────────────');
        for (const info of results.info) {
            console.log(`  • ${info.message}`);
        }
        console.log('');
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('SUMMARY');
    console.log(`  Critical: ${results.critical.length}`);
    console.log(`  Warnings: ${results.warnings.length}`);
    console.log(`  Passed: ${results.passed.length}`);
    console.log(`  Info: ${results.info.length}`);

    // Security score
    const maxScore = 100;
    const criticalPenalty = results.critical.length * 20;
    const warningPenalty = results.warnings.length * 5;
    const passedBonus = results.passed.length * 5;
    const score = Math.max(0, Math.min(100, maxScore - criticalPenalty - warningPenalty + passedBonus));

    console.log('');
    console.log(`Security Score: ${score}/100`);

    if (score >= 80) {
        console.log('Rating: GOOD ✅');
    } else if (score >= 60) {
        console.log('Rating: FAIR ⚠️');
    } else if (score >= 40) {
        console.log('Rating: NEEDS IMPROVEMENT ⚠️');
    } else {
        console.log('Rating: CRITICAL ISSUES 🚨');
    }

    console.log('═══════════════════════════════════════════════════════════════\n');

    // Exit with error code if critical issues found
    if (results.critical.length > 0) {
        process.exit(1);
    }
}

// Main function
async function main() {
    console.log('VaultLister Security Audit');
    console.log('Scanning codebase for security issues...\n');

    // Scan source code
    console.log('Scanning source files...');
    scanDirectory(join(ROOT_DIR, 'src'));  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal

    // Check best practices
    console.log('Checking security best practices...');
    checkBestPractices();

    // Run dependency audit
    await runNpmAudit();

    // Print results
    printResults();
}

main().catch(console.error);
