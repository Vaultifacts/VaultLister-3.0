#!/usr/bin/env bun
// Ethics Audit Script for VaultLister
// Checks for bias, privacy violations, and ethical concerns

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Patterns that may indicate bias or ethical concerns
const BIAS_PATTERNS = {
    gender: {
        patterns: [
            /\b(only|just|merely)\s+(for\s+)?(men|women|boys|girls|male|female)\b/gi,
            /\b(perfect|ideal|designed)\s+for\s+(men|women|boys|girls)\b/gi
        ],
        severity: 'medium',
        message: 'Potential gender bias detected'
    },
    age: {
        patterns: [
            /\btoo\s+old\b/gi,
            /\btoo\s+young\b/gi,
            /\bage\s+inappropriate\b/gi
        ],
        severity: 'medium',
        message: 'Potential age discrimination detected'
    },
    appearance: {
        patterns: [
            /\bunattractive\b/gi,
            /\bugly\b/gi,
            /\bhideous\b/gi,
            /\bmust\s+be\s+(thin|skinny|slim)\b/gi
        ],
        severity: 'high',
        message: 'Negative appearance-based language detected'
    },
    exclusionary: {
        patterns: [
            /\bnot\s+for\s+(fat|overweight|plus\s?size)\b/gi,
            /\bonly\s+(white|black|asian)\s+people\b/gi,
            /\bno\s+(minorities|immigrants)\b/gi
        ],
        severity: 'high',
        message: 'Exclusionary or discriminatory language detected'
    },
    stereotypes: {
        patterns: [
            /\b(ethnic|cultural)\s+costume\b/gi,
            /\bgangster\s+(look|style)\b/gi,
            /\btribe\s+wear\b/gi
        ],
        severity: 'medium',
        message: 'Potential cultural stereotyping detected'
    }
};

// Privacy violation patterns
const PRIVACY_PATTERNS = {
    credentials: {
        patterns: [
            /password\s*[=:]\s*['"][^'"]+['"]/gi,
            /api[_-]?key\s*[=:]\s*['"][^'"]+['"]/gi,
            /secret\s*[=:]\s*['"][^'"]+['"]/gi,
            /token\s*[=:]\s*['"][^'"]+['"]/gi
        ],
        severity: 'critical',
        message: 'Hardcoded credentials detected'
    },
    pii: {
        patterns: [
            /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
            /\b\d{16}\b/g, // Credit card (basic check)
            /email\s*[=:]\s*['"][^'"]+@[^'"]+['"]/gi
        ],
        severity: 'high',
        message: 'Potential PII (Personal Identifiable Information) detected'
    }
};

// Malicious code patterns
const SECURITY_PATTERNS = {
    eval: {
        patterns: [
            /\beval\s*\(/gi,
            /Function\s*\(/gi,
            /setTimeout\s*\(\s*['"][^'"]*['"]/gi
        ],
        severity: 'high',
        message: 'Potentially dangerous eval or code execution'
    },
    exfiltration: {
        patterns: [
            /fetch\s*\(\s*['"]https?:\/\/[^'"]+['"]/gi,
            /XMLHttpRequest/gi
        ],
        severity: 'low', // Low because these are legitimate in many cases
        message: 'External network request detected (review for data exfiltration)'
    }
};

// Track findings
const findings = {
    bias: [],
    privacy: [],
    security: [],
    compliance: []
};

// Recursive file reader
function scanDirectory(dir, extensions = ['.js', '.ts', '.jsx', '.tsx', '.sql']) {
    const files = [];

    function walk(currentDir) {
        const items = readdirSync(currentDir);

        for (const item of items) {
            const fullPath = join(currentDir, item);
            const stat = statSync(fullPath);

            // Skip node_modules, .git, etc.
            if (item === 'node_modules' || item === '.git' || item === 'dist' || item === 'build') {
                continue;
            }

            if (stat.isDirectory()) {
                walk(fullPath);
            } else if (extensions.some(ext => item.endsWith(ext))) {
                files.push(fullPath);
            }
        }
    }

    walk(dir);
    return files;
}

// Scan a single file
function scanFile(filePath, patterns, category) {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (const [checkName, check] of Object.entries(patterns)) {
        for (const pattern of check.patterns) {
            lines.forEach((line, index) => {
                const matches = line.match(pattern);
                if (matches) {
                    findings[category].push({
                        file: filePath,
                        line: index + 1,
                        check: checkName,
                        severity: check.severity,
                        message: check.message,
                        context: line.trim(),
                        match: matches[0]
                    });
                }
            });
        }
    }
}

// Check for PLAN.md and ethics documentation
function checkCompliance() {
    const requiredDocs = [
        { file: 'PLAN.md', content: ['ethics', 'privacy', 'bias'] },
        { file: 'README.md', content: ['security', 'privacy'] },
        { file: '.env.example', content: ['JWT_SECRET'] }
    ];

    for (const doc of requiredDocs) {
        try {
            const content = readFileSync(doc.file, 'utf-8').toLowerCase();
            const missingTopics = doc.content.filter(topic => !content.includes(topic));

            if (missingTopics.length > 0) {
                findings.compliance.push({
                    file: doc.file,
                    severity: 'medium',
                    message: `Missing ethical documentation for: ${missingTopics.join(', ')}`
                });
            }
        } catch (error) {
            findings.compliance.push({
                file: doc.file,
                severity: 'high',
                message: `Required documentation file not found`
            });
        }
    }
}

// Main audit function
function runAudit() {
    console.log('🔍 VaultLister Ethics & Security Audit\n');
    console.log('Starting comprehensive scan...\n');

    const files = scanDirectory('.');
    console.log(`📁 Scanning ${files.length} files...\n`);

    // Scan for bias
    files.forEach(file => scanFile(file, BIAS_PATTERNS, 'bias'));

    // Scan for privacy violations
    files.forEach(file => scanFile(file, PRIVACY_PATTERNS, 'privacy'));

    // Scan for security issues
    files.forEach(file => scanFile(file, SECURITY_PATTERNS, 'security'));

    // Check compliance
    checkCompliance();

    // Report findings
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 AUDIT RESULTS\n');

    const totalFindings =
        findings.bias.length +
        findings.privacy.length +
        findings.security.length +
        findings.compliance.length;

    if (totalFindings === 0) {
        console.log('✅ No ethical or security concerns detected!\n');
        return true;
    }

    // Bias findings
    if (findings.bias.length > 0) {
        console.log(`⚠️  BIAS CONCERNS (${findings.bias.length})`);
        findings.bias.forEach(finding => {
            console.log(`  [${finding.severity.toUpperCase()}] ${finding.file}:${finding.line}`);
            console.log(`    ${finding.message}`);
            console.log(`    Match: "${finding.match}"`);
            console.log(`    Context: ${finding.context}\n`);
        });
    }

    // Privacy findings
    if (findings.privacy.length > 0) {
        console.log(`🔒 PRIVACY CONCERNS (${findings.privacy.length})`);
        findings.privacy.forEach(finding => {
            console.log(`  [${finding.severity.toUpperCase()}] ${finding.file}:${finding.line}`);
            console.log(`    ${finding.message}`);
            console.log(`    Context: ${finding.context}\n`);
        });
    }

    // Security findings
    if (findings.security.length > 0) {
        console.log(`🛡️  SECURITY CONCERNS (${findings.security.length})`);
        findings.security.forEach(finding => {
            console.log(`  [${finding.severity.toUpperCase()}] ${finding.file}:${finding.line}`);
            console.log(`    ${finding.message}`);
            console.log(`    Context: ${finding.context}\n`);
        });
    }

    // Compliance findings
    if (findings.compliance.length > 0) {
        console.log(`📋 COMPLIANCE CONCERNS (${findings.compliance.length})`);
        findings.compliance.forEach(finding => {
            console.log(`  [${finding.severity.toUpperCase()}] ${finding.file}`);
            console.log(`    ${finding.message}\n`);
        });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Summary
    const criticalCount = [...Object.values(findings)].flat().filter(f => f.severity === 'critical').length;
    const highCount = [...Object.values(findings)].flat().filter(f => f.severity === 'high').length;
    const mediumCount = [...Object.values(findings)].flat().filter(f => f.severity === 'medium').length;
    const lowCount = [...Object.values(findings)].flat().filter(f => f.severity === 'low').length;

    console.log(`\n📈 SUMMARY`);
    console.log(`  Total Issues: ${totalFindings}`);
    if (criticalCount > 0) console.log(`  Critical: ${criticalCount}`);
    if (highCount > 0) console.log(`  High: ${highCount}`);
    if (mediumCount > 0) console.log(`  Medium: ${mediumCount}`);
    if (lowCount > 0) console.log(`  Low: ${lowCount}`);

    if (criticalCount > 0 || highCount > 0) {
        console.log('\n❌ AUDIT FAILED: Critical or high-severity issues detected.');
        console.log('   Please address these issues before deployment.\n');
        return false;
    } else {
        console.log('\n✅ AUDIT PASSED: No critical issues detected.');
        console.log('   Review medium and low severity findings as needed.\n');
        return true;
    }
}

// Run the audit
const passed = runAudit();
process.exit(passed ? 0 : 1);
