/**
 * readGraphVizTokens — reads all --viz-node* and --viz-edge* CSS custom properties.
 *
 * Mirrors readVizTokens from PathfindingCanvas.
 * Must be called from the client (browser) — provides SSR/test fallbacks.
 *
 * ## No React / DOM imports (pure helper)
 */

// ---------------------------------------------------------------------------
// Token shape
// ---------------------------------------------------------------------------

export interface GraphVizTokens {
	node: string
	nodeSelected: string
	nodeStart: string
	nodeLabel: string
	nodeVisited: string
	nodeFrontier: string
	edge: string
	edgeArrow: string
	edgeWeightBg: string
	edgeTree: string
	edgeBack: string
	edgeMst: string
	edgeMstReject: string
}

// ---------------------------------------------------------------------------
// Fallback values (used in SSR / test environments)
// ---------------------------------------------------------------------------

const FALLBACKS: GraphVizTokens = {
	node: "#4a90d9",
	nodeSelected: "#f5a623",
	nodeStart: "#27ae60",
	nodeLabel: "#ffffff",
	nodeVisited: "#7fb3d3",
	nodeFrontier: "#f7c948",
	edge: "#555555",
	edgeArrow: "#555555",
	edgeWeightBg: "rgba(255,255,255,0.9)",
	edgeTree: "#27ae60",
	edgeBack: "#e74c3c",
	edgeMst: "#8e44ad",
	edgeMstReject: "#c0392b",
}

// ---------------------------------------------------------------------------
// Reader
// ---------------------------------------------------------------------------

/**
 * Reads all graph viz tokens from the given element's computed style.
 * Falls back to neutral defaults when a token is empty (SSR / test).
 */
export function readGraphVizTokens(el: HTMLElement): GraphVizTokens {
	if (typeof getComputedStyle === "undefined") return { ...FALLBACKS }

	const s = getComputedStyle(el)
	const get = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback

	return {
		node: get("--viz-node", FALLBACKS.node),
		nodeSelected: get("--viz-node-selected", FALLBACKS.nodeSelected),
		nodeStart: get("--viz-node-start", FALLBACKS.nodeStart),
		nodeLabel: get("--viz-node-label", FALLBACKS.nodeLabel),
		nodeVisited: get("--viz-node-visited", FALLBACKS.nodeVisited),
		nodeFrontier: get("--viz-node-frontier", FALLBACKS.nodeFrontier),
		edge: get("--viz-edge", FALLBACKS.edge),
		edgeArrow: get("--viz-edge-arrow", FALLBACKS.edgeArrow),
		edgeWeightBg: get("--viz-edge-weight-bg", FALLBACKS.edgeWeightBg),
		edgeTree: get("--viz-edge-tree", FALLBACKS.edgeTree),
		edgeBack: get("--viz-edge-back", FALLBACKS.edgeBack),
		edgeMst: get("--viz-edge-mst", FALLBACKS.edgeMst),
		edgeMstReject: get("--viz-edge-mst-reject", FALLBACKS.edgeMstReject),
	}
}
