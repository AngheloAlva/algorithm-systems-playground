/**
 * URL state codec for the dashboard module.
 *
 * Implements StateCodec<DashboardUrlState> — encodes up to 3 params:
 * arrayLength, arrayMode, seed.
 *
 * ## Encoding convention (mirrors sorting-codec.ts / simulation-codec.ts)
 * - Keys: "len" (arrayLength), "mode" (arrayMode), "seed" (seed)
 * - Default values OMITTED (clean URLs)
 * - Invalid / out-of-range values fall back to defaults on decode (no throw)
 *
 * ## Defaults
 * - arrayLength: 50 (mid-range, fast enough for all 5 algorithms)
 * - arrayMode: "random"
 * - seed: 42
 */

import type { StateCodec } from "../url-state"
import { ARRAY_MODE, MIN_ARRAY_LENGTH, MAX_ARRAY_LENGTH } from "../algorithms/sorting/array-gen"
import type { ArrayMode } from "../algorithms/sorting/array-gen"

// ---------------------------------------------------------------------------
// State shape — flat primitives only (satisfies StateCodec<T> constraint)
// ---------------------------------------------------------------------------

export interface DashboardUrlState extends Record<string, string | number | boolean> {
  /** Array length for snapshot run. Range [5, 200]. Default 50. */
  arrayLength: number
  /** Array generation mode shared by snapshot and sweep. Default "random". */
  arrayMode: ArrayMode
  /** Seed for RANDOM mode; makes results reproducible and shareable. Default 42. */
  seed: number
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DASHBOARD_DEFAULTS: DashboardUrlState = {
  arrayLength: 50,
  arrayMode: ARRAY_MODE.RANDOM,
  seed: 42,
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_ARRAY_MODES = new Set<string>(Object.values(ARRAY_MODE))

function isValidArrayMode(value: string): value is ArrayMode {
  return VALID_ARRAY_MODES.has(value)
}

/**
 * Parse arrayLength from raw string param.
 * - null / NaN → return null (caller falls back to default)
 * - Out of [MIN, MAX] range → return null (falls back to default, not clamped)
 *   Design decision: strict fallback vs clamp. Sorting codec clamps; the dashboard
 *   spec says "falls back to default" for out-of-range. Follow spec for codec layer.
 */
function parseArrayLength(raw: string | null): number | null {
  if (raw === null) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null
  if (n < MIN_ARRAY_LENGTH || n > MAX_ARRAY_LENGTH) return null
  return n
}

/**
 * Parse seed from raw string param.
 * - null / NaN / non-integer → return null (falls back to default)
 * - Any integer is valid (seeds have no range restriction)
 */
function parseSeed(raw: string | null): number | null {
  if (raw === null) return null
  const n = Number(raw)
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null
  return n
}

// ---------------------------------------------------------------------------
// Codec implementation
// ---------------------------------------------------------------------------

// URL keys "len"/"mode"/"seed" follow the design doc (overrides spec CODEC-1 short forms "l"/"m").
export const dashboardCodec: StateCodec<DashboardUrlState> = {
  encode(state: DashboardUrlState): URLSearchParams {
    const params = new URLSearchParams()

    if (state.arrayLength !== DASHBOARD_DEFAULTS.arrayLength) {
      params.set("len", String(state.arrayLength))
    }

    if (state.arrayMode !== DASHBOARD_DEFAULTS.arrayMode) {
      params.set("mode", state.arrayMode)
    }

    if (state.seed !== DASHBOARD_DEFAULTS.seed) {
      params.set("seed", String(state.seed))
    }

    return params
  },

  decode(params: URLSearchParams): DashboardUrlState {
    const arrayLength =
      parseArrayLength(params.get("len")) ?? DASHBOARD_DEFAULTS.arrayLength

    const modeRaw = params.get("mode") ?? ""
    const arrayMode = isValidArrayMode(modeRaw) ? modeRaw : DASHBOARD_DEFAULTS.arrayMode

    const seed = parseSeed(params.get("seed")) ?? DASHBOARD_DEFAULTS.seed

    return { arrayLength, arrayMode, seed }
  },
}
