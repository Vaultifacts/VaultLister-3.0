#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dir, '..');
const OUTPUT_PATH = path.join(ROOT, 'docs', 'OPEN_ITEMS.md');
const REGISTRY_PATH = path.join(ROOT, 'docs', 'open-items', 'items.json');
const WALKTHROUGH_DIR = path.join(ROOT, 'docs', 'walkthrough');
const DEEP_DIVE_BACKLOG_PATH = path.join(ROOT, 'docs', 'reference', 'deep-dive-backlog.md');
const COMPETITOR_GAP_INVENTORY_PATH = path.join(ROOT, 'docs', 'COMPETITOR_GAP_INVENTORY_2026-04-19.md');
const ANTI_DETECTION_SPEC_PATH = path.join(ROOT, 'docs', 'PERFECT_ANTI_DETECTION_SYSTEM.md');

const args = new Set(process.argv.slice(2));
const checkMode = args.has('--check');
const noLive = args.has('--no-live');

const TODO_DIRS = [
    'src',
    'public',
    'scripts',
    'worker',
    'design',
    'e2e',
    'qa',
    'data',
    '.github',
    'archive',
    'chrome-extension',
    'mobile',
    'nginx',
    '.agents'
];

const TODO_GLOBS = [
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/playwright-report/**',
    '!**/test-results/**',
    '!scripts/generate-open-items.mjs'
];

const HISTORICAL_SOURCES = [
    'docs/WALKTHROUGH_MASTER_FINDINGS.md',
    'docs/MANUAL_INSPECTION.md',
    'docs/OPEN_ISSUE_TRIAGE_2026-04-12.md',
    'docs/REMAINING_WORK_EXECUTION_SHEET_2026-04-21.md',
    'docs/EXHAUSTIVE_AUDIT_LEDGER_2026-04-20.md',
    'docs/LAUNCH_AUDIT_2026-04-03.md',
    'docs/LAUNCH_AUDIT_FINDINGS_2026-04-05.md',
    'docs/LAUNCH_READINESS_2026-04-05.md',
    'docs/REPO_HARDENING_ACTION_PLAN_V2_3.md',
    'docs/SNAPSHOT_CERTIFICATION_CHECKLIST.md',
    'docs/SNAPSHOT_CERTIFICATION_REPORT_2026-04-20.md',
    'docs/SNAPSHOT_CERTIFICATION_REPORT_2026-04-21.md',
    'docs/SNAPSHOT_FREEZE_2026-04-21.md',
    'docs/archive/CONSOLIDATED_OPEN_ITEMS_2026-04-29.md',
    'docs/archive/**',
    'docs/audits/**',
    'qa/reports/**'
];

const DOCUMENT_SCAN_TARGETS = [
    'AGENTS.md',
    'CLAUDE.md',
    'README.md',
    'RAILWAY_OPERATIONS.md',
    'package.json',
    'package-lock.json',
    'bunfig.toml',
    'docs',
    'memory',
    'design',
    'qa',
    'data',
    'public',
    'scripts',
    'worker',
    '.github',
    'chrome-extension',
    'mobile',
    'nginx',
    '.agents'
];

const DOCUMENT_SCAN_GLOBS = [
    '--glob', '*.md',
    '--glob', '*.mdx',
    '--glob', '*.txt',
    '--glob', '*.json',
    '--glob', '*.yml',
    '--glob', '*.yaml',
    '--glob', '*.toml',
    '--glob', 'Dockerfile*',
    '--glob', '.env.example',
    '--glob', '.dockerignore',
    '--glob', '.gitignore',
    '--glob', '.prettierignore',
    '--glob', '.semgrepignore',
    '--glob', 'sonar-project.properties',
    '--glob', '!**/node_modules/**',
    '--glob', '!**/dist/**',
    '--glob', '!**/playwright-report/**',
    '--glob', '!**/test-results/**',
    '--glob', '!**/coverage/**',
    '--glob', '!docs/OPEN_ITEMS.md'
];

const OPEN_MARKER_PATTERN = '(^|\\b)(OPEN|STILL OPEN|OPEN / NOT VERIFIED|NEEDS FIX|NEEDS TRIAGE|BLOCKED|DEFERRED|PENDING|RECHECK|TODO|FIXME|TBD|BACKLOG|NOT VERIFIED)(\\b|\\s|:|—|-)';
const COMPETITOR_CLOSABILITY = {
    F: 'Free/public verification',
    P: 'Paid/gated verification',
    B: 'Behavioral/benchmark test',
    I: 'Insider-only/opaque'
};
const ROOT_DOCUMENT_SCAN_PATTERN = /\.(mdx?|txt|json|ya?ml|toml)$/i;
const ROOT_DOCUMENT_SPECIAL_FILES = new Set([
    '.dockerignore',
    '.env.example',
    '.gitignore',
    '.prettierignore',
    '.semgrepignore',
    'Dockerfile',
    'Dockerfile.worker',
    'sonar-project.properties'
]);

function rel(filePath) {
    return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function readText(filePath) {
    return readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
}

function readLines(filePath) {
    return readText(filePath).split(/\r?\n/);
}

function run(command, commandArgs, options = {}) {
    const result = spawnSync(command, commandArgs, {
        cwd: ROOT,
        encoding: 'utf8',
        shell: false,
        ...options
    });

    return {
        ok: result.status === 0,
        status: result.status,
        stdout: (result.stdout || '').trim(),
        stderr: (result.stderr || '').trim()
    };
}

function withoutGithubTokenEnv() {
    const env = { ...process.env };
    for (const key of ['GH_TOKEN', 'GITHUB_TOKEN', 'GH_ENTERPRISE_TOKEN', 'GITHUB_ENTERPRISE_TOKEN']) {
        delete env[key];
    }
    return env;
}

function normalizeLineEndings(value) {
    return value.replace(/\r\n/g, '\n');
}

function normalizeForCheck(value) {
    return normalizeLineEndings(value)
        .replace(/^Generated at: .+$/m, 'Generated at: <ignored>')
        .replace(/^Commit: .+$/m, 'Commit: <ignored>')
        .replace(/^## GitHub Open Issues\n[\s\S]*?(?=^## )/m, '## GitHub Open Issues\n<ignored>\n\n');
}

function escapeCell(value) {
    return String(value ?? '')
        .replace(/\r?\n/g, ' ')
        .replace(/\|/g, '\\|')
        .trim();
}

function stripMarkdown(value) {
    return String(value ?? '')
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}

function splitTableRow(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
    return trimmed.slice(1, -1).split('|').map(cell => cell.trim());
}

function isSeparatorRow(line) {
    const cells = splitTableRow(line);
    return !!cells && cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell.trim()));
}

function headerIndex(headers, names) {
    const normalized = headers.map(header => stripMarkdown(header).toLowerCase());
    for (const name of names) {
        const index = normalized.findIndex(header => header === name || header.includes(name));
        if (index !== -1) return index;
    }
    return -1;
}

function classifyStatus(statusText) {
    const status = stripMarkdown(statusText).toLowerCase();
    if (!status) return null;
    if (status.includes('open question') || status.includes('needs triage')) {
        return 'question';
    }
    if (status.includes('open / not verified')) {
        return 'open-not-verified';
    }
    if (/^(still\s+open|open\b)/.test(status) || status.includes('still open')) {
        return 'open';
    }
    if (/^blocked\b/.test(status)) {
        return 'blocked';
    }
    if (
        /^deferred\b/.test(status) ||
        status.includes('deferred post-launch') ||
        status.includes('deferred to post-launch') ||
        (status.startsWith('pre-existing') && status.includes('deferred'))
    ) {
        return 'deferred';
    }
    if (status.includes('pending') || status.includes('recheck')) {
        return 'fixed-pending-live-verification';
    }
    if (status.includes('verified') || status.includes('confirmed n/a') || status.includes('fixed')) {
        return null;
    }
    return null;
}

function deriveId(sourcePath, lineNumber, title) {
    const base = stripMarkdown(title)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 42) || 'item';
    const file = path.basename(sourcePath, '.md').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    return `${file}-${lineNumber}-${base}`;
}

function areaFromFile(fileName) {
    return path.basename(fileName, '.md')
        .split(/[-_]+/)
        .map(part => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
        .join(' ');
}

function sourceRef(source) {
    return `${source.path}:${source.line}`;
}

function normalizePath(value) {
    return String(value || '').replace(/\\/g, '/');
}

function existingScanTargets(targets = DOCUMENT_SCAN_TARGETS) {
    const rootFiles = readdirSync(ROOT, { withFileTypes: true })
        .filter(entry => entry.isFile())
        .map(entry => entry.name)
        .filter(name => ROOT_DOCUMENT_SCAN_PATTERN.test(name) || ROOT_DOCUMENT_SPECIAL_FILES.has(name));
    const targetSet = new Set([...targets, ...rootFiles]);
    return [...targetSet].filter(target => existsSync(path.join(ROOT, target)));
}

function patternMatches(sourcePath, pattern) {
    const normalizedSource = normalizePath(sourcePath);
    const normalizedPattern = normalizePath(pattern);
    if (normalizedPattern.endsWith('/**')) {
        return normalizedSource.startsWith(normalizedPattern.slice(0, -3));
    }
    return normalizedSource === normalizedPattern;
}

function matchesHistoricalSource(sourcePath) {
    return HISTORICAL_SOURCES.some(source => patternMatches(sourcePath, source));
}

function parseRgMatches(stdout) {
    return (stdout || '')
        .split(/\r?\n/)
        .filter(Boolean)
        .map(line => {
            const match = line.match(/^(.+?):(\d+):(.*)$/);
            if (!match) return null;
            return {
                path: normalizePath(match[1]),
                line: Number(match[2]),
                text: match[3].trim()
            };
        })
        .filter(Boolean);
}

function summarizeMatchesByPath(matches, classifySource) {
    const byPath = new Map();
    for (const match of matches) {
        if (!byPath.has(match.path)) {
            byPath.set(match.path, {
                path: match.path,
                count: 0,
                firstLine: match.line,
                treatment: classifySource(match.path)
            });
        }
        const entry = byPath.get(match.path);
        entry.count += 1;
        entry.firstLine = Math.min(entry.firstLine, match.line);
    }
    return [...byPath.values()].sort((a, b) => (
        a.treatment.localeCompare(b.treatment)
        || a.path.localeCompare(b.path, undefined, { numeric: true })
    ));
}

function isIncludedChecklistSource(sourcePath) {
    return sourcePath === 'docs/FACEBOOK_OAUTH_COMPLIANCE.md'
        || sourcePath === 'memory/project_automation_roadmap.md'
        || sourcePath === 'chrome-extension/README.md'
        || sourcePath.startsWith('docs/superpowers/plans/');
}

function classifyUncheckedChecklistSource(sourcePath) {
    if (isIncludedChecklistSource(sourcePath)) {
        return 'Included as explicit checklist backlog';
    }
    if (sourcePath.startsWith('.agents/skills/')) {
        return 'Excluded: agent skill runbook checklist, not persistent backlog';
    }
    if (sourcePath === '.github/PULL_REQUEST_TEMPLATE.md') {
        return 'Excluded: pull request template checklist, not persistent backlog';
    }
    if (
        sourcePath.startsWith('docs/commands/')
        || sourcePath === 'docs/DEPLOYMENT.md'
        || sourcePath === 'docs/SECURITY-GUIDE.md'
        || sourcePath === 'docs/reference/security.md'
    ) {
        return 'Excluded: procedural runbook checklist, not persistent backlog';
    }
    if (sourcePath === 'docs/SNAPSHOT_CERTIFICATION_CHECKLIST.md') {
        return 'Excluded: point-in-time certification runbook';
    }
    if (matchesHistoricalSource(sourcePath) || sourcePath.startsWith('docs/archive/')) {
        return 'Excluded: historical evidence, verify before promotion';
    }
    return 'Excluded pending source-policy review';
}

function classifyOpenMarkerSource(sourcePath) {
    if (sourcePath === 'docs/OPEN_ITEMS.md') {
        return 'Generated canonical output; excluded from self-scan';
    }
    if (sourcePath === 'docs/open-items/source-policy.md' || sourcePath === 'docs/open-items/items.json') {
        return 'Canonical open-items configuration';
    }
    if (sourcePath === 'docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md') {
        return 'Included as competitor intelligence gap source';
    }
    if (sourcePath.startsWith('docs/COMPETITOR_')) {
        return 'Competitor research evidence; canonical gaps parsed from gap inventory';
    }
    if (sourcePath === 'docs/PERFECT_ANTI_DETECTION_SYSTEM.md') {
        return 'Included as anti-detection design gap source';
    }
    if (sourcePath.startsWith('docs/walkthrough/')) {
        return 'Included via walkthrough parser when table status is active';
    }
    if (sourcePath === 'docs/reference/deep-dive-backlog.md') {
        return 'Included as structural/refactor backlog';
    }
    if (sourcePath.startsWith('docs/superpowers/plans/')) {
        return 'Included when unchecked checklist rows exist';
    }
    if (
        sourcePath === 'docs/FACEBOOK_OAUTH_COMPLIANCE.md'
        || sourcePath === 'memory/project_automation_roadmap.md'
        || sourcePath === 'chrome-extension/README.md'
    ) {
        return 'Included as explicit checklist source';
    }
    if (sourcePath === 'memory/STATUS.md' || sourcePath === 'memory/LAUNCH_PRIORITY.md' || sourcePath.startsWith('memory/')) {
        return 'Excluded: session memory, promote only after current verification';
    }
    if (matchesHistoricalSource(sourcePath) || sourcePath.startsWith('docs/archive/') || sourcePath.startsWith('docs/audits/')) {
        return 'Excluded: historical evidence, verify before promotion';
    }
    if (sourcePath.startsWith('qa/reports/') || sourcePath.startsWith('qa/audits/') || sourcePath.startsWith('data/qa-report')) {
        return 'Excluded: timestamped QA evidence, not current truth';
    }
    if (sourcePath.startsWith('.agents/skills/')) {
        return 'Excluded: agent skill runbook, not persistent backlog';
    }
    if (sourcePath === '.github/PULL_REQUEST_TEMPLATE.md') {
        return 'Excluded: pull request template, not persistent backlog';
    }
    if (
        sourcePath.startsWith('docs/commands/')
        || sourcePath === 'docs/DEPLOYMENT.md'
        || sourcePath === 'docs/SECURITY-GUIDE.md'
        || sourcePath === 'docs/reference/security.md'
        || sourcePath === 'docs/SNAPSHOT_CERTIFICATION_CHECKLIST.md'
    ) {
        return 'Excluded: runbook/checklist gate, not persistent backlog';
    }
    if (sourcePath.startsWith('docs/reference/') || sourcePath.startsWith('design/')) {
        return 'Reference/design source; verify before promotion';
    }
    if (sourcePath.startsWith('docs/superpowers/specs/')) {
        return 'Design spec; implementation tasks live in plans/checklists';
    }
    if (
        sourcePath === 'AGENTS.md'
        || sourcePath === 'CLAUDE.md'
    ) {
        return 'Project instructions; not backlog source';
    }
    if (
        sourcePath === 'README.md'
        || sourcePath === 'RAILWAY_OPERATIONS.md'
        || sourcePath === 'CHANGELOG.md'
        || sourcePath === 'CODE_OF_CONDUCT.md'
        || sourcePath === 'CONTRIBUTING.md'
        || sourcePath === 'Items to Add to list of Open Items.md'
        || sourcePath === 'RELEASE.md'
        || sourcePath === 'SECURITY.md'
        || sourcePath === 'docs/CLOUDFLARE-AUDIT-2026-03-29.md'
        || sourcePath === 'docs/FEATURE_INVENTORY.md'
        || sourcePath === 'docs/FRONTEND_SOURCE_OF_TRUTH.md'
        || sourcePath === 'docs/PRD.md'
        || sourcePath === 'docs/SETUP.md'
        || sourcePath === 'public/llms.txt'
    ) {
        return 'Reference/product documentation; not parsed as backlog unless promoted';
    }
    if (sourcePath === 'qa/coverage_matrix.md' || sourcePath === 'qa/full_testing_taxonomy.md') {
        return 'QA coverage reference; individual gaps require current verification before promotion';
    }
    if (
        sourcePath === 'package.json'
        || sourcePath === 'package-lock.json'
        || sourcePath === 'bunfig.toml'
        || sourcePath === 'browserstack.yml'
        || sourcePath === 'cspell.json'
        || sourcePath === 'knip.json'
        || sourcePath.startsWith('.')
        || sourcePath.startsWith('Dockerfile')
        || sourcePath.startsWith('docker-compose')
        || sourcePath.startsWith('railway')
        || sourcePath.endsWith('.json')
        || sourcePath.endsWith('.toml')
        || sourcePath.endsWith('.yml')
        || sourcePath.endsWith('.yaml')
    ) {
        return 'Config/workflow text; parsed separately only if promoted';
    }
    return 'Candidate source; manual source-policy review required';
}

function loadRegistry() {
    if (!existsSync(REGISTRY_PATH)) {
        return { items: [], warnings: [`Missing registry: ${rel(REGISTRY_PATH)}`] };
    }

    try {
        const parsed = JSON.parse(readText(REGISTRY_PATH));
        return {
            items: Array.isArray(parsed.items) ? parsed.items : [],
            warnings: []
        };
    } catch (error) {
        return {
            items: [],
            warnings: [`Failed to parse ${rel(REGISTRY_PATH)}: ${error.message}`]
        };
    }
}

function parseWalkthroughItems() {
    const items = [];
    if (!existsSync(WALKTHROUGH_DIR)) return items;

    const files = readdirSync(WALKTHROUGH_DIR)
        .filter(name => name.endsWith('.md') && name !== 'INDEX.md')
        .sort();

    for (const fileName of files) {
        const filePath = path.join(WALKTHROUGH_DIR, fileName);
        const sourcePath = rel(filePath);
        const lines = readLines(filePath);
        let section = '';
        let headers = null;

        for (let index = 0; index < lines.length; index += 1) {
            const line = lines[index];
            const heading = line.match(/^(#{2,6})\s+(.+)$/);
            if (heading) {
                section = stripMarkdown(heading[2]);
                headers = null;
                continue;
            }

            if (!line.trim().startsWith('|')) {
                headers = null;
                continue;
            }

            if (index + 1 < lines.length && isSeparatorRow(lines[index + 1])) {
                headers = splitTableRow(line);
                index += 1;
                continue;
            }

            if (!headers || isSeparatorRow(line)) continue;

            const cells = splitTableRow(line);
            if (!cells || cells.length < 2) continue;

            const statusIndex = headerIndex(headers, ['status']);
            const useCanonicalFiveColumn = cells.length >= 5 && (headers.length < 5 || statusIndex >= cells.length);
            const statusText = cells[useCanonicalFiveColumn ? cells.length - 1 : (statusIndex >= 0 ? statusIndex : cells.length - 1)] || '';
            const status = classifyStatus(statusText);
            if (!status) continue;

            const idIndex = headerIndex(headers, ['id', '#']);
            const areaIndex = headerIndex(headers, ['page / component', 'area', 'component']);
            const titleIndex = headerIndex(headers, ['issue', 'finding', 'description']);

            const rawId = useCanonicalFiveColumn
                ? stripMarkdown(cells[0])
                : (idIndex >= 0 ? stripMarkdown(cells[idIndex]) : '');
            const title = stripMarkdown(cells[useCanonicalFiveColumn ? 2 : (titleIndex >= 0 ? titleIndex : 0)]);
            const area = useCanonicalFiveColumn
                ? stripMarkdown(cells[1])
                : areaIndex >= 0
                ? stripMarkdown(cells[areaIndex])
                : areaFromFile(fileName);
            const id = rawId && rawId !== '-' ? rawId : deriveId(sourcePath, index + 1, title);

            items.push({
                id,
                title,
                status,
                statusText: stripMarkdown(statusText),
                category: 'walkthrough',
                area,
                section,
                source: { path: sourcePath, line: index + 1 },
                sources: [{ path: sourcePath, line: index + 1, statusText: stripMarkdown(statusText) }]
            });
        }
    }

    return items;
}

function mergeWalkthroughItems(items) {
    const byId = new Map();
    for (const item of items) {
        const key = item.id.toLowerCase();
        if (!byId.has(key)) {
            byId.set(key, { ...item, sources: [...item.sources] });
            continue;
        }

        const existing = byId.get(key);
        existing.sources.push(...item.sources);
        if (!existing.title || item.title.length > existing.title.length) {
            existing.title = item.title;
        }
        if (!existing.area || item.area.length > existing.area.length) {
            existing.area = item.area;
        }
    }
    return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

function applyRegistryMetadata(items, registryItems) {
    const byId = new Map(items.map(item => [item.id.toLowerCase(), item]));

    for (const registryItem of registryItems) {
        const key = String(registryItem.id || '').toLowerCase();
        if (!key) continue;

        if (byId.has(key)) {
            const item = byId.get(key);
            for (const field of ['priority', 'category', 'next_action', 'blocker', 'owner']) {
                if (registryItem[field]) item[field] = registryItem[field];
            }
            if (registryItem.area) item.area = registryItem.area;
            continue;
        }

        if (registryItem.status) {
            const source = registryItem.source || { path: rel(REGISTRY_PATH), line: 1 };
            byId.set(key, {
                id: registryItem.id,
                title: registryItem.title || registryItem.id,
                status: registryItem.status,
                statusText: registryItem.status,
                priority: registryItem.priority || 'normal',
                category: registryItem.category || 'registry',
                area: registryItem.area || 'Registry',
                next_action: registryItem.next_action || '',
                blocker: registryItem.blocker || '',
                owner: registryItem.owner || '',
                source,
                sources: [{ ...source, statusText: registryItem.status }]
            });
        }
    }

    return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

function parseDeepDiveBacklog() {
    if (!existsSync(DEEP_DIVE_BACKLOG_PATH)) return [];

    const sourcePath = rel(DEEP_DIVE_BACKLOG_PATH);
    const lines = readLines(DEEP_DIVE_BACKLOG_PATH);
    const items = [];
    let section = '';
    let headers = null;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const heading = line.match(/^(#{2,6})\s+(.+)$/);
        if (heading) {
            section = stripMarkdown(heading[2]);
            headers = null;
            continue;
        }

        if (!line.trim().startsWith('|')) {
            headers = null;
            continue;
        }

        if (index + 1 < lines.length && isSeparatorRow(lines[index + 1])) {
            headers = splitTableRow(line);
            index += 1;
            continue;
        }

        if (!headers || isSeparatorRow(line)) continue;

        const cells = splitTableRow(line);
        if (!cells || cells.length < 2) continue;

        const riskIndex = headerIndex(headers, ['risk id']);
        const areaIndex = headerIndex(headers, ['area']);
        const inspectIndex = headerIndex(headers, ['what to inspect']);
        const evidenceIndex = headerIndex(headers, ['evidence path']);
        const blockedIndex = headerIndex(headers, ['blocked until inspection complete']);

        if (riskIndex < 0 || inspectIndex < 0) continue;

        const id = stripMarkdown(cells[riskIndex] || '');
        if (!/^R-\d+/i.test(id)) continue;

        const blockedText = blockedIndex >= 0
            ? stripMarkdown(cells[cells.length > headers.length ? cells.length - 1 : blockedIndex] || '')
            : '';
        const blocked = /^yes$/i.test(blockedText);
        const priority = section.startsWith('P1') ? 'refactor-p1' : section.startsWith('P2') ? 'refactor-p2' : 'refactor';
        const area = stripMarkdown(cells[areaIndex] || id);
        const inspect = stripMarkdown(cells[inspectIndex] || '');
        const evidence = stripMarkdown(cells[evidenceIndex] || '');
        const statusText = blocked
            ? 'BLOCKED UNTIL INSPECTION COMPLETE'
            : 'OPEN — inspect before extraction/refactor';

        items.push({
            id,
            priority,
            area,
            title: evidence || area,
            statusText,
            next_action: inspect,
            blocker: blocked ? 'Required inspection steps are not complete.' : '',
            source: { path: sourcePath, line: index + 1 }
        });
    }

    return items.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

function parseCompetitorGapLine(line) {
    const bullet = line.match(/^\s*-\s+(.+)$/);
    if (!bullet) return null;

    let body = bullet[1].trim();
    const isStruck = body.startsWith('~~');
    if (isStruck) body = body.slice(2);

    const prefixMatch = body.match(/^\[([FPBI])\]\s+(.+)$/);
    if (prefixMatch) {
        return {
            code: prefixMatch[1],
            title: prefixMatch[2],
            isStruck
        };
    }

    const suffixMatch = body.match(/^(.+?)\s+\[([FPBI])\](?:\s+(.+))?\s*$/);
    if (suffixMatch) {
        return {
            code: suffixMatch[2],
            title: [suffixMatch[1], suffixMatch[3]].filter(Boolean).join(' '),
            isStruck
        };
    }

    return null;
}

function isOpenCompetitorGapLine(line, isStruck) {
    if (!isStruck) return true;

    const lower = line.toLowerCase();
    return lower.includes('re-opened')
        || lower.includes('gap remains open')
        || lower.includes('partially closed')
        || lower.includes('partially resolved');
}

function parseCompetitorGaps() {
    if (!existsSync(COMPETITOR_GAP_INVENTORY_PATH)) return [];

    const sourcePath = rel(COMPETITOR_GAP_INVENTORY_PATH);
    const lines = readLines(COMPETITOR_GAP_INVENTORY_PATH);
    const items = [];
    const headings = [{ level: 1, title: 'Competitor Intelligence' }];

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const heading = line.match(/^(#{2,6})\s+(.+)$/);
        if (heading) {
            const level = heading[1].length;
            while (headings.length && headings[headings.length - 1].level >= level) {
                headings.pop();
            }
            headings.push({ level, title: stripMarkdown(heading[2]) });
            continue;
        }

        const gap = parseCompetitorGapLine(line);
        if (!gap || !isOpenCompetitorGapLine(line, gap.isStruck)) continue;

        const title = stripMarkdown(gap.title.replace(/~~/g, ''));
        items.push({
            id: `COMP-GAP-${index + 1}`,
            area: headings.map(headingItem => headingItem.title).join(' / '),
            closability: COMPETITOR_CLOSABILITY[gap.code] || gap.code,
            title,
            source: { path: sourcePath, line: index + 1 }
        });
    }

    return items;
}

function findUnparsedCompetitorGapMarkers() {
    if (!existsSync(COMPETITOR_GAP_INVENTORY_PATH)) return [];

    const sourcePath = rel(COMPETITOR_GAP_INVENTORY_PATH);
    const lines = readLines(COMPETITOR_GAP_INVENTORY_PATH);
    const unparsed = [];

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (!/^\s*-\s+/.test(line) || !/\[[FPBI]\]/.test(line)) continue;

        const isStruck = /^\s*-\s*~~/.test(line);
        if (isStruck && !isOpenCompetitorGapLine(line, true)) continue;
        if (parseCompetitorGapLine(line)) continue;

        unparsed.push({ path: sourcePath, line: index + 1, text: line.trim() });
    }

    return unparsed;
}

function parseAntiDetectionGaps() {
    if (!existsSync(ANTI_DETECTION_SPEC_PATH)) return [];

    const sourcePath = rel(ANTI_DETECTION_SPEC_PATH);
    const lines = readLines(ANTI_DETECTION_SPEC_PATH);
    const items = [];
    let inSummary = false;

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (/^###\s+Summary of the Biggest Gaps/.test(line)) {
            inSummary = true;
            continue;
        }
        if (inSummary && /^###\s+/.test(line)) break;
        if (!inSummary) continue;

        const match = line.match(/^(\d+)\.\s+(.+)$/);
        if (!match) continue;

        const lower = line.toLowerCase();
        if (lower.includes('~~') && lower.includes('resolved') && !lower.includes('partially resolved')) {
            continue;
        }

        let status = 'OPEN';
        if (lower.includes('partially resolved')) {
            status = 'PARTIALLY RESOLVED — remaining gap open';
        } else if (lower.includes('tooling built')) {
            status = 'VERIFICATION REQUIRED';
        } else if (lower.includes('no code fix')) {
            status = 'OPERATIONAL / NO CODE FIX';
        }

        items.push({
            id: `ANTI-${match[1].padStart(2, '0')}`,
            status,
            title: stripMarkdown(match[2].replace(/~~/g, '')),
            source: { path: sourcePath, line: index + 1 }
        });
    }

    return items;
}

function parseUncheckedFile(filePath, group) {
    // Only `- [ ] item` is open. `- [x]` = done, `- [~]` = won't fix / skipped. Both are ignored.
    if (!existsSync(filePath)) return [];
    const sourcePath = rel(filePath);
    return readLines(filePath)
        .map((line, index) => ({ line, lineNumber: index + 1 }))
        .filter(({ line }) => /^\s*[-*]\s+\[\s\]\s+/.test(line))
        .map(({ line, lineNumber }) => ({
            group,
            title: stripMarkdown(line.replace(/^\s*[-*]\s+\[\s\]\s+/, '')),
            source: { path: sourcePath, line: lineNumber }
        }));
}

function parsePlanBacklog() {
    const plansDir = path.join(ROOT, 'docs', 'superpowers', 'plans');
    if (!existsSync(plansDir)) return [];
    return readdirSync(plansDir)
        .filter(name => name.endsWith('.md'))
        .sort()
        .flatMap(name => parseUncheckedFile(path.join(plansDir, name), `Plan: ${name}`));
}

function parseChecklists() {
    return [
        ...parseUncheckedFile(path.join(ROOT, 'docs', 'FACEBOOK_OAUTH_COMPLIANCE.md'), 'Facebook OAuth Compliance'),
        ...parseUncheckedFile(path.join(ROOT, 'memory', 'project_automation_roadmap.md'), 'Automation Roadmap'),
        ...parseUncheckedFile(path.join(ROOT, 'chrome-extension', 'README.md'), 'Chrome Extension Future Features'),
        ...parsePlanBacklog()
    ];
}

function scanUncheckedChecklistSources(warnings) {
    const targets = existingScanTargets();
    if (!targets.length) return [];

    const result = run('rg', [
        '-n',
        '^\\s*[-*]\\s+\\[ \\]',
        ...targets,
        '--glob', '*.md',
        '--glob', '!**/node_modules/**',
        '--glob', '!**/dist/**',
        '--glob', '!**/playwright-report/**',
        '--glob', '!**/test-results/**',
        '--glob', '!**/coverage/**'
    ]);

    if (!result.ok && result.status !== 1) {
        warnings.push(`Unchecked checklist scan failed: ${result.stderr || result.stdout || `exit ${result.status}`}`);
        return [];
    }

    return summarizeMatchesByPath(parseRgMatches(result.stdout), classifyUncheckedChecklistSource);
}

function fetchGithubIssues(warnings) {
    if (noLive) {
        warnings.push('Skipped live GitHub issue fetch because --no-live was supplied.');
        return { available: false, issues: [] };
    }

    const ghArgs = [
        'issue',
        'list',
        '--state',
        'open',
        '--limit',
        '200',
        '--json',
        'number,title,labels,updatedAt,url'
    ];

    let result = run('gh', ghArgs, { env: withoutGithubTokenEnv() });
    if (!result.ok) {
        const fallback = run('gh', ghArgs);
        if (fallback.ok) {
            result = fallback;
        }
    }

    if (!result.ok) {
        warnings.push(`GitHub issue fetch failed: ${result.stderr || result.stdout || `exit ${result.status}`}`);
        return { available: false, issues: [] };
    }

    try {
        return { available: true, issues: JSON.parse(result.stdout || '[]') };
    } catch (error) {
        warnings.push(`Failed to parse gh issue list output: ${error.message}`);
        return { available: false, issues: [] };
    }
}

function scanTodos(warnings) {
    const commandArgs = [
        '-n',
        'TODO|FIXME',
        ...TODO_DIRS,
        ...TODO_GLOBS.flatMap(glob => ['--glob', glob])
    ];
    const result = run('rg', commandArgs);

    if (!result.ok && result.status !== 1) {
        warnings.push(`TODO/FIXME scan failed: ${result.stderr || result.stdout || `exit ${result.status}`}`);
        return [];
    }

    return (result.stdout || '')
        .split(/\r?\n/)
        .filter(Boolean)
        .map(line => {
            const match = line.match(/^(.+?):(\d+):(.*)$/);
            if (!match) {
                return { source: { path: 'unknown', line: 0 }, text: stripMarkdown(line) };
            }
            return {
                source: { path: match[1].replace(/\\/g, '/'), line: Number(match[2]) },
                text: match[3].trim()
            };
        })
        .sort((a, b) => (
            a.source.path.localeCompare(b.source.path)
            || a.source.line - b.source.line
            || a.text.localeCompare(b.text)
        ));
}

function scanOpenMarkerSources(warnings) {
    const targets = existingScanTargets();
    if (!targets.length) return [];

    const result = run('rg', [
        '-n',
        '-i',
        OPEN_MARKER_PATTERN,
        ...targets,
        ...DOCUMENT_SCAN_GLOBS
    ]);

    if (!result.ok && result.status !== 1) {
        warnings.push(`Open-marker source scan failed: ${result.stderr || result.stdout || `exit ${result.status}`}`);
        return [];
    }

    return summarizeMatchesByPath(parseRgMatches(result.stdout), classifyOpenMarkerSource);
}

function readCommit() {
    const result = run('git', ['rev-parse', '--short', 'HEAD']);
    return result.ok && result.stdout ? result.stdout : 'unknown';
}

function renderSourceList(item) {
    const sources = item.sources || (item.source ? [item.source] : []);
    return sources.map(source => `${source.path}:${source.line}`).join('<br>');
}

function renderItemsTable(items) {
    if (!items.length) return '_None._\n';
    const rows = [
        '| ID | Status | Priority | Area | Item | Source | Next Action | Blocker |',
        '|---|---|---|---|---|---|---|---|'
    ];
    for (const item of items) {
        rows.push([
            escapeCell(item.id),
            escapeCell(item.statusText || item.status),
            escapeCell(item.priority || ''),
            escapeCell(item.area || ''),
            escapeCell(item.title || ''),
            escapeCell(renderSourceList(item)),
            escapeCell(item.next_action || ''),
            escapeCell(item.blocker || '')
        ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
    }
    return `${rows.join('\n')}\n`;
}

function renderGithubTable(issues) {
    if (!issues.length) return '_No open GitHub issues returned by the live query._\n';
    const rows = [
        '| Issue | Title | Labels | Updated | URL |',
        '|---|---|---|---|---|'
    ];
    for (const issue of issues) {
        rows.push(`| #${issue.number} | ${escapeCell(issue.title)} | ${escapeCell((issue.labels || []).map(label => label.name).join(', '))} | ${escapeCell(issue.updatedAt)} | ${escapeCell(issue.url)} |`);
    }
    return `${rows.join('\n')}\n`;
}

function renderStructuralBacklogTable(items) {
    if (!items.length) return '_No structural/refactor backlog items found._\n';
    const rows = [
        '| ID | Priority | Area | Evidence | Required Inspection / Next Action | Blocker | Source |',
        '|---|---|---|---|---|---|---|'
    ];
    for (const item of items) {
        rows.push([
            escapeCell(item.id),
            escapeCell(item.priority || ''),
            escapeCell(item.area || ''),
            escapeCell(item.title || ''),
            escapeCell(item.next_action || ''),
            escapeCell(item.blocker || ''),
            escapeCell(sourceRef(item.source))
        ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
    }
    return `${rows.join('\n')}\n`;
}

function renderCompetitorGapTable(items) {
    if (!items.length) return '_No competitor intelligence gaps found._\n';
    const rows = [
        '| ID | Closability | Area | Gap | Source |',
        '|---|---|---|---|---|'
    ];
    for (const item of items) {
        rows.push([
            escapeCell(item.id),
            escapeCell(item.closability),
            escapeCell(item.area),
            escapeCell(item.title),
            escapeCell(sourceRef(item.source))
        ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
    }
    return `${rows.join('\n')}\n`;
}

function renderAntiDetectionGapTable(items) {
    if (!items.length) return '_No anti-detection design gaps found._\n';
    const rows = [
        '| ID | Status | Gap | Source |',
        '|---|---|---|---|'
    ];
    for (const item of items) {
        rows.push([
            escapeCell(item.id),
            escapeCell(item.status),
            escapeCell(item.title),
            escapeCell(sourceRef(item.source))
        ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
    }
    return `${rows.join('\n')}\n`;
}

function groupBy(items, keyFn) {
    const groups = new Map();
    for (const item of items) {
        const key = keyFn(item);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
}

function renderChecklistSection(checklistItems) {
    if (!checklistItems.length) return '_No unchecked checklist items found._\n';
    const output = [];
    for (const [group, items] of groupBy(checklistItems, item => item.group)) {
        output.push(`### ${group}`);
        output.push('');
        output.push(`Count: ${items.length}`);
        output.push('');
        output.push('| Item | Source |');
        output.push('|---|---|');
        for (const item of items) {
            output.push(`| ${escapeCell(item.title)} | ${escapeCell(sourceRef(item.source))} |`);
        }
        output.push('');
    }
    return output.join('\n');
}

function renderTodoTable(todos) {
    if (!todos.length) return '_No TODO/FIXME hits found._\n';
    const rows = [
        '| Source | Text |',
        '|---|---|'
    ];
    for (const todo of todos) {
        rows.push(`| ${escapeCell(sourceRef(todo.source))} | ${escapeCell(todo.text)} |`);
    }
    return `${rows.join('\n')}\n`;
}

function renderSourceCoverageTable(entries) {
    if (!entries.length) return '_No matching sources found._\n';
    const rows = [
        '| Source | Matches | First Match | Treatment |',
        '|---|---:|---:|---|'
    ];
    for (const entry of entries) {
        rows.push(`| ${escapeCell(entry.path)} | ${entry.count} | ${entry.firstLine} | ${escapeCell(entry.treatment)} |`);
    }
    return `${rows.join('\n')}\n`;
}

function countEntries(entries, predicate) {
    return entries.reduce((sum, entry) => sum + (predicate(entry) ? entry.count : 0), 0);
}

function renderReport(data) {
    const {
        generatedAt,
        commit,
        warnings,
        items,
        structuralBacklog,
        competitorGaps,
        antiDetectionGaps,
        githubIssues,
        githubIssuesAvailable,
        checklistItems,
        todos,
        uncheckedSourceCoverage,
        openMarkerCoverage
    } = data;

    const launchBlockers = items.filter(item => item.priority === 'launch-blocker' && item.status !== 'fixed-pending-live-verification');
    const openWalkthrough = items.filter(item =>
        item.priority !== 'launch-blocker' &&
        ['open', 'open-not-verified', 'question', 'blocked'].includes(item.status)
    );
    const fixedPending = items.filter(item => item.status === 'fixed-pending-live-verification');
    const deferred = items.filter(item => item.status === 'deferred');

    const lines = [];
    lines.push('<!-- GENERATED FILE. DO NOT EDIT DIRECTLY. Run `bun run open-items` instead. -->');
    lines.push('');
    lines.push('# VaultLister Open Items');
    lines.push('');
    lines.push(`Generated at: ${generatedAt}`);
    lines.push(`Commit: ${commit}`);
    lines.push('Generator: `bun scripts/generate-open-items.mjs`');
    lines.push('Check: `bun run open-items:check`');
    lines.push('');
    lines.push('Source priority: `docs/open-items/items.json` metadata > current `docs/walkthrough/` status > structural/refactor backlog > live GitHub issues > explicit checklists > specialized research/design backlogs > source scans.');
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push('| Section | Count |');
    lines.push('|---|---:|');
    lines.push(`| Launch blockers | ${launchBlockers.length} |`);
    lines.push(`| Open walkthrough/product items | ${openWalkthrough.length} |`);
    lines.push(`| Fixed pending live/manual verification | ${fixedPending.length} |`);
    lines.push(`| Deferred/post-launch items | ${deferred.length} |`);
    lines.push(`| Structural/refactor backlog items | ${structuralBacklog.length} |`);
    lines.push(`| Competitor intelligence gaps | ${competitorGaps.length} |`);
    lines.push(`| Anti-detection/design gaps | ${antiDetectionGaps.length} |`);
    lines.push(`| Open GitHub issues | ${githubIssuesAvailable ? githubIssues.length : 'unknown'} |`);
    lines.push(`| Explicit unchecked checklist items | ${checklistItems.length} |`);
    lines.push(`| Repo-wide unchecked checkbox hits | ${uncheckedSourceCoverage.reduce((sum, entry) => sum + entry.count, 0)} |`);
    lines.push(`| Repo-wide unchecked checkbox hits included | ${countEntries(uncheckedSourceCoverage, entry => entry.treatment.startsWith('Included'))} |`);
    lines.push(`| Repo-wide unchecked checkbox hits excluded or review-only | ${countEntries(uncheckedSourceCoverage, entry => !entry.treatment.startsWith('Included'))} |`);
    lines.push(`| Open-marker source files discovered | ${openMarkerCoverage.length} |`);
    lines.push(`| Source TODO/FIXME hits | ${todos.length} |`);
    lines.push('');

    if (warnings.length) {
        lines.push('## Warnings');
        lines.push('');
        for (const warning of warnings) lines.push(`- ${String(warning).replace(/\s+/g, ' ').trim()}`);
        lines.push('');
    }

    lines.push('## Source Coverage Audit');
    lines.push('');
    lines.push('This section proves the consolidation boundary. It lists every source with unchecked Markdown task boxes and every text/config source with open-style markers found by the generator. Sources marked excluded are not treated as active backlog unless a current source promotes them.');
    lines.push('');
    lines.push('### Unchecked Checklist Source Coverage');
    lines.push('');
    lines.push('Command: `rg -n "^\\s*[-*]\\s+\\[ \\]" <document targets> --glob "*.md"`');
    lines.push('');
    lines.push(renderSourceCoverageTable(uncheckedSourceCoverage));
    lines.push('### Open-Marker Source Coverage');
    lines.push('');
    lines.push(`Command: \`rg -n -i "${OPEN_MARKER_PATTERN}" <document targets>\``);
    lines.push('');
    lines.push(renderSourceCoverageTable(openMarkerCoverage));
    lines.push('## Launch Blockers');
    lines.push('');
    lines.push(renderItemsTable(launchBlockers));
    lines.push('## Open Walkthrough / Product Items');
    lines.push('');
    lines.push(renderItemsTable(openWalkthrough));
    lines.push('## Fixed Pending Live / Manual Verification');
    lines.push('');
    lines.push(renderItemsTable(fixedPending));
    lines.push('## Deferred / Post-Launch Items');
    lines.push('');
    lines.push(renderItemsTable(deferred));
    lines.push('## Structural / Refactor Backlog');
    lines.push('');
    lines.push('These are read-only refactor risk items from `docs/reference/deep-dive-backlog.md`. They are not launch blockers unless separately promoted in `docs/open-items/items.json`.');
    lines.push('');
    lines.push(renderStructuralBacklogTable(structuralBacklog));
    lines.push('## Competitor Intelligence Gaps');
    lines.push('');
    lines.push('These are research backlog items from `docs/COMPETITOR_GAP_INVENTORY_2026-04-19.md`. They are not VaultLister launch blockers unless separately promoted.');
    lines.push('');
    lines.push(renderCompetitorGapTable(competitorGaps));
    lines.push('## Anti-Detection / Facebook Automation Design Gaps');
    lines.push('');
    lines.push('These are design and operational gaps from `docs/PERFECT_ANTI_DETECTION_SYSTEM.md`. They are not launch blockers unless separately promoted.');
    lines.push('');
    lines.push(renderAntiDetectionGapTable(antiDetectionGaps));
    lines.push('## GitHub Open Issues');
    lines.push('');
    lines.push('Command: `gh issue list --state open --limit 200 --json number,title,labels,updatedAt,url`');
    lines.push('');
    if (githubIssuesAvailable) {
        lines.push(renderGithubTable(githubIssues));
    } else {
        lines.push('_Live GitHub issue query unavailable. See Warnings above; do not treat this as zero open issues._\n');
    }
    lines.push('## Explicit Checklist Backlogs');
    lines.push('');
    lines.push(renderChecklistSection(checklistItems));
    lines.push('## Source TODO/FIXME Scan');
    lines.push('');
    lines.push('Command: `rg -n "TODO|FIXME" src public scripts worker design e2e qa data .github archive chrome-extension mobile nginx .agents`');
    lines.push('');
    lines.push(renderTodoTable(todos));
    lines.push('## Historical Sources Excluded');
    lines.push('');
    lines.push('These files are evidence only. They are not parsed as canonical open-item sources.');
    lines.push('');
    for (const source of HISTORICAL_SOURCES) lines.push(`- \`${source}\``);
    lines.push('');

    return `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`;
}

const registry = loadRegistry();
const warnings = [...registry.warnings];
const walkthroughItems = mergeWalkthroughItems(parseWalkthroughItems());
const items = applyRegistryMetadata(walkthroughItems, registry.items);
const structuralBacklog = parseDeepDiveBacklog();
const competitorGaps = parseCompetitorGaps();
const unparsedCompetitorGapMarkers = findUnparsedCompetitorGapMarkers();
if (unparsedCompetitorGapMarkers.length) {
    const examples = unparsedCompetitorGapMarkers
        .slice(0, 5)
        .map(source => `${source.path}:${source.line} ${source.text}`)
        .join('; ');
    console.error(`Unparsed open competitor gap markers: ${examples}`);
    process.exit(1);
}
const antiDetectionGaps = parseAntiDetectionGaps();
const githubResult = fetchGithubIssues(warnings);
const checklistItems = parseChecklists();
const todos = scanTodos(warnings);
const uncheckedSourceCoverage = scanUncheckedChecklistSources(warnings);
const openMarkerCoverage = scanOpenMarkerSources(warnings);
const report = renderReport({
    generatedAt: new Date().toISOString(),
    commit: readCommit(),
    warnings,
    items,
    structuralBacklog,
    competitorGaps,
    antiDetectionGaps,
    githubIssues: githubResult.issues,
    githubIssuesAvailable: githubResult.available,
    checklistItems,
    todos,
    uncheckedSourceCoverage,
    openMarkerCoverage
});

if (checkMode) {
    if (!existsSync(OUTPUT_PATH)) {
        console.error(`Missing generated report: ${rel(OUTPUT_PATH)}`);
        process.exit(1);
    }

    const current = readText(OUTPUT_PATH);
    if (normalizeForCheck(current) !== normalizeForCheck(report)) {
        console.error(`${rel(OUTPUT_PATH)} is stale. Run: bun run open-items`);
        process.exit(1);
    }

    console.log(`${rel(OUTPUT_PATH)} is current.`);
} else {
    writeFileSync(OUTPUT_PATH, report, 'utf8');
    console.log(`Wrote ${rel(OUTPUT_PATH)}`);
}
