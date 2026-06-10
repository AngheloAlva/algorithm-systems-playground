/**
 * URL state codec for the graph visualizer module.
 *
 * Implements StateCodec<GraphCodecState> — only algorithm and speed are serialized.
 * Graph topology (nodes, edges, positions) is intentionally NOT serialized (NG1).
 *
 * ## Encoding convention (mirrors pathfinding codec)
 * - Keys: "algo", "speed"
 * - Default values OMITTED (clean URLs)
 * - Invalid/unknown values fall back to defaults on decode (no throw)
 */

import type { StateCodec } from "../url-state"
import { GRAPH_ALGORITHM } from "../algorithms/graph/index"
import { DEFAULT_SPEED, SPEED_MAP } from "../animation/speed-config"

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface GraphCodecState extends Record<string, string | number | boolean> {
	algorithm: string
	speed: number
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const GRAPH_CODEC_DEFAULTS: GraphCodecState = {
	algorithm: GRAPH_ALGORITHM.BFS,
	speed: DEFAULT_SPEED,
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_ALGORITHMS = new Set<string>(Object.values(GRAPH_ALGORITHM))

function isValidAlgorithm(value: string): boolean {
	return VALID_ALGORITHMS.has(value)
}

const VALID_SPEEDS = new Set(Object.keys(SPEED_MAP).map(Number))

function isValidSpeed(value: number): boolean {
	return VALID_SPEEDS.has(value)
}

// ---------------------------------------------------------------------------
// Codec implementation
// ---------------------------------------------------------------------------

export const graphCodec: StateCodec<GraphCodecState> = {
	encode(state: GraphCodecState): URLSearchParams {
		const params = new URLSearchParams()

		if (state.algorithm !== GRAPH_CODEC_DEFAULTS.algorithm) {
			params.set("algo", state.algorithm)
		}

		if (state.speed !== GRAPH_CODEC_DEFAULTS.speed) {
			params.set("speed", String(state.speed))
		}

		return params
	},

	decode(params: URLSearchParams): GraphCodecState {
		const algoRaw = params.get("algo") ?? ""
		const algorithm = isValidAlgorithm(algoRaw) ? algoRaw : GRAPH_CODEC_DEFAULTS.algorithm

		const speedRaw = Number(params.get("speed"))
		const speed = isValidSpeed(speedRaw) ? speedRaw : GRAPH_CODEC_DEFAULTS.speed

		return { algorithm, speed }
	},
}
