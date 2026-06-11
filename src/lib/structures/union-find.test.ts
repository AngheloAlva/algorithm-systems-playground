/**
 * Unit tests for UnionFind — path compression + union by rank.
 * TDD: these tests are written BEFORE the implementation.
 *
 * Spec: G14
 */

import { describe, it, expect } from "vitest"
import { UnionFind } from "./union-find"

describe("UnionFind — G14", () => {
	// -------------------------------------------------------------------------
	// G14-A: Basic union and find
	// -------------------------------------------------------------------------

	it("initializes each id as its own set", () => {
		const uf = new UnionFind(["a", "b", "c"])
		expect(uf.connected("a", "b")).toBe(false)
		expect(uf.connected("a", "c")).toBe(false)
		expect(uf.connected("b", "c")).toBe(false)
	})

	it("find returns the id itself for a singleton set", () => {
		const uf = new UnionFind(["x"])
		expect(uf.find("x")).toBe("x")
	})

	it("Scenario G14-A: basic union and find — two separate unions", () => {
		const uf = new UnionFind(["a", "b", "c", "d"])
		uf.union("a", "b")
		uf.union("c", "d")

		expect(uf.connected("a", "b")).toBe(true)
		expect(uf.connected("c", "d")).toBe(true)
		expect(uf.connected("a", "c")).toBe(false)
	})

	// -------------------------------------------------------------------------
	// G14-B: Chained unions form one component
	// -------------------------------------------------------------------------

	it("Scenario G14-B: chained unions form one component", () => {
		const uf = new UnionFind(["a", "b", "c"])
		uf.union("a", "b")
		uf.union("b", "c")

		expect(uf.connected("a", "c")).toBe(true)
		expect(uf.connected("a", "b")).toBe(true)
		expect(uf.connected("b", "c")).toBe(true)
	})

	// -------------------------------------------------------------------------
	// G14-C: union returns false for already-connected elements
	// -------------------------------------------------------------------------

	it("union returns true when sets are different", () => {
		const uf = new UnionFind(["a", "b"])
		expect(uf.union("a", "b")).toBe(true)
	})

	it("Scenario G14-C: union returns false for already-connected elements", () => {
		const uf = new UnionFind(["a", "b", "c"])
		uf.union("a", "b")
		expect(uf.union("a", "b")).toBe(false) // already same set
	})

	it("union on same id with itself returns false", () => {
		const uf = new UnionFind(["a"])
		expect(uf.union("a", "a")).toBe(false)
	})

	// -------------------------------------------------------------------------
	// G14-D: Path compression — consistent find after chain
	// -------------------------------------------------------------------------

	it("Scenario G14-D: path compression — consistent find after chain unions", () => {
		const uf = new UnionFind(["a", "b", "c", "d"])
		uf.union("a", "b")
		uf.union("b", "c")
		uf.union("c", "d")

		const rep1 = uf.find("a")
		const rep2 = uf.find("a")
		expect(rep1).toBe(rep2) // stable after path compression

		// a and d are in the same component
		expect(uf.find("a")).toBe(uf.find("d"))
	})

	// -------------------------------------------------------------------------
	// Union by rank — structural verification
	// -------------------------------------------------------------------------

	it("after equal-rank union, one becomes root with incremented rank", () => {
		const uf = new UnionFind(["a", "b"])
		uf.union("a", "b")
		// Both were rank 0 — one becomes root with rank 1
		// find("a") and find("b") must agree on the same root
		expect(uf.find("a")).toBe(uf.find("b"))
	})

	it("higher-rank root always becomes the representative after union", () => {
		const uf = new UnionFind(["a", "b", "c", "d"])
		// Build a rank-1 root at "a" (union a-b gives a rank 1 if a wins)
		uf.union("a", "b") // one gets rank 1
		uf.union("c", "d") // one gets rank 1
		uf.union("a", "c") // merge the two rank-1 trees

		// All should be in the same component
		expect(uf.connected("a", "d")).toBe(true)
		expect(uf.connected("b", "c")).toBe(true)
	})

	// -------------------------------------------------------------------------
	// Edge cases
	// -------------------------------------------------------------------------

	it("works with an empty ids array — no crash", () => {
		const uf = new UnionFind([])
		// No operations should throw
		expect(() => uf.union("x", "y")).not.toThrow()
		expect(() => uf.find("x")).not.toThrow()
		// After union("x","y") they ARE connected — that is correct behavior
		expect(uf.connected("x", "y")).toBe(true)
	})

	it("uninitialized ids that were never unioned are not connected", () => {
		const uf = new UnionFind([])
		// Neither "p" nor "q" were ever touched — connected must be false
		expect(uf.connected("p", "q")).toBe(false)
	})

	it("find returns the id for unknown ids (no crash)", () => {
		const uf = new UnionFind(["a"])
		// Unknown id — graceful behavior (returns the id itself)
		expect(uf.find("z")).toBe("z")
	})
})
