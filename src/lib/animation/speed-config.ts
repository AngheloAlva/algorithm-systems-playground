/**
 * Speed → ms-per-step mapping for the animation engine.
 *
 * The `advance()` accumulator in stepper.ts divides elapsed time by `msPerStep`.
 * Lower msPerStep = more steps per second = faster animation.
 *
 * Speed levels 1–8 map to discrete msPerStep values that feel responsive
 * at typical trace lengths (300–1000 steps):
 *
 *   Speed 1 (slowest)  → 200ms/step  — ~5 steps/s    — didactic
 *   Speed 2            → 100ms/step  — ~10 steps/s
 *   Speed 3            → 50ms/step   — ~20 steps/s
 *   Speed 4 (default)  → 25ms/step   — ~40 steps/s
 *   Speed 5            → 12ms/step   — ~80 steps/s
 *   Speed 6            → 6ms/step    — ~160 steps/s
 *   Speed 7            → 3ms/step    — ~320 steps/s   — fast sweep
 *   Speed 8 (fastest)  → 1ms/step    — ~1000 steps/s  — near-instant
 *
 * The speed slider maps its discrete positions to these keys.
 * The default speed (4) gives a comfortable 40 steps/s cadence that is
 * neither too slow for short traces nor overwhelming for long ones.
 */

export const SPEED_MAP: Record<number, number> = {
	1: 200,
	2: 100,
	3: 50,
	4: 25,
	5: 12,
	6: 6,
	7: 3,
	8: 1,
}

/** Default speed level. */
export const DEFAULT_SPEED = 4

/** Minimum allowed speed level. */
export const MIN_SPEED = 1

/** Maximum allowed speed level. */
export const MAX_SPEED = 8

/**
 * Resolve the ms-per-step value for a given speed level.
 * Falls back to `SPEED_MAP[DEFAULT_SPEED]` for unknown values.
 */
export function getMsPerStep(speed: number): number {
	return SPEED_MAP[speed] ?? SPEED_MAP[DEFAULT_SPEED]
}
