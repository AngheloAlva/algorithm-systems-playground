/**
 * URL state codec for the pathfinding visualizer module.
 *
 * Implements StateCodec<PathfindingUrlState> for serializing algorithm config
 * to URL query parameters.
 *
 * ## Encoding convention (matches url-state.ts ADR)
 * - Keys: lowercase ASCII — "algo", "speed", "diag"
 * - Booleans: "1" (true) / "0" (false)
 * - Default values OMITTED from encoded params (clean URLs)
 * - Invalid/unknown values FALL BACK to defaults on decode (no throw)
 *
 * ## What is serialized (per design §7)
 * - algorithm: Algorithm slug
 * - speed: discrete 1–8
 * - diagonal: boolean
 *
 * ## What is NOT serialized
 * - grid walls/weights — viewport-dependent, would break on share across screens
 * - cursor / status — transient animation state
 * - maze seed — v1 exclusion; can add later without breaking this codec
 */

import type { StateCodec } from "../url-state"
import { ALGORITHM } from "../algorithms/pathfinding/index"
import type { Algorithm } from "../algorithms/pathfinding/index"
import { DEFAULT_SPEED, SPEED_MAP } from "../animation/speed-config"

// ---------------------------------------------------------------------------
// State shape — flat primitives only (satisfies StateCodec<T> constraint)
// ---------------------------------------------------------------------------

export interface PathfindingUrlState extends Record<string, string | number | boolean> {
	algorithm: Algorithm
	speed: number
	diagonal: boolean
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const PATHFINDING_DEFAULTS: PathfindingUrlState = {
	algorithm: ALGORITHM.ASTAR,
	speed: DEFAULT_SPEED,
	diagonal: false,
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_ALGORITHMS = new Set<string>(Object.values(ALGORITHM))

function isValidAlgorithm(value: string): value is Algorithm {
	return VALID_ALGORITHMS.has(value)
}

// Derive valid speeds from SPEED_MAP keys — structural coupling to the single
// source of truth; adding/removing speed levels is reflected here automatically.
const VALID_SPEEDS = new Set(Object.keys(SPEED_MAP).map(Number))

function isValidSpeed(value: number): boolean {
	return VALID_SPEEDS.has(value)
}

// ---------------------------------------------------------------------------
// Codec implementation
// ---------------------------------------------------------------------------

export const pathfindingCodec: StateCodec<PathfindingUrlState> = {
	encode(state: PathfindingUrlState): URLSearchParams {
		const params = new URLSearchParams()

		if (state.algorithm !== PATHFINDING_DEFAULTS.algorithm) {
			params.set("algo", state.algorithm)
		}

		if (state.speed !== PATHFINDING_DEFAULTS.speed) {
			params.set("speed", String(state.speed))
		}

		if (state.diagonal !== PATHFINDING_DEFAULTS.diagonal) {
			params.set("diag", state.diagonal ? "1" : "0")
		}

		return params
	},

	decode(params: URLSearchParams): PathfindingUrlState {
		// Algorithm
		const algoRaw = params.get("algo") ?? ""
		const algorithm = isValidAlgorithm(algoRaw) ? algoRaw : PATHFINDING_DEFAULTS.algorithm

		// Speed
		const speedRaw = Number(params.get("speed"))
		const speed = isValidSpeed(speedRaw) ? speedRaw : PATHFINDING_DEFAULTS.speed

		// Diagonal
		const diagRaw = params.get("diag")
		const diagonal =
			diagRaw === "1" ? true : diagRaw === "0" ? false : PATHFINDING_DEFAULTS.diagonal

		return { algorithm, speed, diagonal }
	},
}
