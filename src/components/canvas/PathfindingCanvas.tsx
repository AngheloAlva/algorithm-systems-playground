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

import { useRef, useEffect, useCallback, useState } from "react"
import { CanvasLayer } from "./CanvasLayer"
import { cellAt } from "@/lib/grid/hit-test"
import { CELL, type Grid } from "@/lib/grid/grid.types"
import { STEP, type Step } from "@/lib/algorithms/pathfinding/types"

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
	/** Called when the user clicks/drags to toggle a wall. */
	onCellClick?: (cellIndex: number) => void
	/** Called when the user drags the start endpoint to a new cell. */
	onStartDrag?: (cellIndex: number) => void
	/** Called when the user drags the end endpoint to a new cell. */
	onEndDrag?: (cellIndex: number) => void
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
	className,
}: PathfindingCanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const tokensRef = useRef<VizTokens | null>(null)

	// Incremented on theme change to force new draw-function identities on both
	// layers, which causes CanvasLayer (C1 fix) to trigger a repaint.
	const [themeVersion, setThemeVersion] = useState(0)

	// Track pointer drag state
	const isDraggingRef = useRef<"start" | "end" | "wall" | null>(null)

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
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[grid, trace, cursor, cellSize, getTokens, themeVersion]
	)

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
				onCellClick?.(cellIndex)
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
	// Render
	// ---------------------------------------------------------------------------

	const canvasWidth = grid.cols * cellSize
	const canvasHeight = grid.rows * cellSize

	return (
		<div
			ref={containerRef}
			className={className}
			style={{ position: "relative", width: canvasWidth, height: canvasHeight }}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerLeave={handlePointerUp}
		>
			<CanvasLayer draw={drawStatic} role="img" aria-label="Pathfinding grid" />
			<CanvasLayer draw={drawDynamic} aria-hidden="true" />
		</div>
	)
}
