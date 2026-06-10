"use client"

/**
 * GraphCanvas — two-layer canvas for the graph editor + visualizer.
 *
 * Composes two stacked CanvasLayer instances:
 *   1. STATIC layer: edges (lines + arrowheads + weight labels), nodes (circles + labels),
 *      selection ring, start-node ring. Repainted when graph/selection/startId/theme change.
 *   2. DYNAMIC layer: visited/frontier overlay, tree/back-edge coloring, rubber-band line.
 *      Repainted every time cursor advances or interaction changes.
 *
 * Color tokens read via getComputedStyle (design §4 CC6).
 * Theme changes trigger repaint via MutationObserver on <html>.
 *
 * Pointer handlers dispatch canvas-relative (x, y) to store actions.
 * Hit-testing is done inside the store (via nodeAt/edgeAt from hit-test.ts).
 *
 * @see design §4
 */

import { useRef, useEffect, useCallback, useState } from "react"
import { CanvasLayer } from "./CanvasLayer"
import { useGraphStore } from "@/store/graph-store"
import { useShallow } from "zustand/react/shallow"
import { readGraphVizTokens, type GraphVizTokens } from "@/lib/graph/tokens"
import { NODE_RADIUS, edgeAt, EDGE_THRESHOLD } from "@/lib/graph/hit-test"
import type { GraphData, GraphStep, GraphTraceResult } from "@/lib/graph/types"
import { EDIT_MODE } from "@/lib/graph/types"
import type { Interaction } from "@/store/graph-store"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphCanvasProps {
	className?: string
}

// ---------------------------------------------------------------------------
// Replay helper — pure function (testable separately)
// ---------------------------------------------------------------------------

export interface ReplayState {
	visited: Set<string>
	frontier: Set<string>
	treeEdges: Set<string>
	backEdges: Set<string>
	mstInclude: Set<string>
	mstReject: Set<string>
}

/**
 * Replays steps[0..cursor] and accumulates sets for each kind.
 * Pure function — no side effects.
 */
export function replayTo(trace: GraphTraceResult, cursor: number): ReplayState {
	const visited = new Set<string>()
	const frontier = new Set<string>()
	const treeEdges = new Set<string>()
	const backEdges = new Set<string>()
	const mstInclude = new Set<string>()
	const mstReject = new Set<string>()

	const end = Math.min(cursor, trace.steps.length - 1)
	for (let i = 0; i <= end; i++) {
		const step: GraphStep = trace.steps[i]
		switch (step.kind) {
			case "visit":
				visited.add(step.nodeId)
				frontier.delete(step.nodeId)
				break
			case "frontier":
				frontier.add(step.nodeId)
				break
			case "tree-edge":
				treeEdges.add(step.edgeId)
				break
			case "back-edge":
				backEdges.add(step.edgeId)
				break
			case "mst-include":
				mstInclude.add(step.edgeId)
				break
			case "mst-reject":
				mstReject.add(step.edgeId)
				break
		}
	}

	return { visited, frontier, treeEdges, backEdges, mstInclude, mstReject }
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

const ARROWHEAD_LENGTH = 12
const ARROWHEAD_ANGLE = Math.PI / 7

/**
 * Draw a line from (x1,y1) to (x2,y2) stopping R pixels before the end.
 * Optionally draws an arrowhead when `directed` is true.
 */
function drawEdgeLine(
	ctx: CanvasRenderingContext2D,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	directed: boolean,
	color: string,
	lineWidth = 1.5
) {
	const dx = x2 - x1
	const dy = y2 - y1
	const len = Math.sqrt(dx * dx + dy * dy)
	if (len < 1) return

	const ux = dx / len
	const uy = dy / len

	// Stop the line at the edge of the target circle
	const ex = x2 - ux * NODE_RADIUS
	const ey = y2 - uy * NODE_RADIUS

	ctx.beginPath()
	ctx.moveTo(x1 + ux * NODE_RADIUS, y1 + uy * NODE_RADIUS) // start at source circle edge
	ctx.lineTo(ex, ey)
	ctx.strokeStyle = color
	ctx.lineWidth = lineWidth
	ctx.stroke()

	if (directed) {
		// Arrowhead: two lines back from the endpoint
		ctx.beginPath()
		ctx.moveTo(ex, ey)
		ctx.lineTo(
			ex - ARROWHEAD_LENGTH * Math.cos(Math.atan2(dy, dx) - ARROWHEAD_ANGLE),
			ey - ARROWHEAD_LENGTH * Math.sin(Math.atan2(dy, dx) - ARROWHEAD_ANGLE)
		)
		ctx.moveTo(ex, ey)
		ctx.lineTo(
			ex - ARROWHEAD_LENGTH * Math.cos(Math.atan2(dy, dx) + ARROWHEAD_ANGLE),
			ey - ARROWHEAD_LENGTH * Math.sin(Math.atan2(dy, dx) + ARROWHEAD_ANGLE)
		)
		ctx.strokeStyle = color
		ctx.lineWidth = lineWidth
		ctx.stroke()
	}
}

/** Draw a filled node circle with centered label. */
function drawNode(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	label: string,
	fill: string,
	labelColor: string,
	ringColor?: string
) {
	ctx.beginPath()
	ctx.arc(x, y, NODE_RADIUS, 0, Math.PI * 2)
	ctx.fillStyle = fill
	ctx.fill()

	if (ringColor) {
		ctx.strokeStyle = ringColor
		ctx.lineWidth = 3
		ctx.stroke()
	}

	ctx.fillStyle = labelColor
	ctx.font = "bold 11px system-ui, sans-serif"
	ctx.textAlign = "center"
	ctx.textBaseline = "middle"
	ctx.fillText(label, x, y)
}

/** Draw weight label at edge midpoint with a background rect for legibility. */
function drawWeightLabel(
	ctx: CanvasRenderingContext2D,
	mx: number,
	my: number,
	weight: number,
	bgColor: string
) {
	const text = String(weight)
	ctx.font = "10px system-ui, sans-serif"
	ctx.textAlign = "center"
	ctx.textBaseline = "middle"
	const metrics = ctx.measureText(text)
	const pad = 2
	const bw = metrics.width + pad * 2
	const bh = 12

	ctx.fillStyle = bgColor
	ctx.fillRect(mx - bw / 2, my - bh / 2, bw, bh)
	ctx.fillStyle = "#555"
	ctx.fillText(text, mx, my)
}

// ---------------------------------------------------------------------------
// Static layer draw function
// ---------------------------------------------------------------------------

function drawStaticLayer(
	ctx: CanvasRenderingContext2D,
	graph: GraphData,
	selection: { kind: "node" | "edge"; id: string } | null,
	startId: string | null,
	tokens: GraphVizTokens
) {
	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

	// 1. Draw edges (behind nodes)
	for (const edge of graph.edges.values()) {
		const src = graph.nodes.get(edge.source)
		const tgt = graph.nodes.get(edge.target)
		if (!src || !tgt) continue

		const isSelected = selection?.kind === "edge" && selection.id === edge.id
		const color = isSelected ? tokens.nodeSelected : tokens.edge

		drawEdgeLine(ctx, src.x, src.y, tgt.x, tgt.y, graph.directed, color, isSelected ? 2.5 : 1.5)

		// Weight label at midpoint
		const mx = (src.x + tgt.x) / 2
		const my = (src.y + tgt.y) / 2
		drawWeightLabel(ctx, mx, my, edge.weight, tokens.edgeWeightBg)
	}

	// 2. Draw nodes (on top of edges)
	for (const node of graph.nodes.values()) {
		const isSelected = selection?.kind === "node" && selection.id === node.id
		const isStart = startId === node.id

		const fill = isStart ? tokens.nodeStart : tokens.node
		const ringColor = isSelected ? tokens.nodeSelected : isStart ? tokens.nodeStart : undefined

		drawNode(ctx, node.x, node.y, node.label, fill, tokens.nodeLabel, ringColor)
	}
}

// ---------------------------------------------------------------------------
// Dynamic layer draw function
// ---------------------------------------------------------------------------

function drawDynamicLayer(
	ctx: CanvasRenderingContext2D,
	graph: GraphData,
	result: GraphTraceResult | null,
	cursor: number,
	interaction: Interaction,
	tokens: GraphVizTokens
) {
	ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

	if (result && result.steps.length > 0) {
		const replay = replayTo(result, cursor)

		// Overlay visited/frontier node fills
		for (const node of graph.nodes.values()) {
			if (replay.visited.has(node.id)) {
				ctx.beginPath()
				ctx.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2)
				ctx.fillStyle = tokens.nodeVisited
				ctx.globalAlpha = 0.8
				ctx.fill()
				ctx.globalAlpha = 1
			} else if (replay.frontier.has(node.id)) {
				ctx.beginPath()
				ctx.arc(node.x, node.y, NODE_RADIUS, 0, Math.PI * 2)
				ctx.fillStyle = tokens.nodeFrontier
				ctx.globalAlpha = 0.8
				ctx.fill()
				ctx.globalAlpha = 1
			}
		}

		// Overlay tree/back/mst edge coloring
		for (const edge of graph.edges.values()) {
			const src = graph.nodes.get(edge.source)
			const tgt = graph.nodes.get(edge.target)
			if (!src || !tgt) continue

			let edgeColor: string | null = null
			if (replay.treeEdges.has(edge.id)) {
				edgeColor = tokens.edgeTree
			} else if (replay.backEdges.has(edge.id)) {
				edgeColor = tokens.edgeBack
			} else if (replay.mstInclude.has(edge.id)) {
				edgeColor = tokens.edgeMst
			} else if (replay.mstReject.has(edge.id)) {
				edgeColor = tokens.edgeMstReject
			}

			if (edgeColor) {
				drawEdgeLine(ctx, src.x, src.y, tgt.x, tgt.y, graph.directed, edgeColor, 3)
			}
		}
	}

	// Rubber-band line (ADD_EDGE gesture in progress)
	if (interaction.kind === "linking") {
		const sourceNode = graph.nodes.get(interaction.sourceId)
		if (sourceNode) {
			ctx.beginPath()
			ctx.moveTo(sourceNode.x, sourceNode.y)
			ctx.lineTo(interaction.x, interaction.y)
			ctx.strokeStyle = tokens.nodeFrontier
			ctx.lineWidth = 2
			ctx.setLineDash([6, 4])
			ctx.stroke()
			ctx.setLineDash([])
		}
	}
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GraphCanvas({ className }: GraphCanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const tokensRef = useRef<GraphVizTokens | null>(null)
	const [themeVersion, setThemeVersion] = useState(0)

	// Weight-edit state (inline input on double-click in SELECT mode)
	const [weightEdit, setWeightEdit] = useState<{
		edgeId: string
		x: number
		y: number
		value: string
	} | null>(null)

	// Read store state
	const { graph, selection, startId, result, cursor, interaction, editMode } = useGraphStore(
		useShallow((s) => ({
			graph: s.graph,
			selection: s.selection,
			startId: s.startId,
			result: s.result,
			cursor: s.cursor,
			interaction: s.interaction,
			editMode: s.editMode,
		}))
	)

	const storeHandleDown = useGraphStore((s) => s.handleCanvasPointerDown)
	const storeHandleMove = useGraphStore((s) => s.handleCanvasPointerMove)
	const storeHandleUp = useGraphStore((s) => s.handleCanvasPointerUp)
	const storeSetEdgeWeight = useGraphStore((s) => s.setEdgeWeight)

	// Read (or re-read) tokens from the container element
	const getTokens = useCallback((): GraphVizTokens => {
		const el = containerRef.current
		if (!el) {
			return readGraphVizTokens(document.documentElement)
		}
		const tokens = readGraphVizTokens(el)
		tokensRef.current = tokens
		return tokens
	}, [])

	// Subscribe to theme changes
	useEffect(() => {
		const html = document.documentElement
		const observer = new MutationObserver(() => {
			tokensRef.current = null
			setThemeVersion((v) => v + 1)
		})
		observer.observe(html, { attributes: true, attributeFilter: ["class"] })
		return () => observer.disconnect()
	}, [])

	// Static layer: edges + nodes + selection/start rings
	const drawStatic = useCallback(
		(ctx: CanvasRenderingContext2D) => {
			const tokens = getTokens()
			drawStaticLayer(ctx, graph, selection, startId, tokens)
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[graph, selection, startId, getTokens, themeVersion]
	)

	// Dynamic layer: overlay + rubber-band
	const drawDynamic = useCallback(
		(ctx: CanvasRenderingContext2D) => {
			const tokens = tokensRef.current ?? getTokens()
			drawDynamicLayer(ctx, graph, result, cursor, interaction, tokens)
		},
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[graph, result, cursor, interaction, getTokens, themeVersion]
	)

	// Convert client coords to canvas-local coords
	const toCanvasCoords = useCallback((clientX: number, clientY: number): [number, number] => {
		const rect = containerRef.current?.getBoundingClientRect()
		if (!rect) return [0, 0]
		return [clientX - rect.left, clientY - rect.top]
	}, [])

	// ---------------------------------------------------------------------------
	// Pointer handlers
	// ---------------------------------------------------------------------------

	const handlePointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (e.button !== 0) return
			const [x, y] = toCanvasCoords(e.clientX, e.clientY)
			// Only capture for drag gestures (MOVE_NODE, ADD_EDGE) to avoid
			// swallowing clicks in non-drag modes (SELECT, ADD_NODE, DELETE, SET_START).
			if (editMode === EDIT_MODE.MOVE_NODE || editMode === EDIT_MODE.ADD_EDGE) {
				;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
			}
			storeHandleDown(x, y)
		},
		[toCanvasCoords, storeHandleDown, editMode]
	)

	const handlePointerMove = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const [x, y] = toCanvasCoords(e.clientX, e.clientY)
			storeHandleMove(x, y)
		},
		[toCanvasCoords, storeHandleMove]
	)

	const handlePointerUp = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const [x, y] = toCanvasCoords(e.clientX, e.clientY)
			// Explicitly release capture if it was acquired (guard with hasPointerCapture)
			const target = e.currentTarget as HTMLDivElement
			if (target.hasPointerCapture(e.pointerId)) {
				target.releasePointerCapture(e.pointerId)
			}
			storeHandleUp(x, y)
		},
		[toCanvasCoords, storeHandleUp]
	)

	const handlePointerCancel = useCallback(() => {
		// Cancel any pending gesture on pointer cancel/leave
		const { interaction: current } = useGraphStore.getState()
		if (current.kind === "linking") {
			useGraphStore.getState().endLink(null)
		} else if (current.kind === "moving") {
			useGraphStore.getState().endMove()
		}
	}, [])

	// Double-click: open weight editor in SELECT mode
	const handleDoubleClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (editMode !== EDIT_MODE.SELECT) return
			const [x, y] = toCanvasCoords(e.clientX, e.clientY)
			const { graph: g } = useGraphStore.getState()
			const hitEdgeId = edgeAt(x, y, g.edges, g.nodes, EDGE_THRESHOLD)
			if (!hitEdgeId) return

			const edge = g.edges.get(hitEdgeId)
			const src = edge ? g.nodes.get(edge.source) : null
			const tgt = edge ? g.nodes.get(edge.target) : null
			if (!edge || !src || !tgt) return

			const mx = (src.x + tgt.x) / 2
			const my = (src.y + tgt.y) / 2
			setWeightEdit({ edgeId: hitEdgeId, x: mx, y: my, value: String(edge.weight) })
		},
		[editMode, toCanvasCoords]
	)

	// Escape: cancel weight edit or any pending gesture
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			if (e.key === "Escape") {
				setWeightEdit(null)
				handlePointerCancel()
			}
		},
		[handlePointerCancel]
	)

	// Commit weight edit
	const commitWeightEdit = useCallback(() => {
		if (!weightEdit) return
		const w = Number(weightEdit.value)
		if (w > 0) {
			storeSetEdgeWeight(weightEdit.edgeId, w)
		}
		setWeightEdit(null)
	}, [weightEdit, storeSetEdgeWeight])

	return (
		<div
			ref={containerRef}
			className={`relative h-full w-full overflow-hidden ${className ?? ""}`}
			role="application"
			aria-label="Graph editor canvas. Use toolbar to switch edit modes. Click to add nodes and edges."
			tabIndex={0}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerCancel}
			onPointerLeave={handlePointerCancel}
			onDoubleClick={handleDoubleClick}
			onKeyDown={handleKeyDown}
		>
			{/* Static layer: topology */}
			<CanvasLayer draw={drawStatic} aria-hidden="true" />
			{/* Dynamic layer: overlay + rubber-band */}
			<CanvasLayer draw={drawDynamic} aria-hidden="true" />

			{/* Inline weight editor (positioned at edge midpoint, absolute inside relative container) */}
			{weightEdit && (
				<input
					type="number"
					min={1}
					step={1}
					value={weightEdit.value}
					onChange={(e) => setWeightEdit((prev) => prev && { ...prev, value: e.target.value })}
					onBlur={commitWeightEdit}
					onKeyDown={(e) => {
						if (e.key === "Enter") commitWeightEdit()
						if (e.key === "Escape") setWeightEdit(null)
						e.stopPropagation()
					}}
					// biome-ignore lint/a11y/noAutofocus: weight editor needs focus for immediate keyboard entry
					autoFocus
					aria-label="Edge weight"
					className="border-border bg-card text-foreground absolute z-10 w-14 rounded border px-1 py-0.5 text-center text-sm shadow-sm"
					style={{
						left: weightEdit.x - 28,
						top: weightEdit.y - 12,
					}}
				/>
			)}
		</div>
	)
}
