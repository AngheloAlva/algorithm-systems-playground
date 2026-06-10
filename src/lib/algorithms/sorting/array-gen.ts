/**
 * Array generation utilities for the sorting visualizer.
 *
 * Provides generateArray() which creates arrays in four modes:
 *  - RANDOM: Fisher-Yates shuffle of [1..length]; not reproducible
 *  - SORTED: ascending [1, 2, ..., length]; deterministic
 *  - REVERSED: descending [length, ..., 2, 1]; deterministic
 *  - FEW_UNIQUE: ~5 distinct values distributed across length elements; deterministic
 *
 * All inputs are clamped to [MIN_ARRAY_LENGTH, MAX_ARRAY_LENGTH].
 *
 * ## No React / DOM imports
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MIN_ARRAY_LENGTH = 5
export const MAX_ARRAY_LENGTH = 200

// ---------------------------------------------------------------------------
// ArrayMode — const-then-type pattern (typescript skill)
// ---------------------------------------------------------------------------

export const ARRAY_MODE = {
	RANDOM: "random",
	SORTED: "sorted",
	REVERSED: "reversed",
	FEW_UNIQUE: "few-unique",
} as const

export type ArrayMode = (typeof ARRAY_MODE)[keyof typeof ARRAY_MODE]

// ---------------------------------------------------------------------------
// generateArray
// ---------------------------------------------------------------------------

/**
 * Generate an array for sorting visualization.
 *
 * @param length - Desired array length; clamped to [MIN_ARRAY_LENGTH, MAX_ARRAY_LENGTH].
 * @param mode   - Generation strategy.
 * @returns A readonly array of integers.
 */
export function generateArray(length: number, mode: ArrayMode): ReadonlyArray<number> {
	const n = Math.max(MIN_ARRAY_LENGTH, Math.min(MAX_ARRAY_LENGTH, length))

	switch (mode) {
		case ARRAY_MODE.SORTED:
			return Array.from({ length: n }, (_, i) => i + 1)

		case ARRAY_MODE.REVERSED:
			return Array.from({ length: n }, (_, i) => n - i)

		case ARRAY_MODE.FEW_UNIQUE: {
			// Use 5 fixed values distributed deterministically across the array.
			// The distinct values are evenly spread across [1..n] as quintile markers.
			const step = Math.max(1, Math.floor(n / 5))
			const distinctValues = [step, step * 2, step * 3, step * 4, n]
			return Array.from({ length: n }, (_, i) => distinctValues[i % distinctValues.length])
		}

		case ARRAY_MODE.RANDOM: {
			// Fisher-Yates shuffle of [1..n]
			const arr = Array.from({ length: n }, (_, i) => i + 1)
			for (let i = n - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1))
				;[arr[i], arr[j]] = [arr[j], arr[i]]
			}
			return arr
		}
	}
}
