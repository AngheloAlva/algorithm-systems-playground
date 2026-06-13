/**
 * Pseudo-random number generators for deterministic array generation.
 *
 * mulberry32 — fast, simple, good distribution for shuffle visualization.
 * NOT cryptographic; appropriate for teaching tools.
 *
 * ## No React / DOM imports
 */

// ---------------------------------------------------------------------------
// mulberry32 — seeded PRNG
// ---------------------------------------------------------------------------

/**
 * Returns a seeded pseudo-random number generator using the mulberry32 algorithm.
 *
 * @param seed - 32-bit unsigned integer seed value.
 * @returns A function that returns a float in [0, 1) on each call, like Math.random().
 *
 * @example
 * const rand = mulberry32(42)
 * const value = rand() // deterministic float in [0, 1)
 */
export function mulberry32(seed: number): () => number {
	let a = seed >>> 0
	return function () {
		a |= 0
		a = (a + 0x6d2b79f5) | 0
		let t = Math.imul(a ^ (a >>> 15), 1 | a)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}
