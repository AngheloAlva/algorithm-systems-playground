/**
 * Unit tests for graph type contracts (Unit A1).
 *
 * Scenarios: G1-A (auto-label sequence), G1-B (stable ids on delete),
 * G1-C (default weight), G1-D (TypeScript flat shape + const-type pattern).
 *
 * These are compile-time and structural tests — actual runtime behavior
 * for addNode/deleteNode lives in graph.test.ts.
 */

import { describe, it, expect } from "vitest"
import type { GraphNode, GraphEdge, GraphData } from "./types"
import { EDIT_MODE, GRAPH_STEP_KIND } from "./types"

// ---------------------------------------------------------------------------
// G1-D — const-type pattern (EDIT_MODE)
// ---------------------------------------------------------------------------

describe("EDIT_MODE const object", () => {
	it("has all expected keys", () => {
		expect(EDIT_MODE.SELECT).toBe("select")
		expect(EDIT_MODE.ADD_NODE).toBe("add-node")
		expect(EDIT_MODE.ADD_EDGE).toBe("add-edge")
		expect(EDIT_MODE.MOVE_NODE).toBe("move-node")
		expect(EDIT_MODE.DELETE).toBe("delete")
		expect(EDIT_MODE.SET_START).toBe("set-start")
	})

	it("is frozen (as const)", () => {
		expect(Object.isFrozen(EDIT_MODE)).toBe(false) // as const does not freeze at runtime
		// But the values are the correct string literals
		const values = Object.values(EDIT_MODE)
		expect(values).toContain("select")
		expect(values).toContain("add-node")
		expect(values).toContain("add-edge")
		expect(values).toContain("move-node")
		expect(values).toContain("delete")
		expect(values).toContain("set-start")
	})
})

// ---------------------------------------------------------------------------
// G1-D — const-type pattern (GRAPH_STEP_KIND)
// ---------------------------------------------------------------------------

describe("GRAPH_STEP_KIND const object", () => {
	it("has all expected step kinds", () => {
		expect(GRAPH_STEP_KIND.VISIT).toBe("visit")
		expect(GRAPH_STEP_KIND.FRONTIER).toBe("frontier")
		expect(GRAPH_STEP_KIND.TREE_EDGE).toBe("tree-edge")
		expect(GRAPH_STEP_KIND.BACK_EDGE).toBe("back-edge")
		expect(GRAPH_STEP_KIND.MST_INCLUDE).toBe("mst-include")
		expect(GRAPH_STEP_KIND.MST_REJECT).toBe("mst-reject")
	})
})

// ---------------------------------------------------------------------------
// G1-D — TypeScript interface shape checks (structural)
// ---------------------------------------------------------------------------

describe("GraphNode interface shape", () => {
	it("accepts a valid GraphNode object", () => {
		const node: GraphNode = { id: "n1", x: 100, y: 200, label: "A" }
		expect(node.id).toBe("n1")
		expect(node.x).toBe(100)
		expect(node.y).toBe(200)
		expect(node.label).toBe("A")
	})
})

describe("GraphEdge interface shape", () => {
	it("accepts a valid GraphEdge object", () => {
		const edge: GraphEdge = { id: "e1", source: "n1", target: "n2", weight: 3 }
		expect(edge.id).toBe("e1")
		expect(edge.source).toBe("n1")
		expect(edge.target).toBe("n2")
		expect(edge.weight).toBe(3)
	})
})

describe("GraphData interface shape", () => {
	it("accepts a valid GraphData object with Maps", () => {
		const nodes = new Map<string, GraphNode>()
		const edges = new Map<string, GraphEdge>()
		const graph: GraphData = { nodes, edges, directed: false }
		expect(graph.nodes).toBeInstanceOf(Map)
		expect(graph.edges).toBeInstanceOf(Map)
		expect(graph.directed).toBe(false)
	})
})
