/**
 * Hit-testing for canvas pointer events.
 *
 * Pure functions — no DOM access, no side effects.
 * Accepts plain Maps and numbers so they are usable in tests and pure lib code.
 *
 * ## No React / DOM imports
 */

import type { GraphNode, GraphEdge } from "./types"

// ---------------------------------------------------------------------------
// Exported constants (shared with GraphCanvas and store)
// ---------------------------------------------------------------------------

/** Node circle radius in CSS px. */
export const NODE_RADIUS = 18

/** Edge hit threshold in CSS px. */
export const EDGE_THRESHOLD = 8

// ---------------------------------------------------------------------------
// nodeAt
// ---------------------------------------------------------------------------

/**
 * Returns the id of the node whose center is within `radius` of (x, y).
 * If multiple nodes qualify, returns the NEAREST one (nearest-first tie-breaking).
 * Returns null if no node qualifies.
 *
 * @param x      - Canvas-local X coordinate (CSS px).
 * @param y      - Canvas-local Y coordinate.
 * @param nodes  - All nodes in the graph.
 * @param radius - Hit radius (use NODE_RADIUS by default).
 */
export function nodeAt(
	x: number,
	y: number,
	nodes: Map<string, GraphNode>,
	radius: number
): string | null {
	let bestId: string | null = null
	let bestDist = Infinity

	for (const node of nodes.values()) {
		const dx = x - node.x
		const dy = y - node.y
		const dist = Math.sqrt(dx * dx + dy * dy)
		if (dist <= radius && dist < bestDist) {
			bestDist = dist
			bestId = node.id
		}
	}

	return bestId
}

// ---------------------------------------------------------------------------
// edgeAt
// ---------------------------------------------------------------------------

/**
 * Returns the id of the edge whose line segment is within `threshold` of (x, y),
 * measured as the perpendicular distance clamped to segment endpoints.
 * If multiple edges qualify, returns the one with the smallest distance.
 * Returns null if no edge qualifies.
 *
 * @param x         - Canvas-local X coordinate (CSS px).
 * @param y         - Canvas-local Y coordinate.
 * @param edges     - All edges in the graph.
 * @param nodes     - All nodes (for endpoint lookup).
 * @param threshold - Hit threshold (use EDGE_THRESHOLD by default).
 */
export function edgeAt(
	x: number,
	y: number,
	edges: Map<string, GraphEdge>,
	nodes: Map<string, GraphNode>,
	threshold: number
): string | null {
	let bestId: string | null = null
	let bestDist = Infinity

	for (const edge of edges.values()) {
		const src = nodes.get(edge.source)
		const tgt = nodes.get(edge.target)
		if (!src || !tgt) continue

		const dist = pointToSegmentDistance(x, y, src.x, src.y, tgt.x, tgt.y)
		if (dist <= threshold && dist < bestDist) {
			bestDist = dist
			bestId = edge.id
		}
	}

	return bestId
}

// ---------------------------------------------------------------------------
// Internal: point-to-segment distance (perpendicular, clamped to segment)
// ---------------------------------------------------------------------------

function pointToSegmentDistance(
	px: number,
	py: number,
	ax: number,
	ay: number,
	bx: number,
	by: number
): number {
	const dx = bx - ax
	const dy = by - ay
	const lenSq = dx * dx + dy * dy

	if (lenSq === 0) {
		// Degenerate edge (zero-length segment) — distance to the single point
		const ex = px - ax
		const ey = py - ay
		return Math.sqrt(ex * ex + ey * ey)
	}

	// Project point onto the line, clamp t to [0, 1]
	const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))

	const closestX = ax + t * dx
	const closestY = ay + t * dy

	const ex = px - closestX
	const ey = py - closestY
	return Math.sqrt(ex * ex + ey * ey)
}
