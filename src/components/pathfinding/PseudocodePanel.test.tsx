/**
 * PseudocodePanel — Testing Library tests.
 *
 * Tests focus on:
 *   - Pseudocode lines rendered for the active algorithm
 *   - Active line receives aria-current="step"
 *   - No line is highlighted (aria-current absent) when activeLine is -1 (idle, M4)
 *   - Algorithm label shown in header
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

// Note: vi.mock is hoisted — do NOT use top-level `const` in the factory.
// Inline the pseudocode data directly inside the factory.
vi.mock("@/store/pathfinding-store", () => ({
	usePathfindingStore: vi.fn(),
	selectActiveLine: (s: { result: { trace: Array<{ line: number }> } | null; cursor: number }) =>
		s.result?.trace[s.cursor]?.line ?? -1,
}))

vi.mock("@/lib/algorithms/pathfinding/index", () => ({
	ALGORITHM_REGISTRY: {
		astar: {
			label: "A*",
			pseudocode: [
				{ id: 0, text: "initialize open set with start" },
				{ id: 1, text: "while open set is not empty" },
				{ id: 2, text: "  pick node with lowest f score" },
				{ id: 3, text: "return path" },
			],
		},
		dijkstra: { label: "Dijkstra", pseudocode: [] },
		bfs: { label: "BFS", pseudocode: [] },
		dfs: { label: "DFS", pseudocode: [] },
	},
}))

import { usePathfindingStore } from "@/store/pathfinding-store"
import { PseudocodePanel } from "./PseudocodePanel"

const mockUseStore = usePathfindingStore as unknown as ReturnType<typeof vi.fn>

function setupStore(algorithm: string, activeLine: number) {
	mockUseStore.mockImplementation((selector: (s: unknown) => unknown) => {
		const state = {
			algorithm,
			result:
				activeLine >= 0 ? { trace: [{ kind: "visit", cell: 0, line: activeLine }] } : null,
			cursor: 0,
		}
		if (typeof selector === "function") return selector(state)
		return state
	})
}

beforeEach(() => {
	vi.clearAllMocks()
})

describe("PseudocodePanel", () => {
	it("renders pseudocode lines for the selected algorithm", () => {
		setupStore("astar", -1)
		render(<PseudocodePanel />)

		expect(screen.getByText("initialize open set with start")).toBeInTheDocument()
		expect(screen.getByText("while open set is not empty")).toBeInTheDocument()
		expect(screen.getByText("return path")).toBeInTheDocument()
	})

	it("shows algorithm label in the panel header", () => {
		setupStore("astar", -1)
		render(<PseudocodePanel />)

		expect(screen.getByText(/A\* pseudocode/i)).toBeInTheDocument()
	})

	it("does not mark any line as active when activeLine is -1 (idle state, M4)", () => {
		setupStore("astar", -1)
		render(<PseudocodePanel />)

		// No list item should have aria-current="step"
		const items = screen.getAllByRole("listitem")
		for (const item of items) {
			expect(item).not.toHaveAttribute("aria-current", "step")
		}
	})

	it("marks the correct line active with aria-current='step' when animating", () => {
		setupStore("astar", 2)
		render(<PseudocodePanel />)

		// Use regex to match text regardless of whitespace collapsing in jsdom
		const activeItem = screen.getByText(/pick node with lowest f score/).closest("li")
		expect(activeItem).toHaveAttribute("aria-current", "step")
	})

	it("only one line has aria-current='step' at a time", () => {
		setupStore("astar", 1)
		render(<PseudocodePanel />)

		const activeItems = screen
			.getAllByRole("listitem")
			.filter((el) => el.getAttribute("aria-current") === "step")
		expect(activeItems).toHaveLength(1)
	})

	it("panel list is accessible via aria-label", () => {
		setupStore("astar", -1)
		const { container } = render(<PseudocodePanel />)

		// A <div role="region"> wraps the <ol> so AT announces the scroll container
		// as a named landmark while the <ol> retains its implicit list semantics.
		const region = screen.getByRole("region", { name: /A\* pseudocode/i })
		expect(region).toBeInTheDocument()
		// Confirm it is still the <ol> element (list items remain inside it)
		const items = container.querySelectorAll("li")
		expect(items.length).toBeGreaterThan(0)
	})
})
