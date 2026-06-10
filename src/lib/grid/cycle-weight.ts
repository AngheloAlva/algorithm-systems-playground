import { CELL, MAX_WEIGHT } from "./grid.types"
import type { Grid } from "./grid.types"
import { setWeight, index } from "./grid"

/**
 * Cycle the traversal weight of (row, col) through [1 → 2 → 3 → 4 → 5 → 1].
 *
 * Each invocation increments the weight by 1, wrapping back to 1 after MAX_WEIGHT.
 * This is the action used by the weight-brush on each tap during pointer interaction.
 *
 * No-op (returns the same grid reference) when:
 * - The cell is a wall (impassable; weight irrelevant)
 * - The cell is the start or end marker
 *
 * Pure function — returns a new Grid and never mutates the input.
 *
 * @see spec §5.2, PR4 task 5.1
 */
export function cycleWeight(g: Grid, row: number, col: number): Grid {
	const i = index(row, col, g.cols)
	const kind = g.cells[i]

	// No-op on wall, start, or end cells
	if (kind === CELL.WALL || kind === CELL.START || kind === CELL.END) {
		return g
	}

	const currentWeight = g.weights[i]
	const nextWeight = currentWeight >= MAX_WEIGHT ? 1 : currentWeight + 1
	return setWeight(g, row, col, nextWeight)
}
