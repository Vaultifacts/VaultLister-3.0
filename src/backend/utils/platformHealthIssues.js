export function isOpenPlatformIncident(incident) {
    if (!incident) return false;
    if (incident.resolved_at || incident.resolvedAt) return false;
    if (incident.status === 'resolved') return false;
    return true;
}

export function shouldShowAutoProbeIssue(kindState) {
    return Boolean(kindState && kindState.state && kindState.state !== 'operational');
}
