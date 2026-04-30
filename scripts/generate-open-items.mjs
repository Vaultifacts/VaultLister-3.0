#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dir, '..');
const OUTPUT_PATH = path.join(ROOT, 'docs', 'OPEN_ITEMS.md');
const REGISTRY_PATH = path.join(ROOT, 'docs', 'open-items', 'items.json');
const WALKTHROUGH_DIR = path.join(ROOT, 'docs', 'walkthrough');

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
    'docs/archive/CONSOLIDATED_OPEN_ITEMS_2026-04-29.md',
    'docs/archive/**',
    'qa/reports/**'
];

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
        .replace(/^Commit: .+$/m, 'Commit: <ignored>');
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

function parseUncheckedFile(filePath, group) {
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

function renderReport(data) {
    const {
        generatedAt,
        commit,
        warnings,
        items,
        githubIssues,
        githubIssuesAvailable,
        checklistItems,
        todos
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
    lines.push('Source priority: `docs/open-items/items.json` metadata > current `docs/walkthrough/` status > live GitHub issues > explicit checklists > source scans.');
    lines.push('');
    lines.push('## Summary');
    lines.push('');
    lines.push('| Section | Count |');
    lines.push('|---|---:|');
    lines.push(`| Launch blockers | ${launchBlockers.length} |`);
    lines.push(`| Open walkthrough/product items | ${openWalkthrough.length} |`);
    lines.push(`| Fixed pending live/manual verification | ${fixedPending.length} |`);
    lines.push(`| Deferred/post-launch items | ${deferred.length} |`);
    lines.push(`| Open GitHub issues | ${githubIssuesAvailable ? githubIssues.length : 'unknown'} |`);
    lines.push(`| Explicit unchecked checklist items | ${checklistItems.length} |`);
    lines.push(`| Source TODO/FIXME hits | ${todos.length} |`);
    lines.push('');

    if (warnings.length) {
        lines.push('## Warnings');
        lines.push('');
        for (const warning of warnings) lines.push(`- ${String(warning).replace(/\s+/g, ' ').trim()}`);
        lines.push('');
    }

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
const githubResult = fetchGithubIssues(warnings);
const checklistItems = parseChecklists();
const todos = scanTodos(warnings);
const report = renderReport({
    generatedAt: new Date().toISOString(),
    commit: readCommit(),
    warnings,
    items,
    githubIssues: githubResult.issues,
    githubIssuesAvailable: githubResult.available,
    checklistItems,
    todos
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
