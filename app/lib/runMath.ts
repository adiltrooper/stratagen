import { MAX_DISTANCE, MAX_PACE_SECONDS, MAX_TIME_SECONDS } from './stravaLayout';

export type RunField = 'distance' | 'pace' | 'time';

// Pace is seconds per unit of distance; the maths is the same in km or mi
export interface RunStats {
    distance: number;
    paceSeconds: number;
    timeSeconds: number;
}

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

// Works out `field` from the other two. Leaves the stats unchanged if either of those is zero.
// Results are clamped to what the fields can display (e.g. times over 9h 59m 59s).
export function solveRun(stats: RunStats, field: RunField): RunStats {
    const { distance, paceSeconds, timeSeconds } = stats;

    switch (field) {
        case 'time':
            if (!distance || !paceSeconds) return stats;
            return { ...stats, timeSeconds: clamp(Math.round(distance * paceSeconds), MAX_TIME_SECONDS) };
        case 'pace':
            if (!distance || !timeSeconds) return stats;
            return { ...stats, paceSeconds: clamp(Math.round(timeSeconds / distance), MAX_PACE_SECONDS) };
        case 'distance':
            if (!paceSeconds || !timeSeconds) return stats;
            return { ...stats, distance: clamp(Math.round((timeSeconds / paceSeconds) * 100) / 100, MAX_DISTANCE) };
    }
}
