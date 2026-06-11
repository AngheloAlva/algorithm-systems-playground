/**
 * Unit tests for GraphCanvas replayTo — the pure replay helper.
 *
 * These tests verify that:
 * - visit/frontier steps populate the correct sets
 * - tree-edge/back-edge steps populate the correct sets
 * - mst-include/mst-reject steps populate the correct sets (C6)
 * - partial replay at an intermediate cursor produces the correct intermediate state
 */

import { describe, it, expect } from "vitest"
import { replayTo } from "./GraphCanvas"
import type { GraphTraceResult } from "@/lib/graph/types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTrace(steps: GraphTraceResult["steps"]): GraphTraceResult {
	return { steps, metrics: { visitedCount: 0, traversalOrder: [] } }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("replayTo — visit / frontier steps", () => {
	it("visit step adds nodeId to visited and removes from frontier", () => {
		const trace = makeTrace([
			{ kind: "frontier", nodeId: "n1", line: 0 },
			{ kind: "visit", nodeId: "n1", line: 1 },
		])

		const state = replayTo(trace, 1)
		expect(state.visited.has("n1")).toBe(true)
		expect(state.frontier.has("n1")).toBe(false)
	})

	it("frontier step adds nodeId to frontier", () => {
		const trace = makeTrace([{ kind: "frontier", nodeId: "n2", line: 0 }])

		const state = replayTo(trace, 0)
		expect(state.frontier.has("n2")).toBe(true)
		expect(state.visited.has("n2")).toBe(false)
	})
})

describe("replayTo — tree-edge / back-edge steps", () => {
	it("tree-edge step adds edgeId to treeEdges", () => {
		const trace = makeTrace([
			{ kind: "tree-edge", fromId: "n1", toId: "n2", edgeId: "e12", line: 0 },
		])

		const state = replayTo(trace, 0)
		expect(state.treeEdges.has("e12")).toBe(true)
		expect(state.backEdges.has("e12")).toBe(false)
	})

	it("back-edge step adds edgeId to backEdges", () => {
		const trace = makeTrace([
			{ kind: "back-edge", fromId: "n2", toId: "n1", edgeId: "e21", line: 0 },
		])

		const state = replayTo(trace, 0)
		expect(state.backEdges.has("e21")).toBe(true)
		expect(state.treeEdges.has("e21")).toBe(false)
	})
})

describe("replayTo — C6: mst-include / mst-reject steps", () => {
	it("mst-include step adds edgeId to mstInclude", () => {
		const trace = makeTrace([{ kind: "mst-include", edgeId: "eCD", line: 0 }])

		const state = replayTo(trace, 0)
		expect(state.mstInclude.has("eCD")).toBe(true)
		expect(state.mstReject.has("eCD")).toBe(false)
	})

	it("mst-reject step adds edgeId to mstReject", () => {
		const trace = makeTrace([{ kind: "mst-reject", edgeId: "eAB", line: 0 }])

		const state = replayTo(trace, 0)
		expect(state.mstReject.has("eAB")).toBe(true)
		expect(state.mstInclude.has("eAB")).toBe(false)
	})

	it("mixed MST trace: includes and rejects are in separate sets", () => {
		const trace = makeTrace([
			{ kind: "mst-include", edgeId: "eCD", line: 0 },
			{ kind: "mst-include", edgeId: "eAC", line: 0 },
			{ kind: "mst-reject", edgeId: "eAB", line: 0 },
		])

		const state = replayTo(trace, 2)
		expect(state.mstInclude.has("eCD")).toBe(true)
		expect(state.mstInclude.has("eAC")).toBe(true)
		expect(state.mstReject.has("eAB")).toBe(true)

		// Included edges not in reject and vice versa
		expect(state.mstInclude.has("eAB")).toBe(false)
		expect(state.mstReject.has("eCD")).toBe(false)
		expect(state.mstReject.has("eAC")).toBe(false)
	})

	it("partial replay at cursor=1 only includes first two steps", () => {
		const trace = makeTrace([
			{ kind: "mst-include", edgeId: "e1", line: 0 },
			{ kind: "mst-include", edgeId: "e2", line: 0 },
			{ kind: "mst-reject", edgeId: "e3", line: 0 },
		])

		const state = replayTo(trace, 1) // only steps[0..1]
		expect(state.mstInclude.has("e1")).toBe(true)
		expect(state.mstInclude.has("e2")).toBe(true)
		expect(state.mstReject.has("e3")).toBe(false) // step[2] not yet replayed
	})

	it("empty trace returns empty sets", () => {
		const trace = makeTrace([])
		const state = replayTo(trace, 0)
		expect(state.mstInclude.size).toBe(0)
		expect(state.mstReject.size).toBe(0)
		expect(state.visited.size).toBe(0)
		expect(state.frontier.size).toBe(0)
	})

	it("cursor=-1 (before any steps) returns all empty sets", () => {
		const trace = makeTrace([{ kind: "mst-include", edgeId: "e1", line: 0 }])
		const state = replayTo(trace, -1)
		expect(state.mstInclude.size).toBe(0)
	})
})

describe("replayTo — C6: Kruskal integration smoke test", () => {
	it("replaying full Kruskal trace yields the correct included/rejected edge counts", async () => {
		// Use the Kruskal algorithm directly to generate a trace
		const { runKruskal } = await import("@/lib/algorithms/graph/kruskal")

		// Build test graph: A—B(4), A—C(2), B—C(3), B—D(5), C—D(1)
		const nodes = new Map([
			["nA", { id: "nA", x: 0, y: 0, label: "A" }],
			["nB", { id: "nB", x: 0, y: 0, label: "B" }],
			["nC", { id: "nC", x: 0, y: 0, label: "C" }],
			["nD", { id: "nD", x: 0, y: 0, label: "D" }],
		])
		const edges = new Map([
			["eAB", { id: "eAB", source: "nA", target: "nB", weight: 4 }],
			["eAC", { id: "eAC", source: "nA", target: "nC", weight: 2 }],
			["eBC", { id: "eBC", source: "nB", target: "nC", weight: 3 }],
			["eBD", { id: "eBD", source: "nB", target: "nD", weight: 5 }],
			["eCD", { id: "eCD", source: "nC", target: "nD", weight: 1 }],
		])

		const trace = runKruskal({ nodes, edges, directed: false }, "")
		const state = replayTo(trace, trace.steps.length - 1)

		// 3 edges included (C-D, A-C, B-C), 2 rejected (A-B, B-D)
		expect(state.mstInclude.size).toBe(3)
		expect(state.mstReject.size).toBe(2)
	})
})
