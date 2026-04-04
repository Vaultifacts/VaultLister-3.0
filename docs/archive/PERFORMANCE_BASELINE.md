# Performance Baseline

Date: 2026-03-05T12:26:00-07:00

## Environment
- Runtime: Dockerized app on `http://localhost:3000`
- Dataset: 1000 imported inventory items (CSV import path)

## Measurements
- Startup seconds: 2.142
- Health latency avg (ms): 1.636
- Inventory list latency avg (ms, 1000-item dataset): 1.080
- Inventory search latency avg (ms, 1000-item dataset): 0.842

## Thresholds
- Startup target `<5s` (warn `<8s`, fail `>=8s`)
- Health/API typical route target `<200ms` (warn `<300ms`, fail `>=300ms`)
- Inventory list/search target `<300ms` for 1000-item dataset

## Evaluation
- Startup pass: true
- Health pass: true
- Inventory list pass: true
- Inventory search pass: true

## Evidence Files
- `docs/evidence/PHASE-04_STARTUP_SECONDS.txt`
- `docs/evidence/PHASE-04_HEALTH_LATENCY_MS.txt`
- `docs/evidence/PHASE-04_HEALTH_LATENCY_SAMPLES.json`
- `docs/evidence/PHASE-04_INVENTORY_LATENCY_MS.txt`
- `docs/evidence/PHASE-04_SEARCH_LATENCY_MS.txt`
- `docs/evidence/PHASE-04_PERF_API_METRICS.json`
