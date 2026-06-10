/**
 * Pointer → grid-cell hit test.
 *
 * Pure function: no DOM access, no React — safe to unit test in Node/jsdom.
 * The canvas component translates pointer events to cell indices using this helper.
 */

interface Rect {
	left: number
	top: number
	right: number
	bottom: number
}

/**
 * Map a client-space pointer position to a flat grid cell index.
 *
 * @param clientX  - Pointer X in client (viewport) coordinates.
 * @param clientY  - Pointer Y in client (viewport) coordinates.
 * @param rect     - Bounding rect of the canvas element (from getBoundingClientRect).
 * @param cols     - Number of columns in the grid.
 * @param cellSize - Width/height of each cell in CSS pixels.
 * @param rows     - Number of rows in the grid. Guards against floating-point
 *                   rounding pushing the computed row index past the bottom boundary.
 * @returns Flat cell index `row * cols + col`, or `-1` if the pointer is outside the canvas.
 */
export function cellAt(
	clientX: number,
	clientY: number,
	rect: Rect,
	cols: number,
	cellSize: number,
	rows: number
): number {
	const x = clientX - rect.left
	const y = clientY - rect.top

	// Out-of-bounds check
	if (x < 0 || y < 0 || x >= rect.right - rect.left || y >= rect.bottom - rect.top) {
		return -1
	}

	const col = Math.floor(x / cellSize)
	const row = Math.floor(y / cellSize)

	// Guard against floating-point edge at right boundary
	if (col >= cols) return -1
	// Guard against floating-point edge at bottom boundary
	if (row >= rows) return -1

	return row * cols + col
}
