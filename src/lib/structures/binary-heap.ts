/**
 * Generic binary min-heap (from scratch, TDD-first).
 *
 * Implementation strategy: push-duplicates + skip-stale on pop.
 * This avoids the complexity of decrease-key while remaining correct for
 * Dijkstra and A* (the caller discards stale pops by checking a visited set).
 *
 * Time complexity: push O(log n), pop O(log n), peek O(1).
 */
export class BinaryHeap<T> {
	private readonly data: T[] = []
	private readonly compare: (a: T, b: T) => number

	constructor(compare: (a: T, b: T) => number) {
		this.compare = compare
	}

	/** Number of elements in the heap. */
	size(): number {
		return this.data.length
	}

	/** Return the minimum element without removing it. O(1). */
	peek(): T | undefined {
		return this.data[0]
	}

	/** Insert an element into the heap. O(log n). */
	push(item: T): void {
		this.data.push(item)
		this.siftUp(this.data.length - 1)
	}

	/** Remove and return the minimum element. Returns undefined if empty. O(log n). */
	pop(): T | undefined {
		if (this.data.length === 0) return undefined
		const min = this.data[0]
		const last = this.data.pop()!
		if (this.data.length > 0) {
			this.data[0] = last
			this.siftDown(0)
		}
		return min
	}

	// ---------------------------------------------------------------------------
	// Internal heap operations
	// ---------------------------------------------------------------------------

	private siftUp(i: number): void {
		while (i > 0) {
			const parent = (i - 1) >> 1
			if (this.compare(this.data[i], this.data[parent]) < 0) {
				this.swap(i, parent)
				i = parent
			} else {
				break
			}
		}
	}

	private siftDown(i: number): void {
		const n = this.data.length
		while (true) {
			let smallest = i
			const left = 2 * i + 1
			const right = 2 * i + 2

			if (left < n && this.compare(this.data[left], this.data[smallest]) < 0) {
				smallest = left
			}
			if (right < n && this.compare(this.data[right], this.data[smallest]) < 0) {
				smallest = right
			}

			if (smallest === i) break
			this.swap(i, smallest)
			i = smallest
		}
	}

	private swap(a: number, b: number): void {
		const tmp = this.data[a]
		this.data[a] = this.data[b]
		this.data[b] = tmp
	}
}
