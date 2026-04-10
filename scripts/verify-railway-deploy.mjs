#!/usr/bin/env bun
import { execFileSync } from 'node:child_process';

const EXPECTED_DEFAULTS = {
    environment: 'production',
    commit: null,
    services: {
        'vaultlister-app': {
            status: 'SUCCESS',
            configFile: '/railway.json',
            dockerfilePath: 'Dockerfile',
            healthcheckPath: '/api/health/ready',
            healthcheckTimeout: 300,
            overlapSeconds: 30,
            drainingSeconds: 30,
            restartPolicyType: 'ON_FAILURE',
            restartPolicyMaxRetries: 3,
            numReplicas: 1
        },
        'vaultlister-worker': {
            status: 'SUCCESS',
            configFile: '/worker/railway.json',
            dockerfilePath: 'worker/Dockerfile',
            healthcheckPath: null,
            healthcheckTimeout: null,
            overlapSeconds: 30,
            drainingSeconds: 300,
            restartPolicyType: 'ON_FAILURE',
            restartPolicyMaxRetries: 3,
            numReplicas: 1
        }
    }
};

const args = process.argv.slice(2);
const options = {
    environment: readArg('--environment') || EXPECTED_DEFAULTS.environment,
    commit: readArg('--commit') || null,
    json: args.includes('--json'),
    skipCommit: args.includes('--skip-commit')
};

if (args.includes('--help')) {
    console.log(`Usage: bun scripts/verify-railway-deploy.mjs [options]

Options:
  --commit <sha>          Require app and worker latest deployments to match this commit.
  --environment <name>    Railway environment to inspect. Default: production.
  --skip-commit           Do not compare deployment commit hashes.
  --json                  Print machine-readable result JSON.
  --help                  Show this help text.

Requires a Railway-linked working directory and the Railway CLI in PATH.`);
    process.exit(0);
}

if (!options.commit && !options.skipCommit) {
    options.commit = getCurrentGitCommit();
}

const failures = [];
const summaries = [];
let railwayStatus;

try {
    railwayStatus = JSON.parse(execFileSync('railway', ['status', '--json'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    }));
} catch (error) {
    failFast(`Failed to run "railway status --json". Run this from a Railway-linked checkout with Railway CLI authenticated. Detail: ${error.message}`);
}

const environment = findEnvironment(railwayStatus, options.environment);
if (!environment) {
    failFast(`Railway environment not found: ${options.environment}`);
}

for (const [serviceName, expected] of Object.entries(EXPECTED_DEFAULTS.services)) {
    const service = findService(environment, serviceName);
    if (!service) {
        failures.push(`${serviceName}: service not found in environment ${options.environment}`);
        continue;
    }

    const deployment = service.latestDeployment;
    const build = deployment?.meta?.serviceManifest?.build || {};
    const deploy = deployment?.meta?.serviceManifest?.deploy || {};
    const summary = {
        service: serviceName,
        status: deployment?.status,
        commit: deployment?.meta?.commitHash || null,
        configFile: deployment?.meta?.configFile || null,
        dockerfilePath: build.dockerfilePath ?? null,
        healthcheckPath: deploy.healthcheckPath ?? null,
        healthcheckTimeout: deploy.healthcheckTimeout ?? null,
        overlapSeconds: deploy.overlapSeconds ?? null,
        drainingSeconds: deploy.drainingSeconds ?? null,
        restartPolicyType: deploy.restartPolicyType ?? null,
        restartPolicyMaxRetries: deploy.restartPolicyMaxRetries ?? null,
        numReplicas: deploy.numReplicas ?? null
    };
    summaries.push(summary);

    compare(serviceName, 'status', summary.status, expected.status);
    compare(serviceName, 'configFile', summary.configFile, expected.configFile);
    compare(serviceName, 'dockerfilePath', summary.dockerfilePath, expected.dockerfilePath);
    compare(serviceName, 'healthcheckPath', summary.healthcheckPath, expected.healthcheckPath);
    compare(serviceName, 'healthcheckTimeout', summary.healthcheckTimeout, expected.healthcheckTimeout);
    compare(serviceName, 'overlapSeconds', summary.overlapSeconds, expected.overlapSeconds);
    compare(serviceName, 'drainingSeconds', summary.drainingSeconds, expected.drainingSeconds);
    compare(serviceName, 'restartPolicyType', summary.restartPolicyType, expected.restartPolicyType);
    compare(serviceName, 'restartPolicyMaxRetries', summary.restartPolicyMaxRetries, expected.restartPolicyMaxRetries);
    compare(serviceName, 'numReplicas', summary.numReplicas, expected.numReplicas);

    if (options.commit && !options.skipCommit) {
        compare(serviceName, 'commit', summary.commit, options.commit);
    }
}

const result = {
    ok: failures.length === 0,
    environment: options.environment,
    expectedCommit: options.skipCommit ? null : options.commit,
    services: summaries,
    failures
};

if (options.json) {
    console.log(JSON.stringify(result, null, 2));
} else {
    printHumanResult(result);
}

process.exit(result.ok ? 0 : 1);

function readArg(name) {
    const index = args.indexOf(name);
    if (index === -1) return null;
    return args[index + 1] || null;
}

function getCurrentGitCommit() {
    try {
        return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    } catch {
        return null;
    }
}

function findEnvironment(status, name) {
    return status?.environments?.edges
        ?.map(edge => edge.node)
        ?.find(environment => environment.name === name) || null;
}

function findService(environment, name) {
    return environment?.serviceInstances?.edges
        ?.map(edge => edge.node)
        ?.find(service => service.serviceName === name) || null;
}

function compare(serviceName, field, actual, expected) {
    if (actual !== expected) {
        failures.push(`${serviceName}.${field}: expected ${formatValue(expected)}, got ${formatValue(actual)}`);
    }
}

function formatValue(value) {
    return value === null || value === undefined ? String(value) : JSON.stringify(value);
}

function failFast(message) {
    const result = { ok: false, failures: [message] };
    if (options.json) {
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.error(message);
    }
    process.exit(1);
}

function printHumanResult(result) {
    for (const service of result.services) {
        console.log(`${service.service}: status=${service.status} commit=${service.commit} config=${service.configFile} dockerfile=${service.dockerfilePath}`);
    }

    if (result.ok) {
        console.log('Railway deploy verification passed');
        return;
    }

    console.error('Railway deploy verification failed:');
    for (const failure of result.failures) {
        console.error(`- ${failure}`);
    }
}
