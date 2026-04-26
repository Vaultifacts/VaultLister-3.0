#!/usr/bin/env node

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const KNOWN_FAILURE_PATTERN = /^KNOWN_FAILURES=(\d+)$/;
const KNOWN_FAIL_NAME_PATTERN = /^KNOWN_FAIL: (.+)$/;
const SECTION_HEADER_PATTERN = /^\[[^\]]+\]$/;
const FAILURE_LINE_PATTERN = /^\(fail\)\s+(.+)$/;
const FAILURE_TIMING_SUFFIX_PATTERN = /\s+\[[0-9][0-9.]*ms\]$/;
const FAILURE_COUNT_PATTERN = /(\d+)\s+fail\b/g;

function usage() {
    console.error('Usage: bun scripts/test-baseline.mjs <lint-baseline|check-output> [options]');
    process.exit(1);
}

function resolvePath(filePath) {
    return path.resolve(process.cwd(), filePath);
}

function decodeTextFile(filePath) {
    const buffer = readFileSync(filePath);

    if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
        return buffer.toString('utf16le').replace(/^\uFEFF/, '');
    }

    let zeroAtOddOffsets = 0;
    const sampleLength = Math.min(buffer.length, 256);
    for (let index = 1; index < sampleLength; index += 2) {
        if (buffer[index] === 0x00) {
            zeroAtOddOffsets += 1;
        }
    }

    if (zeroAtOddOffsets > sampleLength / 8) {
        return buffer.toString('utf16le').replace(/^\uFEFF/, '');
    }

    return buffer.toString('utf8').replace(/^\uFEFF/, '');
}

function parseArgs(argv) {
    const args = { _: [] };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--baseline') {
            args.baseline = argv[i + 1];
            i += 1;
        } else if (arg === '--allow-empty-output') {
            args.allowEmptyOutput = true;
        } else if (arg === '--allow-empty-baseline') {
            args.allowEmptyBaseline = true;
        } else {
            args._.push(arg);
        }
    }
    return args;
}

function readBaseline(baselinePath) {
    const resolvedPath = resolvePath(baselinePath || '.test-baseline');
    if (!existsSync(resolvedPath)) {
        return {
            path: resolvedPath,
            missing: true,
            knownFailures: 0,
            knownFailNames: [],
            warnings: [`Baseline file not found: ${resolvedPath}`],
        };
    }

    const content = decodeTextFile(resolvedPath);
    const lines = content.split(/\r?\n/);
    const warnings = [];
    const knownFailNames = [];
    let knownFailures = 0;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#') || SECTION_HEADER_PATTERN.test(line)) {
            continue;
        }

        const knownFailuresMatch = line.match(KNOWN_FAILURE_PATTERN);
        if (knownFailuresMatch) {
            knownFailures = Number.parseInt(knownFailuresMatch[1], 10);
            continue;
        }

        const knownFailMatch = line.match(KNOWN_FAIL_NAME_PATTERN);
        if (knownFailMatch) {
            knownFailNames.push(stripTimingSuffix(knownFailMatch[1]));
            continue;
        }

        warnings.push(line);
    }

    return {
        path: resolvedPath,
        missing: false,
        knownFailures,
        knownFailNames,
        warnings,
    };
}

function stripTimingSuffix(failureName) {
    return failureName.replace(FAILURE_TIMING_SUFFIX_PATTERN, '');
}

function parseTestOutput(output) {
    const failures = [];
    let actualFailures = 0;
    let countMatch;

    while ((countMatch = FAILURE_COUNT_PATTERN.exec(output)) !== null) {
        actualFailures = Number.parseInt(countMatch[1], 10);
    }

    for (const rawLine of output.split(/\r?\n/)) {
        const match = rawLine.match(FAILURE_LINE_PATTERN);
        if (!match) {
            continue;
        }
        failures.push({
            raw: match[1],
            normalized: stripTimingSuffix(match[1]),
        });
    }

    if (!actualFailures && failures.length > 0) {
        actualFailures = failures.length;
    }

    return { actualFailures, failures };
}

function lintBaselineCommand(options) {
    const baseline = readBaseline(options.baseline);
    if (baseline.missing) {
        console.warn(`WARNING: ${baseline.warnings[0]}`);
        process.exit(0);
    }

    if (baseline.warnings.length > 0) {
        console.warn('WARNING: .test-baseline has entries outside the canonical format:');
        for (const warning of baseline.warnings.slice(0, 5)) {
            console.warn(warning);
        }
        if (baseline.warnings.length > 5) {
            console.warn(`...and ${baseline.warnings.length - 5} more`);
        }
        console.warn('Allowed lines are comments, blank lines, [section] headers, KNOWN_FAILURES=..., and KNOWN_FAIL: ...');
    } else {
        console.log(`Baseline OK: ${baseline.knownFailures} known failures, ${baseline.knownFailNames.length} named failures`);
    }
}

function checkOutputCommand(options) {
    const outputPath = options._[1];
    if (!outputPath) {
        usage();
    }

    const baseline = readBaseline(options.baseline);
    if (baseline.missing) {
        if (options.allowEmptyBaseline) {
            console.warn(`WARNING: ${baseline.warnings[0]}`);
            process.exit(0);
        }
        console.error(`ERROR: ${baseline.warnings[0]}`);
        process.exit(1);
    }

    const output = decodeTextFile(resolvePath(outputPath));
    if (!output.trim()) {
        if (options.allowEmptyOutput) {
            console.warn('WARNING: Test runner produced no output; skipping baseline regression check');
            process.exit(0);
        }
        console.error('ERROR: Test runner produced no output');
        process.exit(1);
    }

    if (baseline.knownFailNames.length === 0 && baseline.knownFailures === 0 && options.allowEmptyBaseline) {
        console.warn('WARNING: .test-baseline missing or empty; skipping baseline regression check');
        process.exit(0);
    }

    const { actualFailures, failures } = parseTestOutput(output);
    const knownFailSet = new Set(baseline.knownFailNames.map(n => n.trimEnd()));
    const regressions = failures.filter(({ normalized }) => {
        const trimmed = normalized.trimEnd();
        if (knownFailSet.has(trimmed)) return false;
        // Bun truncates long test names OR leaves malformed timing suffixes (e.g. '[1.00ms' without
        // closing ']'). Accept if any known fail starts with the trimmed name (truncated output) OR
        // if the trimmed name starts with a known fail (malformed suffix appended to full name).
        for (const known of knownFailSet) {
            if (known.startsWith(trimmed) || trimmed.startsWith(known)) return false;
        }
        return true;
    });

    if (regressions.length > 0) {
        console.error('REGRESSION DETECTED - failures not in .test-baseline KNOWN_FAIL list:');
        for (const regression of regressions) {
            console.error(`  ${regression.raw}`);
        }
        process.exit(1);
    }

    if (actualFailures <= baseline.knownFailures) {
        if (actualFailures === 0) {
            console.log('Baseline gate passed: all tests passed');
        } else {
            console.log(`Baseline gate passed: ${actualFailures} failure(s), all within baseline ${baseline.knownFailures}`);
        }
        process.exit(0);
    }

    console.error(`Baseline gate failed: ${actualFailures} failure(s) exceeds KNOWN_FAILURES=${baseline.knownFailures}`);
    process.exit(1);
}

const options = parseArgs(process.argv.slice(2));
const command = options._[0];

if (command === 'lint-baseline') {
    lintBaselineCommand(options);
} else if (command === 'check-output') {
    checkOutputCommand(options);
} else {
    usage();
}
