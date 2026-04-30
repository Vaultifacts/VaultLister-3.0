export function deriveRecentHealthState(samples, options = {}) {
    if (!samples || samples.length === 0) return 'operational';

    const outageMin = options.outageMin ?? 3;
    const degradedMin = options.degradedMin ?? 1;
    const normalized = samples
        .map((sample) => ({
            isUp: sample.isUp === true || sample.isUp === 1 || sample.isUp === '1' || sample.isUp === 'true',
            sampledAt: new Date(sample.sampledAt || 0).getTime() || 0,
        }))
        .sort((a, b) => b.sampledAt - a.sampledAt);

    if (normalized[0].isUp) return 'operational';

    const downCount = normalized.filter((sample) => !sample.isUp).length;
    if (downCount >= outageMin) return 'outage';
    if (downCount >= degradedMin) return 'degraded';
    return 'operational';
}
