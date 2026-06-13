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
// Validation helper
// ---------------------------------------------------------------------------

/** Returns true if value is a finite positive number (> 0). */
function isValidPositive(value: number): boolean {
  return Number.isFinite(value) && value > 0
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
    const betaRaw = Number(params.get("b"))
    const beta = isValidPositive(betaRaw) ? betaRaw : SIMULATION_CODEC_DEFAULTS.beta

    const gammaRaw = Number(params.get("g"))
    const gamma = isValidPositive(gammaRaw) ? gammaRaw : SIMULATION_CODEC_DEFAULTS.gamma

    const muRaw = Number(params.get("m"))
    const mu = isValidPositive(muRaw) ? muRaw : SIMULATION_CODEC_DEFAULTS.mu

    const nRaw = Number(params.get("n"))
    const n = isValidPositive(nRaw) ? nRaw : SIMULATION_CODEC_DEFAULTS.n

    const i0Raw = Number(params.get("i0"))
    const i0 = isValidPositive(i0Raw) ? i0Raw : SIMULATION_CODEC_DEFAULTS.i0

    return { beta, gamma, mu, n, i0 }
  },
}
