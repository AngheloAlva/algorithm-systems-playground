/**
 * URL-State Architecture Pattern
 * ================================
 *
 * Pattern name: URL-serializable state
 *
 * Intent
 * ------
 * All module-specific user configuration (grid size, algorithm choice, animation speed,
 * start/end nodes, etc.) MUST be serializable to URL query-string parameters so that
 * any session state can be reproduced by sharing a URL.
 *
 * Example: ?algo=astar&speed=5&rows=20&cols=30
 *
 * Encoding convention
 * -------------------
 * - Parameter names are lowercase kebab-free ASCII: `algo`, `speed`, `rows`, `cols`.
 * - Numeric values are encoded as plain decimal strings: speed=5.
 * - Boolean values are encoded as "1" / "0".
 * - Enum values are encoded as their string literal: algo=astar, algo=dijkstra.
 * - Undefined / default values are OMITTED from the URL (clean, minimal URLs).
 * - Arrays use repeated keys: selected=a&selected=b (URLSearchParams.getAll).
 *
 * Parsing rule
 * ------------
 * State is read on mount inside a "use client" component via the Next.js
 * `useSearchParams()` hook (requires wrapping the component — or its parent — in a
 * <Suspense> boundary to avoid CSR bailout at the page level).
 *
 * Example:
 *   const params = useSearchParams()
 *   const algo = params.get("algo") ?? "astar"
 *   const speed = Number(params.get("speed") ?? 5)
 *
 * Update rule
 * -----------
 * State changes update the URL without triggering a full navigation via:
 *   router.replace(`${pathname}?${codec.encode(state).toString()}`, { scroll: false })
 *
 * This keeps history clean: back/forward navigates between meaningfully different states,
 * not every slider tick. Debounce high-frequency updates (e.g. slider drag) before
 * calling replace.
 *
 * Non-goal (Phase 0)
 * ------------------
 * Phase 0 does NOT wire any module to this pattern. This file is documentation +
 * interface contract only. Actual implementations appear in Phase 1+ per module.
 *
 * Usage
 * -----
 * Each module defines a codec for its own state shape:
 *
 *   const pathfindingCodec: StateCodec<PathfindingState> = {
 *     encode(state) {
 *       const p = new URLSearchParams()
 *       p.set("algo", state.algorithm)
 *       p.set("speed", String(state.speed))
 *       return p
 *     },
 *     decode(params) {
 *       return {
 *         algorithm: (params.get("algo") ?? "astar") as Algorithm,
 *         speed: Number(params.get("speed") ?? 5),
 *       }
 *     },
 *   }
 */

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

/**
 * StateCodec<T> — typed codec for serializing module state to query params.
 *
 * T is the module-specific state shape (plain object, no functions or class
 * instances — must be serializable to string key/value pairs).
 */
export interface StateCodec<T> {
	/**
	 * Encode a state snapshot into URLSearchParams for use in the address bar.
	 * Omit keys whose value matches the module default to keep URLs minimal.
	 */
	encode(state: T): URLSearchParams

	/**
	 * Decode URLSearchParams back into a typed state snapshot.
	 * MUST return a fully valid state (apply defaults for missing keys).
	 */
	decode(params: URLSearchParams): T
}
