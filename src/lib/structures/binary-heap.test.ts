import { describe, it, expect } from "vitest"
import { BinaryHeap } from "./binary-heap"

// ---------------------------------------------------------------------------
// Comparator: min-heap on numbers
// ---------------------------------------------------------------------------

const minCmp = (a: number, b: number) => a - b

describe("BinaryHeap — basic operations", () => {
	it("starts empty", () => {
		const h = new BinaryHeap<number>(minCmp)
		expect(h.size()).toBe(0)
	})

	it("size increases after push", () => {
		const h = new BinaryHeap<number>(minCmp)
		h.push(5)
		h.push(3)
		expect(h.size()).toBe(2)
	})

	it("peek returns minimum without removing it", () => {
		const h = new BinaryHeap<number>(minCmp)
		h.push(7)
		h.push(2)
		h.push(9)
		expect(h.peek()).toBe(2)
		expect(h.size()).toBe(3)
	})

	it("peek returns undefined on empty heap", () => {
		const h = new BinaryHeap<number>(minCmp)
		expect(h.peek()).toBeUndefined()
	})

	it("pop removes and returns the minimum", () => {
		const h = new BinaryHeap<number>(minCmp)
		h.push(4)
		h.push(1)
		h.push(7)
		expect(h.pop()).toBe(1)
		expect(h.size()).toBe(2)
	})

	it("pop on empty heap returns undefined", () => {
		const h = new BinaryHeap<number>(minCmp)
		expect(h.pop()).toBeUndefined()
	})
})

describe("BinaryHeap — min-heap ordering", () => {
	it("pops in ascending order (min-heap)", () => {
		const h = new BinaryHeap<number>(minCmp)
		const values = [5, 3, 8, 1, 9, 2, 7, 4, 6]
		for (const v of values) h.push(v)

		const popped: number[] = []
		while (h.size() > 0) popped.push(h.pop()!)
		expect(popped).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
	})

	it("handles push after some pops", () => {
		const h = new BinaryHeap<number>(minCmp)
		h.push(10)
		h.push(5)
		h.pop() // removes 5
		h.push(1)
		expect(h.pop()).toBe(1)
		expect(h.pop()).toBe(10)
	})

	it("handles duplicate values", () => {
		const h = new BinaryHeap<number>(minCmp)
		h.push(3)
		h.push(3)
		h.push(3)
		expect(h.pop()).toBe(3)
		expect(h.pop()).toBe(3)
		expect(h.pop()).toBe(3)
		expect(h.size()).toBe(0)
	})
})

describe("BinaryHeap — push-duplicate + skip-stale pattern", () => {
	/**
	 * Dijkstra/A* use push-duplicate + skip-stale instead of decrease-key.
	 * This test verifies the heap correctly returns the minimum even when
	 * duplicate entries exist with different priorities.
	 * The CALLER is responsible for skipping stale entries on pop.
	 */
	interface Entry {
		id: number
		cost: number
	}

	const entryCmp = (a: Entry, b: Entry) => a.cost - b.cost

	it("returns lowest-cost entry first when duplicates exist", () => {
		const h = new BinaryHeap<Entry>(entryCmp)
		h.push({ id: 1, cost: 10 })
		h.push({ id: 1, cost: 5 }) // lower-cost update for same id
		h.push({ id: 2, cost: 7 })

		const first = h.pop()!
		expect(first.cost).toBe(5) // the updated entry
		const second = h.pop()!
		expect(second.cost).toBe(7)
		const third = h.pop()!
		expect(third.cost).toBe(10) // stale entry — caller skips this
	})
})

describe("BinaryHeap — generic comparator", () => {
	it("works as a max-heap with reversed comparator", () => {
		const maxCmp = (a: number, b: number) => b - a
		const h = new BinaryHeap<number>(maxCmp)
		h.push(3)
		h.push(1)
		h.push(8)
		h.push(5)
		expect(h.pop()).toBe(8)
		expect(h.pop()).toBe(5)
	})

	it("works with object comparator by string key", () => {
		interface Task {
			name: string
			priority: number
		}
		const cmp = (a: Task, b: Task) => a.priority - b.priority
		const h = new BinaryHeap<Task>(cmp)
		h.push({ name: "low", priority: 3 })
		h.push({ name: "high", priority: 1 })
		h.push({ name: "mid", priority: 2 })
		expect(h.pop()!.name).toBe("high")
		expect(h.pop()!.name).toBe("mid")
		expect(h.pop()!.name).toBe("low")
	})
})
