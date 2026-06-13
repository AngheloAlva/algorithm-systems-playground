/**
 * URL state codec for the simulation module (T4).
 *
 * Implements StateCodec<SimulationUrlState> — encodes exactly 5 params:
 * beta, gamma, mu, n, i0. Speed and playback state are intentionally NOT encoded (SIM5.1).
 *
 * ## Encoding convention (mirrors graph-codec.ts)
 * - Keys: "b" (beta), "g" (gamma), "m" (mu), "n" (n), "i0" (i0)
 * - Default values OMITTED (clean URLs, SIM5.2-a)
 * - Invalid / non-finite / negative values fall back to defaults on decode (SIM5.2-c)
 */

import type { StateCodec } from "../url-state"
import { SIRD_DEFAULTS } from "../simulation/sird"

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

/** URL-serializable subset of simulation params (no speed, no playback). */
export interface SimulationUrlState extends Record<string, string | number | boolean> {
  beta: number
  gamma: number
  mu: number
  n: number
  i0: number
}

// ---------------------------------------------------------------------------
// Defaults (pulled from SIRD_DEFAULTS — single source of truth)
// ---------------------------------------------------------------------------

export const SIMULATION_CODEC_DEFAULTS: SimulationUrlState = {
  beta: SIRD_DEFAULTS.beta,
  gamma: SIRD_DEFAULTS.gamma,
  mu: SIRD_DEFAULTS.mu,
  n: SIRD_DEFAULTS.n,
  i0: SIRD_DEFAULTS.i0,
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Returns true if value is a finite positive number (> 0). Used for beta and n. */
function isValidPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

/** Returns true if value is a finite non-negative number (>= 0). Used for mu, gamma, i0. */
function isValidNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

// ---------------------------------------------------------------------------
// Codec implementation
// ---------------------------------------------------------------------------

export const simulationCodec: StateCodec<SimulationUrlState> = {
  encode(state: SimulationUrlState): URLSearchParams {
    const params = new URLSearchParams()

    if (state.beta !== SIMULATION_CODEC_DEFAULTS.beta) {
      params.set("b", String(state.beta))
    }
    if (state.gamma !== SIMULATION_CODEC_DEFAULTS.gamma) {
      params.set("g", String(state.gamma))
    }
    if (state.mu !== SIMULATION_CODEC_DEFAULTS.mu) {
      params.set("m", String(state.mu))
    }
    if (state.n !== SIMULATION_CODEC_DEFAULTS.n) {
      params.set("n", String(state.n))
    }
    if (state.i0 !== SIMULATION_CODEC_DEFAULTS.i0) {
      params.set("i0", String(state.i0))
    }

    return params
  },

  decode(params: URLSearchParams): SimulationUrlState {
    const betaStr = params.get("b")
    const beta =
      betaStr !== null && isValidPositive(Number(betaStr))
        ? Number(betaStr)
        : SIMULATION_CODEC_DEFAULTS.beta

    // gamma=0 is valid (reduces to SI model, SIM1.7-d): use isValidNonNegative
    const gammaStr = params.get("g")
    const gamma =
      gammaStr !== null && isValidNonNegative(Number(gammaStr))
        ? Number(gammaStr)
        : SIMULATION_CODEC_DEFAULTS.gamma

    // mu=0 is valid (reduces to SIR model, SIM1.7-c): use isValidNonNegative
    const muStr = params.get("m")
    const mu =
      muStr !== null && isValidNonNegative(Number(muStr))
        ? Number(muStr)
        : SIMULATION_CODEC_DEFAULTS.mu

    const nStr = params.get("n")
    const n =
      nStr !== null && isValidPositive(Number(nStr)) ? Number(nStr) : SIMULATION_CODEC_DEFAULTS.n

    // i0=0 is valid (no initial infection, SIM1.7-a): use isValidNonNegative
    const i0Str = params.get("i0")
    const i0 =
      i0Str !== null && isValidNonNegative(Number(i0Str))
        ? Number(i0Str)
        : SIMULATION_CODEC_DEFAULTS.i0

    // Cross-field guard: i0 >= n would produce negative susceptible count.
    // Fall back both to defaults for determinism (FIX3).
    if (i0 >= n) {
      return { beta, gamma, mu, n: SIMULATION_CODEC_DEFAULTS.n, i0: SIMULATION_CODEC_DEFAULTS.i0 }
    }

    return { beta, gamma, mu, n, i0 }
  },
}
