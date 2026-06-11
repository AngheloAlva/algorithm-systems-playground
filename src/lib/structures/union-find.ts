/**
 * Union-Find (Disjoint Set Union) with path compression and union by rank.
 *
 * Designed for use with graph node ids (strings).
 * Used by Kruskal's MST algorithm.
 *
 * Time complexity:
 *   find   — amortized O(α(n)) with path compression
 *   union  — amortized O(α(n)) with union by rank
 *   connected — same as two find calls
 *
 * ## No React / DOM imports
 *
 * @see design §7
 */

export class UnionFind {
	private readonly parent = new Map<string, string>()
	private readonly rank = new Map<string, number>()

	/**
	 * Initialize one set per id.
	 * @param ids — the ids to track (typically graph node ids).
	 */
	constructor(ids: string[]) {
		for (const id of ids) {
			this.makeSet(id)
		}
	}

	/**
	 * Idempotent — adds id to its own set if not already tracked.
	 */
	makeSet(id: string): void {
		if (!this.parent.has(id)) {
			this.parent.set(id, id)
			this.rank.set(id, 0)
		}
	}

	/**
	 * Returns the canonical representative (root) of the set containing id.
	 * Applies path compression: every node along the path is pointed directly at the root.
	 * If id is unknown, returns id itself (graceful, no crash).
	 */
	find(id: string): string {
		// Unknown id — initialize on the fly and return itself
		if (!this.parent.has(id)) {
			return id
		}

		// Path compression: iterative (avoids recursion depth issues on long chains)
		let root = id
		while (this.parent.get(root) !== root) {
			root = this.parent.get(root)!
		}

		// Two-pass: point all nodes on the path directly to the root
		let current = id
		while (current !== root) {
			const next = this.parent.get(current)!
			this.parent.set(current, root)
			current = next
		}

		return root
	}

	/**
	 * Merges the sets containing a and b.
	 * Uses union by rank: the smaller-rank tree attaches under the larger-rank root.
	 * If ranks are equal, a is attached under b and b's rank is incremented.
	 *
	 * @returns true if the sets were different (a merge happened); false if already connected.
	 */
	union(a: string, b: string): boolean {
		// Initialize unknown ids gracefully
		this.makeSet(a)
		this.makeSet(b)

		const rootA = this.find(a)
		const rootB = this.find(b)

		if (rootA === rootB) {
			return false // already in the same set
		}

		const rankA = this.rank.get(rootA) ?? 0
		const rankB = this.rank.get(rootB) ?? 0

		if (rankA < rankB) {
			// rootA attaches under rootB
			this.parent.set(rootA, rootB)
		} else if (rankA > rankB) {
			// rootB attaches under rootA
			this.parent.set(rootB, rootA)
		} else {
			// Equal rank: rootA attaches under rootB; rootB gains rank
			this.parent.set(rootA, rootB)
			this.rank.set(rootB, rankB + 1)
		}

		return true
	}

	/**
	 * Returns true if a and b are in the same set.
	 */
	connected(a: string, b: string): boolean {
		if (!this.parent.has(a) || !this.parent.has(b)) {
			return false
		}
		return this.find(a) === this.find(b)
	}
}
