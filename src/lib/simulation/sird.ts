/**
 * SIRD pure library — Euler step, clamp/renormalize, metrics, constants.
 *
 * Design authority (design wins over spec):
 *   - dt = 0.1 day (ADR-1)
 *   - SIRD_DEFAULTS: β=0.3, γ=0.1, μ=0.005, N=1000, I₀=1 (ADR-3)
 *   - Clamp + renormalize: normal path gives s+(i+r+d) === N bit-exactly; S-clamp path within ~1e-12 (ADR-7)
 *   - recharts@3.8.1 verified React 19 compat (T0 spike, 2026-06-13)
 *
 * Zero React imports. Zero module-load side effects. Pure TypeScript only.
 */

// ---------------------------------------------------------------------------
// Type contracts (design §TYPE CONTRACTS)
// ---------------------------------------------------------------------------

/** Compartment state at one instant (population counts, not fractions). */
export interface SIRState {
  s: number // susceptible
  i: number // infected
  r: number // recovered
  d: number // dead
}

/** Epidemic parameters (URL-serializable scalars). */
export interface SIRParams {
  beta: number // transmission rate
  gamma: number // recovery rate
  mu: number // mortality rate
  n: number // total population N
  i0: number // initial infected
}

/** Derived, time-independent metrics computed from params and/or history. */
export interface SIRMetrics {
  r0: number // β/(γ+μ)
  cfr: number // μ/(γ+μ)
  herdImmunityThreshold: number // 1 − 1/R0 (fraction); 0 when R0 ≤ 1
  peakInfected: number // tracked incrementally during the run
  peakDay: number // sim-day at which peak occurred
  totalDeaths: number // final D
  durationDays: number // sim-day at auto-stop
}

/** One recorded chart sample (post-downsample). Flat for Recharts dataKeys. */
export interface SeriesPoint {
  day: number // sim-time in days (x for time-series)
  s: number
  i: number
  r: number
  d: number
}

// ---------------------------------------------------------------------------
// Constants (ADR-1, ADR-2, ADR-6)
// ---------------------------------------------------------------------------

/** Integration timestep in sim-days. */
export const DT = 0.1

/** Sim-days between recorded SeriesPoints (every 10 steps at dt=0.1). */
export const RECORD_INTERVAL = 1.0

/**
 * Auto-stop threshold: below one-half of one individual infected means
 * epidemic is extinguished. Absolute, population-independent.
 */
export const AUTO_STOP_I = 0.5

/** Default parameter values (ADR-3). Type inferred via typeof pattern. */
export const SIRD_DEFAULTS = {
  beta: 0.3,
  gamma: 0.1,
  mu: 0.005,
  n: 1000,
  i0: 1,
} as const satisfies SIRParams

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Build the initial compartment state from params.
 * s = n - i0, i = i0, r = 0, d = 0.
 */
export function initialState(params: SIRParams): SIRState {
  return {
    s: params.n - params.i0,
    i: params.i0,
    r: 0,
    d: 0,
  }
}

/**
 * Derive time-independent epidemic metrics from params only.
 * Returns the partial SIRMetrics subset that does not require history.
 */
export function deriveMetrics(
  params: SIRParams
): Pick<SIRMetrics, "r0" | "cfr" | "herdImmunityThreshold"> {
  const removal = params.gamma + params.mu
  const r0 = removal > 0 ? params.beta / removal : 0
  const cfr = removal > 0 ? params.mu / removal : 0
  const herdImmunityThreshold = r0 > 1 ? 1 - 1 / r0 : 0
  return { r0, cfr, herdImmunityThreshold }
}

/**
 * Compute full SIRMetrics from a downsampled history array and params.
 * History entries must have { i, d, day } fields (SeriesPoint shape).
 */
export function computeSirdMetrics(
  history: ReadonlyArray<Pick<SeriesPoint, "day" | "i" | "d">>,
  params: SIRParams
): SIRMetrics {
  const base = deriveMetrics(params)

  let peakInfected = 0
  let peakDay = 0
  let totalDeaths = 0
  let durationDays = 0

  for (const point of history) {
    if (point.i > peakInfected) {
      peakInfected = point.i
      peakDay = point.day
    }
    totalDeaths = point.d
    durationDays = point.day
  }

  return {
    ...base,
    peakInfected,
    peakDay,
    totalDeaths,
    durationDays,
  }
}

// ---------------------------------------------------------------------------
// Core Euler step (ADR-1, ADR-7)
// ---------------------------------------------------------------------------

/**
 * Advance the SIRD model by one timestep using forward Euler.
 *
 * After computing raw Euler increments, compartments are clamped to ≥ 0 and
 * the state is renormalized so s+i+r+d ≈ N via one of two paths:
 *
 * **Normal path** (othersSum ≤ N):
 *   S is set to the exact residual N − (I+R+D). IEEE 754 guarantees
 *   (N−x)+x === N for the same floating-point x, so `s + (i+r+d) === N`
 *   is bit-exact when tested in that grouped form.
 *
 * **S-clamp path** (othersSum > N, triggered by aggressive params):
 *   S is set to 0; I/R/D are scaled by `n/othersSum` so they sum to N.
 *   Because proportional scaling is not exact in IEEE 754, `s+i+r+d` is
 *   within ~1e-12 of N but is NOT guaranteed to be bit-exact.
 *
 * Summary: normal path gives s+(i+r+d) === N bit-exactly; S-clamp path
 * gives |s+i+r+d − N| < ~1e-12. All compartments are ≥ 0 on both paths.
 *
 * @param state  - Current compartment counts
 * @param params - Epidemic parameters; `n` must be > 0. If `n ≤ 0` the
 *                 input state is returned unchanged (degenerate no-op).
 * @param dt     - Timestep in sim-days (pass DT constant)
 * @returns      - Next compartment state
 */
export function stepSIRD(state: SIRState, params: SIRParams, dt: number): SIRState {
  // Degenerate guard: n=0 would produce division by zero (NaN/Infinity).
  if (params.n <= 0) return state

  const { beta, gamma, mu, n } = params
  const { s, i, r, d } = state

  // Euler increments
  const infection = (beta * s * i) / n
  const recovery = gamma * i
  const death = mu * i

  const rawI = i + (infection - recovery - death) * dt
  const rawR = r + recovery * dt
  const rawD = d + death * dt

  // Clamp I, R, D to ≥ 0 (they can theoretically go negative with large dt).
  let nextI = Math.max(0, rawI)
  let nextR = Math.max(0, rawR)
  let nextD = Math.max(0, rawD)

  const othersSum = nextI + nextR + nextD

  if (othersSum > n) {
    // S-clamp path: I/R/D overshoot N — renormalize proportionally, then set
    // S = 0. Sum is within ~1e-12 of N (not bit-exact). Preserves I:R:D ratios.
    const scale = n / othersSum
    nextI *= scale
    nextR *= scale
    nextD *= scale
    return { s: 0, i: nextI, r: nextR, d: nextD }
  }

  // Normal path: absorb residual into S (ADR-7).
  // Compute i+r+d as a GROUP, then subtract from N so the IEEE 754 identity
  // (N − x) + x === N holds exactly for the same floating-point value x.
  const nextS = n - othersSum

  return {
    s: nextS,
    i: nextI,
    r: nextR,
    d: nextD,
  }
}
