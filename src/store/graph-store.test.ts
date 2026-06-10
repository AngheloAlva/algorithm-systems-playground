/**
 * Tests for graph-store.
 *
 * Covers:
 * - G7-A: ADD_EDGE cancels on empty canvas (pendingEdgeSource cleared, no new edge)
 * - G7-B: no-start-node guard (status = NO_START_NODE when startId is null)
 * - G7-C: silentRecompute after topology change
 * - G7-D: SET_START mode
 * - Map reactivity invariant (new GraphData reference on topology mutation)
 * - loadSample() resets startId + status + traceResult
 * - clearAll() produces empty graph
 * - setEditMode clears pendingEdgeSource / interaction on transition out of ADD_EDGE
 * - NG2: store does NOT use zustand/middleware/persist
 */

import { describe, it, expect, beforeEach } from "vitest"
import { useGraphStore } from "./graph-store"
import { EDIT_MODE } from "../lib/graph/types"
import { RUN_STATUS } from "./pathfinding-store"
import { GRAPH_ALGORITHM } from "../lib/algorithms/graph/index"
import { act } from "@testing-library/react"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset store to initial state before each test. */
function resetStore() {
	useGraphStore.setState(useGraphStore.getInitialState(), true)
}

// ---------------------------------------------------------------------------
// A10.1 — Map reactivity invariant
// ---------------------------------------------------------------------------

describe("graph-store — Map reactivity invariant", () => {
	beforeEach(() => {
		resetStore()
	})

	it("addNodeAt returns a new GraphData reference", () => {
		const before = useGraphStore.getState().graph
		act(() => {
			useGraphStore.getState().addNodeAt(100, 100)
		})
		const after = useGraphStore.getState().graph
		expect(after).not.toBe(before)
		expect(after.nodes).not.toBe(before.nodes)
		expect(after.nodes.size).toBe(before.nodes.size + 1)
	})

	it("removeNode returns a new GraphData reference", () => {
		act(() => {
			useGraphStore.getState().addNodeAt(100, 100)
		})
		const nodeId = [...useGraphStore.getState().graph.nodes.keys()][0]
		const before = useGraphStore.getState().graph
		act(() => {
			useGraphStore.getState().removeNode(nodeId)
		})
		const after = useGraphStore.getState().graph
		expect(after).not.toBe(before)
		expect(after.nodes.size).toBe(0)
	})

	it("addEdgeBetween returns a new GraphData reference", () => {
		act(() => {
			useGraphStore.getState().addNodeAt(100, 100)
			useGraphStore.getState().addNodeAt(200, 200)
		})
		const nodeIds = [...useGraphStore.getState().graph.nodes.keys()]
		const before = useGraphStore.getState().graph
		act(() => {
			useGraphStore.getState().addEdgeBetween(nodeIds[0], nodeIds[1])
		})
		const after = useGraphStore.getState().graph
		expect(after).not.toBe(before)
		expect(after.edges).not.toBe(before.edges)
	})

	it("setDirected returns a new GraphData reference", () => {
		const before = useGraphStore.getState().graph
		act(() => {
			useGraphStore.getState().setDirected(true)
		})
		const after = useGraphStore.getState().graph
		expect(after).not.toBe(before)
		expect(after.directed).toBe(true)
	})
})

// ---------------------------------------------------------------------------
// A10.2 — Mode transitions
// ---------------------------------------------------------------------------

describe("graph-store — mode transitions (setEditMode)", () => {
	beforeEach(() => {
		resetStore()
	})

	it("initial editMode is SELECT", () => {
		expect(useGraphStore.getState().editMode).toBe(EDIT_MODE.SELECT)
	})

	it("setEditMode transitions to any mode", () => {
		act(() => {
			useGraphStore.getState().setEditMode(EDIT_MODE.ADD_NODE)
		})
		expect(useGraphStore.getState().editMode).toBe(EDIT_MODE.ADD_NODE)
	})

	it("setEditMode clears pendingEdgeSource when leaving ADD_EDGE", () => {
		// Set up ADD_EDGE with a pending source
		act(() => {
			useGraphStore.setState({
				editMode: EDIT_MODE.ADD_EDGE,
				interaction: { kind: "linking", sourceId: "n1", x: 0, y: 0 },
			})
		})
		act(() => {
			useGraphStore.getState().setEditMode(EDIT_MODE.SELECT)
		})
		expect(useGraphStore.getState().interaction).toEqual({ kind: "none" })
	})

	it("setEditMode clears selection", () => {
		act(() => {
			useGraphStore.setState({ selection: { kind: "node", id: "n1" } })
			useGraphStore.getState().setEditMode(EDIT_MODE.ADD_NODE)
		})
		expect(useGraphStore.getState().selection).toBeNull()
	})
})

// ---------------------------------------------------------------------------
// A10.3 — G7-A: ADD_EDGE cancel on empty canvas
// ---------------------------------------------------------------------------

describe("graph-store — G7-A: ADD_EDGE cancel when pointer hits no node", () => {
	beforeEach(() => {
		resetStore()
	})

	it("clears pendingEdgeSource and interaction when no target found", () => {
		act(() => {
			// Switch to ADD_EDGE mode
			useGraphStore.getState().setEditMode(EDIT_MODE.ADD_EDGE)
			// Set interaction as if rubber-band is active
			useGraphStore.setState({
				interaction: { kind: "linking", sourceId: "n1", x: 50, y: 50 },
			})
		})

		const edgeCountBefore = useGraphStore.getState().graph.edges.size

		act(() => {
			// endLink with null (pointer not on any node)
			useGraphStore.getState().endLink(null)
		})

		const state = useGraphStore.getState()
		expect(state.interaction).toEqual({ kind: "none" })
		expect(state.graph.edges.size).toBe(edgeCountBefore)
	})
})

// ---------------------------------------------------------------------------
// A10.4 — G7-B: no-start-node guard
// ---------------------------------------------------------------------------

describe("graph-store — G7-B: no-start-node guard", () => {
	beforeEach(() => {
		resetStore()
	})

	it("sets status to NO_START_NODE when running with no startId", () => {
		// Load sample graph so there's something to run on, but unset startId
		act(() => {
			useGraphStore.getState().loadSampleGraph()
		})
		act(() => {
			useGraphStore.setState({ startId: null })
		})

		act(() => {
			useGraphStore.getState().run()
		})

		const state = useGraphStore.getState()
		expect(state.status).toBe(RUN_STATUS.NO_START_NODE)
		expect(state.result).toBeNull()
	})

	it("does NOT set no-start-node when startId is set", () => {
		act(() => {
			useGraphStore.getState().loadSampleGraph()
		})
		const firstNodeId = [...useGraphStore.getState().graph.nodes.keys()][0]
		act(() => {
			useGraphStore.setState({ startId: firstNodeId })
			useGraphStore.getState().run()
		})

		expect(useGraphStore.getState().status).not.toBe(RUN_STATUS.NO_START_NODE)
	})
})

// ---------------------------------------------------------------------------
// A10.5 — G7-C: silentRecompute after topology change
// ---------------------------------------------------------------------------

describe("graph-store — G7-C: silentRecompute after topology change", () => {
	beforeEach(() => {
		resetStore()
	})

	it("silentRecompute is a no-op when status is idle", () => {
		expect(useGraphStore.getState().status).toBe(RUN_STATUS.IDLE)
		act(() => {
			useGraphStore.getState().addNodeAt(100, 100)
		})
		// Status stays IDLE
		expect(useGraphStore.getState().status).toBe(RUN_STATUS.IDLE)
		expect(useGraphStore.getState().result).toBeNull()
	})

	it("silentRecompute updates result after deletion when trace was running", () => {
		// Load sample + set start + run to get a trace
		act(() => {
			useGraphStore.getState().loadSampleGraph()
		})
		const firstNodeId = [...useGraphStore.getState().graph.nodes.keys()][0]
		act(() => {
			useGraphStore.setState({ startId: firstNodeId })
			useGraphStore.getState().run()
		})
		const resultBefore = useGraphStore.getState().result
		expect(resultBefore).not.toBeNull()

		// Add a node (topology change) — should recompute
		act(() => {
			useGraphStore.getState().addNodeAt(400, 400)
		})

		const resultAfter = useGraphStore.getState().result
		// Result should be present (recomputed)
		expect(resultAfter).not.toBeNull()
		// Status should remain DONE
		expect(useGraphStore.getState().status).toBe(RUN_STATUS.DONE)
	})
})

// ---------------------------------------------------------------------------
// A10.6 — G7-D: SET_START mode
// ---------------------------------------------------------------------------

describe("graph-store — G7-D: SET_START mode", () => {
	beforeEach(() => {
		resetStore()
	})

	it("handleCanvasPointerDown in SET_START mode sets startId to the hit node", () => {
		// Add a node at a known position
		act(() => {
			useGraphStore.getState().addNodeAt(100, 100)
		})
		const nodeId = [...useGraphStore.getState().graph.nodes.keys()][0]

		act(() => {
			useGraphStore.getState().setEditMode(EDIT_MODE.SET_START)
			useGraphStore.getState().handleCanvasPointerDown(100, 100)
		})

		expect(useGraphStore.getState().startId).toBe(nodeId)
	})
})

// ---------------------------------------------------------------------------
// A10.7 — loadSampleGraph
// ---------------------------------------------------------------------------

describe("graph-store — loadSampleGraph action", () => {
	beforeEach(() => {
		resetStore()
	})

	it("loads sample graph and resets startId, status, result", () => {
		// First set some state
		act(() => {
			useGraphStore.setState({ startId: "some-id", status: RUN_STATUS.DONE })
		})

		act(() => {
			useGraphStore.getState().loadSampleGraph()
		})

		const state = useGraphStore.getState()
		expect(state.startId).toBeNull()
		expect(state.status).toBe(RUN_STATUS.IDLE)
		expect(state.result).toBeNull()
		expect(state.graph.nodes.size).toBeGreaterThan(0)
	})
})

// ---------------------------------------------------------------------------
// A10.8 — clearAll
// ---------------------------------------------------------------------------

describe("graph-store — clearAll action", () => {
	beforeEach(() => {
		resetStore()
	})

	it("produces an empty graph and resets state", () => {
		act(() => {
			useGraphStore.getState().loadSampleGraph()
		})
		act(() => {
			useGraphStore.getState().clearAll()
		})

		const state = useGraphStore.getState()
		expect(state.graph.nodes.size).toBe(0)
		expect(state.graph.edges.size).toBe(0)
		expect(state.startId).toBeNull()
		expect(state.status).toBe(RUN_STATUS.IDLE)
		expect(state.result).toBeNull()
	})
})

// ---------------------------------------------------------------------------
// A10.9 — FIX 2: selection cleared on delete
// ---------------------------------------------------------------------------

describe("graph-store — FIX 2: selection cleared when selected item is deleted", () => {
	beforeEach(() => {
		resetStore()
	})

	it("clears selection when the selected node is removed", () => {
		act(() => {
			useGraphStore.getState().addNodeAt(100, 100)
		})
		const nodeId = [...useGraphStore.getState().graph.nodes.keys()][0]
		act(() => {
			useGraphStore.getState().setSelection({ kind: "node", id: nodeId })
		})
		expect(useGraphStore.getState().selection).toEqual({ kind: "node", id: nodeId })

		act(() => {
			useGraphStore.getState().removeNode(nodeId)
		})
		expect(useGraphStore.getState().selection).toBeNull()
	})

	it("clears selection when the selected edge is removed", () => {
		act(() => {
			useGraphStore.getState().addNodeAt(100, 100)
			useGraphStore.getState().addNodeAt(200, 200)
		})
		const nodeIds = [...useGraphStore.getState().graph.nodes.keys()]
		act(() => {
			useGraphStore.getState().addEdgeBetween(nodeIds[0], nodeIds[1])
		})
		const edgeId = [...useGraphStore.getState().graph.edges.keys()][0]
		act(() => {
			useGraphStore.getState().setSelection({ kind: "edge", id: edgeId })
		})
		expect(useGraphStore.getState().selection).toEqual({ kind: "edge", id: edgeId })

		act(() => {
			useGraphStore.getState().removeEdge(edgeId)
		})
		expect(useGraphStore.getState().selection).toBeNull()
	})

	it("does NOT clear selection when a different node is removed", () => {
		act(() => {
			useGraphStore.getState().addNodeAt(100, 100)
			useGraphStore.getState().addNodeAt(200, 200)
		})
		const nodeIds = [...useGraphStore.getState().graph.nodes.keys()]
		act(() => {
			useGraphStore.getState().setSelection({ kind: "node", id: nodeIds[0] })
		})
		act(() => {
			useGraphStore.getState().removeNode(nodeIds[1])
		})
		expect(useGraphStore.getState().selection).toEqual({ kind: "node", id: nodeIds[0] })
	})
})

// ---------------------------------------------------------------------------
// A10.10 — FIX 6: setEditMode always clears interaction
// ---------------------------------------------------------------------------

describe("graph-store — FIX 6: setEditMode always clears interaction", () => {
	beforeEach(() => {
		resetStore()
	})

	it("clears interaction when switching from ADD_NODE (not just ADD_EDGE/MOVE_NODE)", () => {
		act(() => {
			useGraphStore.setState({
				editMode: EDIT_MODE.ADD_NODE,
				interaction: { kind: "linking", sourceId: "n1", x: 0, y: 0 },
			})
		})
		act(() => {
			useGraphStore.getState().setEditMode(EDIT_MODE.SELECT)
		})
		expect(useGraphStore.getState().interaction).toEqual({ kind: "none" })
	})

	it("clears interaction when switching between any modes", () => {
		act(() => {
			useGraphStore.setState({
				editMode: EDIT_MODE.DELETE,
				interaction: { kind: "moving", nodeId: "n1" },
			})
		})
		act(() => {
			useGraphStore.getState().setEditMode(EDIT_MODE.ADD_EDGE)
		})
		expect(useGraphStore.getState().interaction).toEqual({ kind: "none" })
	})
})

// ---------------------------------------------------------------------------
// A10.11 — FIX 9: topology edit during RUNNING resets to IDLE
// ---------------------------------------------------------------------------

describe("graph-store — FIX 9: topology edit during RUNNING resets state", () => {
	beforeEach(() => {
		resetStore()
	})

	it("addNodeAt during RUNNING sets status=IDLE and result=null", () => {
		act(() => {
			useGraphStore.getState().loadSampleGraph()
		})
		const firstNodeId = [...useGraphStore.getState().graph.nodes.keys()][0]
		act(() => {
			useGraphStore.setState({ startId: firstNodeId })
			useGraphStore.getState().run()
		})
		// Manually set RUNNING to simulate active playback
		act(() => {
			useGraphStore.setState({ status: RUN_STATUS.RUNNING })
		})
		expect(useGraphStore.getState().status).toBe(RUN_STATUS.RUNNING)
		expect(useGraphStore.getState().result).not.toBeNull()

		act(() => {
			useGraphStore.getState().addNodeAt(400, 400)
		})
		expect(useGraphStore.getState().status).toBe(RUN_STATUS.IDLE)
		expect(useGraphStore.getState().result).toBeNull()
	})

	it("removeNode during RUNNING sets status=IDLE and result=null", () => {
		act(() => {
			useGraphStore.getState().loadSampleGraph()
		})
		const nodeIds = [...useGraphStore.getState().graph.nodes.keys()]
		act(() => {
			useGraphStore.setState({ startId: nodeIds[0], status: RUN_STATUS.RUNNING, result: { steps: [], metrics: { visitedCount: 0, traversalOrder: [] } } })
		})
		act(() => {
			useGraphStore.getState().removeNode(nodeIds[1])
		})
		expect(useGraphStore.getState().status).toBe(RUN_STATUS.IDLE)
		expect(useGraphStore.getState().result).toBeNull()
	})

	it("topology edit during PAUSED also resets to IDLE", () => {
		act(() => {
			useGraphStore.getState().loadSampleGraph()
		})
		act(() => {
			useGraphStore.setState({ status: RUN_STATUS.PAUSED, result: { steps: [], metrics: { visitedCount: 0, traversalOrder: [] } } })
		})
		act(() => {
			useGraphStore.getState().addNodeAt(400, 400)
		})
		expect(useGraphStore.getState().status).toBe(RUN_STATUS.IDLE)
		expect(useGraphStore.getState().result).toBeNull()
	})

	it("topology edit during IDLE does not change IDLE status", () => {
		act(() => {
			useGraphStore.getState().addNodeAt(100, 100)
		})
		expect(useGraphStore.getState().status).toBe(RUN_STATUS.IDLE)
		expect(useGraphStore.getState().result).toBeNull()
	})
})

// ---------------------------------------------------------------------------
// A10.12 — FIX B: setAlgorithm when DONE recomputes with new algorithm
// ---------------------------------------------------------------------------

describe("graph-store — FIX B: setAlgorithm when DONE yields fresh result for new algorithm", () => {
	beforeEach(() => {
		resetStore()
	})

	it("setAlgorithm while DONE produces a non-null result for the new algorithm, not the old trace", () => {
		// Load sample graph and set a start node
		act(() => {
			useGraphStore.getState().loadSampleGraph()
		})
		const firstNodeId = [...useGraphStore.getState().graph.nodes.keys()][0]
		act(() => {
			useGraphStore.setState({ startId: firstNodeId })
			useGraphStore.getState().run()
		})

		const resultBefore = useGraphStore.getState().result
		expect(resultBefore).not.toBeNull()
		expect(useGraphStore.getState().status).toBe(RUN_STATUS.DONE)

		// Switch algorithm while DONE (BFS → DFS or vice versa)
		const currentAlgorithm = useGraphStore.getState().algorithm
		const nextAlgorithm =
			currentAlgorithm === GRAPH_ALGORITHM.BFS ? GRAPH_ALGORITHM.DFS : GRAPH_ALGORITHM.BFS

		act(() => {
			useGraphStore.getState().setAlgorithm(nextAlgorithm)
		})

		const state = useGraphStore.getState()
		// Status stays DONE (silentRecompute recomputed with new algorithm)
		expect(state.status).toBe(RUN_STATUS.DONE)
		// Result is fresh and non-null
		expect(state.result).not.toBeNull()
		// Result is not the same object as the old trace (it was recomputed)
		expect(state.result).not.toBe(resultBefore)
		// Algorithm updated
		expect(state.algorithm).toBe(nextAlgorithm)
	})

	it("setAlgorithm while IDLE stays IDLE with null result", () => {
		act(() => {
			useGraphStore.getState().loadSampleGraph()
		})
		// Do NOT run — keep status IDLE
		expect(useGraphStore.getState().status).toBe(RUN_STATUS.IDLE)

		act(() => {
			useGraphStore.getState().setAlgorithm(GRAPH_ALGORITHM.DFS)
		})

		const state = useGraphStore.getState()
		// silentRecompute is a no-op on IDLE → stays IDLE, result stays null
		expect(state.status).toBe(RUN_STATUS.IDLE)
		expect(state.result).toBeNull()
		expect(state.algorithm).toBe(GRAPH_ALGORITHM.DFS)
	})
})

// ---------------------------------------------------------------------------
// NG2 — no zustand persist middleware
// ---------------------------------------------------------------------------

describe("graph-store — NG2: no persist middleware", () => {
	it("store source does not use persist (structural check)", async () => {
		// Import the raw module text to verify no persist import
		const storeModule = await import("./graph-store?raw")
		const src = (storeModule as unknown as { default: string }).default
		expect(src).not.toContain("zustand/middleware/persist")
		expect(src).not.toContain("persist(")
	})
})
