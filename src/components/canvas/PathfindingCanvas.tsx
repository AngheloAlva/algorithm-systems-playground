"use client"

/**
 * PathfindingCanvas — two-layer canvas for pathfinding visualization.
 *
 * Composes two stacked CanvasLayer instances:
 *   1. STATIC layer: grid lines, walls, weights, start/end cells.
 *      Repainted only when `grid` changes (not on every animation frame).
 *   2. DYNAMIC layer: visited/frontier/path overlay.
 *      Cleared + redrawn every time `cursor` advances.
 *
 * Color tokens are read via `getComputedStyle` so they respond to theme changes
 * without hardcoded hex values (design §4, D12). A theme-change repaint is
 * triggered by subscribing to class mutations on <html> (next-themes applies
 * the "dark" class there).
 *
 * Pointer events translate clientX/Y to grid cell indices via the pure
 * `cellAt` hit-test and invoke callback props — no store access here (PR3
 * wires the callbacks to the store).
 *
 * @see design §4, D5, D12
 */

import { useRef, useEffect, useLayoutEffect, useCallback, useState } from "react"
import { CanvasLayer } from "./CanvasLayer"
import { cellAt } from "@/lib/grid/hit-test"
import { CELL, type Grid } from "@/lib/grid/grid.types"
import { STEP, type Step } from "@/lib/algorithms/pathfinding/types"
import { index as cellIndex } from "@/lib/grid/grid"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Color tokens for weight levels 2–5, ordered [w2, w3, w4, w5]. */
type WeightTokens = [string, string, string, string]

interface VizTokens {
	wall: string
	empty: string
	start: string
	end: string
	visited: string
	frontier: string
	path: string
	gridLine: string
	weight: WeightTokens
	/** Keyboard cursor dashed-border color. Distinct in light AND dark themes. */
	keyCursor: string
}

export interface PathfindingCanvasProps {
	/** Current grid state. Changing this triggers a static-layer repaint. */
	grid: Grid
	/** Animation trace from the last pathfinder run. */
	trace: Step[]
	/** Current animation cursor (index into `trace`). */
	cursor: number
	/** CSS pixels for each grid cell (determines canvas layout). */
	cellSize?: number
	/**
	 * Called when the user clicks/drags to paint/erase a cell.
	 * `isPointerDown` is true only on the initial pointerdown event (not on move),
	 * and ALSO when the keyboard Space key fires (keyboard actions are discrete).
	 * Returns a post-mutation announcement string (e.g. "wall", "empty",
	 * "weight 3") when called from the keyboard Space path; the canvas uses it
	 * to announce the actual post-edit state to screen readers.
	 * Returns undefined for pointer drag paths (no announcement needed).
	 */
	onCellClick?: (cellIndex: number, isPointerDown?: boolean) => string | undefined
	/** Called when the user drags the start endpoint to a new cell. */
	onStartDrag?: (cellIndex: number) => void
	/** Called when the user drags the end endpoint to a new cell. */
	onEndDrag?: (cellIndex: number) => void
	/**
	 * Called when the keyboard W key is pressed at the cursor position.
	 * Returns a post-mutation announcement string (e.g. "weight 2", "empty")
	 * derived from the store grid after the mutation, for screen-reader
	 * announcement. Returns undefined for paths that are no-ops.
	 */
	onWeightCycle?: (cellIndex: number) => string | undefined
	/** Extra className on the container div. */
	className?: string
}

// ---------------------------------------------------------------------------
// Token reading
// ---------------------------------------------------------------------------

/**
 * Read all --viz-* CSS custom properties from the given element.
 * Cached per render/theme-change — NOT called on every frame.
 */
function readVizTokens(el: HTMLElement): VizTokens {
	const s = getComputedStyle(el)
	const get = (name: string) => s.getPropertyValue(name).trim() || "#888"
	return {
		wall: get("--viz-wall"),
		empty: get("--viz-empty"),
		start: get("--viz-start"),
		end: get("--viz-end"),
		visited: get("--viz-visited"),
		frontier: get("--viz-frontier"),
		path: get("--viz-path"),
		gridLine: get("--viz-grid-line"),
		weight: [
			get("--viz-weight-2"),
			get("--viz-weight-3"),
			get("--viz-weight-4"),
			get("--viz-weight-5"),
		],
		keyCursor: get("--viz-key-cursor"),
	}
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

function drawStaticLayer(
	ctx: CanvasRenderingContext2D,
	grid: Grid,
	cellSize: number,
	tokens: VizTokens
) {
	const { rows, cols, cells, weights, start, end } = grid

	ctx.clearRect(0, 0, cols * cellSize, rows * cellSize)

	for (let i = 0; i < rows * cols; i++) {
		const r = Math.floor(i / cols)
		const c = i % cols
		const x = c * cellSize
		const y = r * cellSize
		const kind = cells[i]

		// Fill cell background
		let fill: string
		if (i === start) {
			fill = tokens.start
		} else if (i === end) {
			fill = tokens.end
		} else if (kind === CELL.WALL) {
			fill = tokens.wall
		} else {
			const w = weights[i]
			if (w >= 5) fill = tokens.weight[3]
			else if (w === 4) fill = tokens.weight[2]
			else if (w === 3) fill = tokens.weight[1]
			else if (w === 2) fill = tokens.weight[0]
			else fill = tokens.empty
		}

		ctx.fillStyle = fill
		ctx.fillRect(x, y, cellSize, cellSize)
	}

	// Draw grid lines on top
	ctx.strokeStyle = tokens.gridLine
	ctx.lineWidth = 0.5

	for (let r = 0; r <= rows; r++) {
		ctx.beginPath()
		ctx.moveTo(0, r * cellSize)
		ctx.lineTo(cols * cellSize, r * cellSize)
		ctx.stroke()
	}
	for (let c = 0; c <= cols; c++) {
		ctx.beginPath()
		ctx.moveTo(c * cellSize, 0)
		ctx.lineTo(c * cellSize, rows * cellSize)
		ctx.stroke()
	}
}

function drawDynamicLayer(
	ctx: CanvasRenderingContext2D,
	grid: Grid,
	trace: Step[],
	cursor: number,
	cellSize: number,
	tokens: VizTokens
) {
	const { rows, cols } = grid
	ctx.clearRect(0, 0, cols * cellSize, rows * cellSize)

	if (trace.length === 0 || cursor < 0) return

	const end = Math.min(cursor, trace.length - 1)
	for (let i = 0; i <= end; i++) {
		const step = trace[i]
		const cell = step.cell
		const r = Math.floor(cell / cols)
		const c = cell % cols
		const x = c * cellSize
		const y = r * cellSize

		let color: string
		switch (step.kind) {
			case STEP.VISIT:
				color = tokens.visited
				break
			case STEP.FRONTIER:
				color = tokens.frontier
				break
			case STEP.PATH:
				color = tokens.path
				break
			default:
				continue
		}

		ctx.globalAlpha = 0.75
		ctx.fillStyle = color
		ctx.fillRect(x, y, cellSize, cellSize)
		ctx.globalAlpha = 1
	}
}

/**
 * Draw a keyboard cursor indicator at (row, col).
 * Color is read from the --viz-key-cursor semantic token so it is visible
 * on both light and dark themes (FIX 3 -- no hardcoded rgba value).
 */
function drawKeyCursor(
	ctx: CanvasRenderingContext2D,
	row: number,
	col: number,
	cellSize: number,
	tokens: VizTokens
) {
	const x = col * cellSize
	const y = row * cellSize
	ctx.save()
	ctx.strokeStyle = tokens.keyCursor
	ctx.lineWidth = 2
	ctx.setLineDash([3, 3])
	ctx.strokeRect(x + 1, y + 1, cellSize - 2, cellSize - 2)
	ctx.restore()
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PathfindingCanvas({
	grid,
	trace,
	cursor,
	cellSize = 24,
	onCellClick,
	onStartDrag,
	onEndDrag,
	onWeightCycle,
	className,
}: PathfindingCanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const tokensRef = useRef<VizTokens | null>(null)

	// Incremented on theme change to force new draw-function identities on both
	// layers, which causes CanvasLayer (C1 fix) to trigger a repaint.
	const [themeVersion, setThemeVersion] = useState(0)

	// Track pointer drag state
	const isDraggingRef = useRef<"start" | "end" | "wall" | null>(null)

	// FIX 7 — track focus so keyboard cursor is only drawn when the container
	// has keyboard focus (hidden for mouse-only users).
	const [hasFocus, setHasFocus] = useState(false)

	// ---------------------------------------------------------------------------
	// Keyboard cursor state — row/col position of the keyboard focus cell
	//
	// FIX 1: Cursor position is stored in a ref AND mirrored to state.
	// Arrow handlers update the ref FIRST (synchronously), then mirror to state
	// for a repaint. Space/W read from the ref — never from closed-over state —
	// so an arrow press followed immediately by Space/W operates on the already-
	// moved cell, not the previous cell captured at useCallback creation.
	// ---------------------------------------------------------------------------
	/** Single state object so a grid-dimension reset is one setState call (avoids cascading-render lint rule). */
	const [keyCursorPos, setKeyCursorPos] = useState({ row: 0, col: 0 })
	const keyCursorRef = useRef({ row: 0, col: 0 })

	// FIX 5: text announced by the aria-live region on keyboard moves and edits
	const [liveRegionText, setLiveRegionText] = useState("")

	// Read (or re-read) tokens from the container element
	const getTokens = useCallback((): VizTokens => {
		const el = containerRef.current
		if (!el) {
			// Fallback neutral tokens for SSR / test environments
			return {
				wall: "#444",
				empty: "#f5f5f5",
				start: "#22c55e",
				end: "#ef4444",
				visited: "#60a5fa",
				frontier: "#fbbf24",
				path: "#6366f1",
				gridLine: "#e5e7eb",
				weight: ["#fef9c3", "#fef08a", "#fde047", "#facc15"],
				keyCursor: "#111",
			}
		}
		const tokens = readVizTokens(el)
		tokensRef.current = tokens
		return tokens
	}, [])

	// Static layer draw fn — re-created when grid or theme changes
	const drawStatic = useCallback(
		(ctx: CanvasRenderingContext2D) => {
			const tokens = getTokens()
			drawStaticLayer(ctx, grid, cellSize, tokens)
		},
		// themeVersion in deps ensures a new function identity after theme change,
		// causing CanvasLayer (C1) to repaint this layer with fresh color tokens.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[grid, cellSize, getTokens, themeVersion]
	)

	// Dynamic layer draw fn — re-created when trace/cursor or theme changes
	const drawDynamic = useCallback(
		(ctx: CanvasRenderingContext2D) => {
			const tokens = tokensRef.current ?? getTokens()
			drawDynamicLayer(ctx, grid, trace, cursor, cellSize, tokens)
			// FIX 7: Only draw keyboard cursor when the container has focus.
			// Hiding it when unfocused prevents confusing mouse-only users who
			// never move the keyboard cursor.
			if (hasFocus) {
				drawKeyCursor(ctx, keyCursorPos.row, keyCursorPos.col, cellSize, tokens)
			}
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[grid, trace, cursor, cellSize, getTokens, themeVersion, keyCursorPos, hasFocus]
	)

	// FIX 4 — Reset keyboard cursor when grid dimensions change (maze gen / reset).
	// Without this, the cursor can sit out-of-bounds after a smaller grid is loaded.
	// useLayoutEffect fires synchronously after DOM mutations; it is the correct
	// hook for resets that must be visible before the next paint.
	useLayoutEffect(() => {
		const origin = { row: 0, col: 0 }
		keyCursorRef.current = origin
		// eslint-disable-next-line react-hooks/set-state-in-effect
		setKeyCursorPos(origin)
	}, [grid.rows, grid.cols])

	// Subscribe to theme changes (next-themes toggles .dark on <html>)
	useEffect(() => {
		const html = document.documentElement
		const observer = new MutationObserver(() => {
			// Invalidate token cache and bump version to force new draw identities
			// on both layers so CanvasLayer (C1) triggers a repaint with fresh tokens.
			tokensRef.current = null
			setThemeVersion((v) => v + 1)
		})
		observer.observe(html, { attributes: true, attributeFilter: ["class"] })
		return () => observer.disconnect()
	}, [])

	// ---------------------------------------------------------------------------
	// Pointer handlers
	// ---------------------------------------------------------------------------

	const getCellFromEvent = useCallback(
		(e: React.PointerEvent<HTMLDivElement>): number => {
			const rect = containerRef.current?.getBoundingClientRect()
			if (!rect) return -1
			return cellAt(e.clientX, e.clientY, rect, grid.cols, cellSize, grid.rows)
		},
		[grid.cols, grid.rows, cellSize]
	)

	const handlePointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const cellIndex = getCellFromEvent(e)
			if (cellIndex === -1) return
			;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)

			const kind = grid.cells[cellIndex]
			if (kind === CELL.START) {
				isDraggingRef.current = "start"
			} else if (kind === CELL.END) {
				isDraggingRef.current = "end"
			} else {
				isDraggingRef.current = "wall"
				onCellClick?.(cellIndex, true)
			}
		},
		[getCellFromEvent, grid.cells, onCellClick]
	)

	const handlePointerMove = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (isDraggingRef.current === null) return
			const cellIndex = getCellFromEvent(e)
			if (cellIndex === -1) return

			switch (isDraggingRef.current) {
				case "start":
					onStartDrag?.(cellIndex)
					break
				case "end":
					onEndDrag?.(cellIndex)
					break
				case "wall":
					onCellClick?.(cellIndex)
					break
			}
		},
		[getCellFromEvent, onStartDrag, onEndDrag, onCellClick]
	)

	const handlePointerUp = useCallback(() => {
		isDraggingRef.current = null
	}, [])

	// ---------------------------------------------------------------------------
	// Keyboard handler — arrow key cursor navigation + Space/W interaction
	// ---------------------------------------------------------------------------

	/**
	 * Build a screen-reader announcement string for the current cursor position.
	 * Called after every arrow move and after Space/W edits (FIX 5).
	 */
	const announceCell = useCallback(
		(row: number, col: number) => {
			const { cols, cells, weights, start, end } = grid
			const i = cellIndex(row, col, cols)
			let cellDesc: string
			if (i === start) {
				cellDesc = "start"
			} else if (i === end) {
				cellDesc = "end"
			} else if (cells[i] === CELL.WALL) {
				cellDesc = "wall"
			} else {
				const w = weights[i]
				cellDesc = w > 1 ? `weight ${w}` : "empty"
			}
			setLiveRegionText(`Row ${row + 1}, column ${col + 1}: ${cellDesc}`)
		},
		[grid]
	)

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			const { rows, cols } = grid
			switch (e.key) {
				case "ArrowUp": {
					e.preventDefault()
					const nextRow = Math.max(0, keyCursorRef.current.row - 1)
					keyCursorRef.current.row = nextRow
					setKeyCursorPos((p) => ({ ...p, row: nextRow }))
					announceCell(nextRow, keyCursorRef.current.col)
					break
				}
				case "ArrowDown": {
					e.preventDefault()
					const nextRow = Math.min(rows - 1, keyCursorRef.current.row + 1)
					keyCursorRef.current.row = nextRow
					setKeyCursorPos((p) => ({ ...p, row: nextRow }))
					announceCell(nextRow, keyCursorRef.current.col)
					break
				}
				case "ArrowLeft": {
					e.preventDefault()
					const nextCol = Math.max(0, keyCursorRef.current.col - 1)
					keyCursorRef.current.col = nextCol
					setKeyCursorPos((p) => ({ ...p, col: nextCol }))
					announceCell(keyCursorRef.current.row, nextCol)
					break
				}
				case "ArrowRight": {
					e.preventDefault()
					const nextCol = Math.min(cols - 1, keyCursorRef.current.col + 1)
					keyCursorRef.current.col = nextCol
					setKeyCursorPos((p) => ({ ...p, col: nextCol }))
					announceCell(keyCursorRef.current.row, nextCol)
					break
				}
				case " ": {
					e.preventDefault()
					// Read from ref — always reflects the most recent arrow move even if
					// the state update has not propagated yet (FIX 1 stale closure).
					// Pass isPointerDown: true so keyboard Space is treated as a discrete
					// action — resets the pointer dedupe ref so WEIGHT brush advances even
					// if this cell was the last one painted by pointer (FIX 2).
					const spaceRow = keyCursorRef.current.row
					const spaceCol = keyCursorRef.current.col
					const spaceIdx = cellIndex(spaceRow, spaceCol, cols)
					const spaceDesc = onCellClick?.(spaceIdx, true)
					// Announce ACTUAL post-mutation state returned by the handler.
					// Handler derives the text from the store grid after mutation —
					// no prediction here, no duplicated brush semantics (FIX 1).
					if (spaceDesc !== undefined) {
						setLiveRegionText(`Row ${spaceRow + 1}, column ${spaceCol + 1}: ${spaceDesc}`)
					}
					break
				}
				case "w":
				case "W": {
					e.preventDefault()
					// Read from ref — same stale-closure fix as Space (FIX 1).
					const wRow = keyCursorRef.current.row
					const wCol = keyCursorRef.current.col
					const wIdx = cellIndex(wRow, wCol, cols)
					const wDesc = onWeightCycle?.(wIdx)
					// Announce ACTUAL post-mutation state returned by the handler (FIX 1).
					if (wDesc !== undefined) {
						setLiveRegionText(`Row ${wRow + 1}, column ${wCol + 1}: ${wDesc}`)
					}
					break
				}
				default:
					break
			}
		},
		[grid, onCellClick, onWeightCycle, announceCell]
	)

	// ---------------------------------------------------------------------------
	// Render
	// ---------------------------------------------------------------------------

	const canvasWidth = grid.cols * cellSize
	const canvasHeight = grid.rows * cellSize

	return (
		<>
			{/*
			 * FIX 3: live region rendered as a sibling of role="application", NOT a
			 * descendant. NVDA+Firefox (the most common AT combo) suppresses live
			 * regions inside application mode, so placing it outside is required for
			 * reliable announcements. Keyboard handling remains on the application div.
			 */}
			<span
				aria-live="polite"
				aria-atomic="true"
				className="sr-only"
			>
				{liveRegionText}
			</span>
			<div
				ref={containerRef}
				role="application"
				aria-label={`Pathfinding grid — ${grid.rows} rows × ${grid.cols} columns. Use arrow keys to move cursor, Space to edit cell with the active brush, W to cycle weight.`}
				tabIndex={0}
				className={className}
				style={{ position: "relative", width: canvasWidth, height: canvasHeight }}
				data-has-focus={hasFocus ? "true" : "false"}
				onFocus={() => setHasFocus(true)}
				onBlur={() => setHasFocus(false)}
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerLeave={handlePointerUp}
				onKeyDown={handleKeyDown}
			>
				<CanvasLayer draw={drawStatic} aria-hidden="true" />
				<CanvasLayer draw={drawDynamic} aria-hidden="true" />
			</div>
		</>
	)
}
