/**
 * MetricsPanel — Testing Library tests.
 *
 * Tests focus on:
 *   - Correct metric values rendered from store state
 *   - "—" shown when no path found or no result yet
 *   - ARIA live region announces results on run completion
 *   - Component uses ARIA roles accessible to screen readers
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

// Mock the store so we can control state without running a real Zustand store
vi.mock("@/store/pathfinding-store", () => ({
	usePathfindingStore: vi.fn(),
	selectMetrics: (s: { result: { metrics: unknown } | null }) => s.result?.metrics ?? null,
	RUN_STATUS: {
		IDLE: "idle",
		RUNNING: "running",
		PAUSED: "paused",
		DONE: "done",
	},
}))

vi.mock("@/lib/algorithms/pathfinding/index", () => ({
	ALGORITHM_REGISTRY: {
		astar: { label: "A*", pseudocode: [] },
		dijkstra: { label: "Dijkstra", pseudocode: [] },
		bfs: { label: "BFS", pseudocode: [] },
		dfs: { label: "DFS", pseudocode: [] },
	},
}))

import { usePathfindingStore } from "@/store/pathfinding-store"
import { MetricsPanel } from "./MetricsPanel"

const mockUseStore = usePathfindingStore as unknown as ReturnType<typeof vi.fn>

function setupStore(
	status: string,
	metrics: { visitedCount: number; pathLength: number; pathCost: number; reachable: boolean } | null
) {
	mockUseStore.mockImplementation((selector: (s: unknown) => unknown) => {
		const state = {
			status,
			algorithm: "astar",
			result: metrics ? { metrics } : null,
		}
		if (typeof selector === "function") return selector(state)
		return state
	})
}

beforeEach(() => {
	vi.clearAllMocks()
})

describe("MetricsPanel", () => {
	it("shows dashes when no result exists (idle state)", () => {
		setupStore("idle", null)
		render(<MetricsPanel />)

		// All three metric cells should show "—"
		const dashes = screen.getAllByText("—")
		expect(dashes.length).toBeGreaterThanOrEqual(3)
	})

	it("shows visited count and dashes for path when no path found", () => {
		setupStore("done", {
			visitedCount: 42,
			pathLength: 0,
			pathCost: 0,
			reachable: false,
		})
		render(<MetricsPanel />)

		expect(screen.getByText("42")).toBeInTheDocument()
		// Path length and cost should be "—" when not reachable
		const dashes = screen.getAllByText("—")
		expect(dashes.length).toBeGreaterThanOrEqual(2)
	})

	it("shows full metrics when path is found", () => {
		setupStore("done", {
			visitedCount: 55,
			pathLength: 9,
			pathCost: 12,
			reachable: true,
		})
		render(<MetricsPanel />)

		expect(screen.getByText("55")).toBeInTheDocument()
		expect(screen.getByText("9")).toBeInTheDocument()
		expect(screen.getByText("12")).toBeInTheDocument()
	})

	it("renders accessible description terms via dl/dt/dd structure", () => {
		setupStore("idle", null)
		render(<MetricsPanel />)

		expect(screen.getByText("Visited")).toBeInTheDocument()
		expect(screen.getByText("Path length")).toBeInTheDocument()
		expect(screen.getByText("Cost")).toBeInTheDocument()
	})

	it("has an ARIA live region with role status", () => {
		setupStore("idle", null)
		render(<MetricsPanel />)

		const live = screen.getByRole("status")
		expect(live).toBeInTheDocument()
	})

	it("live region is empty when status is not done", () => {
		setupStore("running", {
			visitedCount: 10,
			pathLength: 0,
			pathCost: 0,
			reachable: false,
		})
		render(<MetricsPanel />)

		const live = screen.getByRole("status")
		expect(live).toHaveTextContent("")
	})

	it("live region announces success result when status is done and path found", () => {
		setupStore("done", {
			visitedCount: 42,
			pathLength: 9,
			pathCost: 9,
			reachable: true,
		})
		render(<MetricsPanel />)

		const live = screen.getByRole("status")
		expect(live).toHaveTextContent(/A\*.*completed.*Visited 42 cells.*Path length: 9.*Cost: 9/)
	})

	it("live region announces no-path result when status is done and no path", () => {
		setupStore("done", {
			visitedCount: 88,
			pathLength: 0,
			pathCost: 0,
			reachable: false,
		})
		render(<MetricsPanel />)

		const live = screen.getByRole("status")
		expect(live).toHaveTextContent(/A\*.*completed.*No path found/)
	})
})
