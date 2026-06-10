/**
 * URL state codec for the sorting visualizer module.
 *
 * Implements StateCodec<SortingUrlState> for serializing sorting config
 * to URL query parameters.
 *
 * ## Encoding convention (matches url-state.ts ADR)
 * - Keys: lowercase ASCII — "sort", "speed", "len", "mode"
 * - Default values OMITTED from encoded params (clean URLs)
 * - Invalid/unknown values FALL BACK to defaults on decode (no throw)
 *
 * ## What is serialized (per spec §6)
 * - algorithm: SortAlgorithm slug
 * - speed: discrete 1–8
 * - arrayLength: integer in [MIN_ARRAY_LENGTH, MAX_ARRAY_LENGTH]
 * - arrayMode: ArrayMode slug
 *
 * ## What is NOT serialized
 * - arr (current array contents) — not viewport-dependent, but regenerated on mount
 * - cursor / status — transient animation state
 */

import type { StateCodec } from "../url-state"
import { SORT_ALGORITHM } from "../algorithms/sorting/index"
import type { SortAlgorithm } from "../algorithms/sorting/index"
import { ARRAY_MODE, MIN_ARRAY_LENGTH, MAX_ARRAY_LENGTH } from "../algorithms/sorting/array-gen"
import type { ArrayMode } from "../algorithms/sorting/array-gen"
import { DEFAULT_SPEED, SPEED_MAP } from "../animation/speed-config"

// ---------------------------------------------------------------------------
// State shape — flat primitives only (satisfies StateCodec<T> constraint)
// ---------------------------------------------------------------------------

export interface SortingUrlState extends Record<string, string | number | boolean> {
	algorithm: SortAlgorithm
	speed: number
	arrayLength: number
	arrayMode: ArrayMode
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_ARRAY_LENGTH = 30

export const SORTING_DEFAULTS: SortingUrlState = {
	algorithm: SORT_ALGORITHM.BUBBLE,
	speed: DEFAULT_SPEED,
	arrayLength: DEFAULT_ARRAY_LENGTH,
	arrayMode: ARRAY_MODE.RANDOM,
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_SORT_ALGORITHMS = new Set<string>(Object.values(SORT_ALGORITHM))

function isValidSortAlgorithm(value: string): value is SortAlgorithm {
	return VALID_SORT_ALGORITHMS.has(value)
}

// Derive valid speeds from SPEED_MAP keys — structural coupling to the single
// source of truth; adding/removing speed levels is reflected here automatically.
const VALID_SPEEDS = new Set(Object.keys(SPEED_MAP).map(Number))

function isValidSpeed(value: number): boolean {
	return VALID_SPEEDS.has(value)
}

const VALID_ARRAY_MODES = new Set<string>(Object.values(ARRAY_MODE))

function isValidArrayMode(value: string): value is ArrayMode {
	return VALID_ARRAY_MODES.has(value)
}

/**
 * Parse and validate arrayLength from a string param.
 * - NaN → returns SORTING_DEFAULTS.arrayLength
 * - Out of range → clamp to [MIN_ARRAY_LENGTH, MAX_ARRAY_LENGTH]
 */
function parseArrayLength(raw: string | null): number {
	if (raw === null) return SORTING_DEFAULTS.arrayLength
	const n = Number(raw)
	if (!Number.isFinite(n) || !Number.isInteger(n)) return SORTING_DEFAULTS.arrayLength
	return Math.max(MIN_ARRAY_LENGTH, Math.min(MAX_ARRAY_LENGTH, n))
}

// ---------------------------------------------------------------------------
// Codec implementation
// ---------------------------------------------------------------------------

export const sortingCodec: StateCodec<SortingUrlState> = {
	encode(state: SortingUrlState): URLSearchParams {
		const params = new URLSearchParams()

		if (state.algorithm !== SORTING_DEFAULTS.algorithm) {
			params.set("sort", state.algorithm)
		}

		if (state.speed !== SORTING_DEFAULTS.speed) {
			params.set("speed", String(state.speed))
		}

		if (state.arrayLength !== SORTING_DEFAULTS.arrayLength) {
			params.set("len", String(state.arrayLength))
		}

		if (state.arrayMode !== SORTING_DEFAULTS.arrayMode) {
			params.set("mode", state.arrayMode)
		}

		return params
	},

	decode(params: URLSearchParams): SortingUrlState {
		// Algorithm
		const algoRaw = params.get("sort") ?? ""
		const algorithm = isValidSortAlgorithm(algoRaw) ? algoRaw : SORTING_DEFAULTS.algorithm

		// Speed
		const speedRaw = Number(params.get("speed"))
		const speed = isValidSpeed(speedRaw) ? speedRaw : SORTING_DEFAULTS.speed

		// Array length — clamp, not strict fallback (per spec §6 acceptance scenario)
		const arrayLength = parseArrayLength(params.get("len"))

		// Array mode
		const modeRaw = params.get("mode") ?? ""
		const arrayMode = isValidArrayMode(modeRaw) ? modeRaw : SORTING_DEFAULTS.arrayMode

		return { algorithm, speed, arrayLength, arrayMode }
	},
}
