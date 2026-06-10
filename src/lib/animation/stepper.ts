/**
 * Pure accumulator-based stepper math.
 *
 * Decouples animation speed from monitor refresh rate (D4, design §3).
 * Each rAF frame passes elapsed time here; the hook uses the returned
 * step count to advance the cursor, carrying the remainder to the next frame.
 *
 * This module is pure TypeScript — no React, no timers, no side effects.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdvanceResult {
	/** Whole number of steps to advance the cursor this frame. */
	steps: number
	/** Carry-over ms remainder to pass into the NEXT frame's `acc`. */
	nextAcc: number
}

// ---------------------------------------------------------------------------
// advance
// ---------------------------------------------------------------------------

/**
 * Compute how many animation steps to advance in the current frame.
 *
 * @param acc       - Ms carry-over from the previous frame (0 on first frame).
 * @param elapsedMs - Wall-clock ms elapsed since the last frame (from rAF delta).
 * @param speed     - Speed multiplier (e.g. 0.5, 1, 2, 4, 8).
 * @param msPerStep - Duration of one animation step at 1× speed (e.g. 16ms).
 * @param remaining - Optional cap: max steps that may be advanced (prevents
 *                    overshooting the end of the trace). When omitted, no cap.
 * @returns { steps, nextAcc }
 */
export function advance(
	acc: number,
	elapsedMs: number,
	speed: number,
	msPerStep: number,
	remaining?: number
): AdvanceResult {
	const total = acc + elapsedMs * speed
	const rawSteps = Math.floor(total / msPerStep)
	const nextAcc = total % msPerStep

	const steps = remaining !== undefined ? Math.min(rawSteps, Math.max(0, remaining)) : rawSteps

	return { steps, nextAcc }
}
