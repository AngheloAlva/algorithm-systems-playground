"use client"

/**
 * CanvasLayer — generic DPR-aware canvas primitive.
 *
 * Owns a single <canvas> element. Handles:
 *  - devicePixelRatio scaling so the canvas is crisp on HiDPI screens.
 *  - ResizeObserver-driven resize: when the container changes size the canvas
 *    physical dimensions are updated and `draw` is called again.
 *  - Exposes a `draw(ctx, size)` callback prop — no pathfinding awareness.
 *
 * Designed for composition: PathfindingCanvas stacks two CanvasLayers
 * (static grid layer + dynamic overlay layer) in a relative container.
 *
 * @see design §4, D5
 */

import { useRef, useEffect, useLayoutEffect } from "react"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CanvasSize {
	/** CSS width in logical pixels. */
	width: number
	/** CSS height in logical pixels. */
	height: number
}

export interface CanvasLayerProps {
	/**
	 * Draw callback invoked whenever the canvas needs to be repainted.
	 * The context is already scaled for DPR — draw in CSS pixel units.
	 */
	"draw": (ctx: CanvasRenderingContext2D, size: CanvasSize) => void
	/** Additional className on the <canvas> element. */
	"className"?: string
	/** aria-label for accessibility (optional). */
	"aria-label"?: string
	/** role override (optional). */
	"role"?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CanvasLayer({ draw, className, ...ariaProps }: CanvasLayerProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null)
	// Keep draw in a ref so ResizeObserver closure always sees the latest version
	const drawRef = useRef(draw)
	// Sync draw ref before browser paint so ResizeObserver callbacks are current
	useLayoutEffect(() => {
		drawRef.current = draw
	})

	// Extracted so both the draw-change effect and the resize observer can call it
	const applyDrawRef = useRef<() => void>(() => {})

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		applyDrawRef.current = () => {
			const ctx = canvas.getContext("2d")
			if (!ctx) return

			const dpr = window.devicePixelRatio || 1
			const cssW = canvas.clientWidth
			const cssH = canvas.clientHeight

			// S1: guard zero-size draws
			if (cssW === 0 || cssH === 0) return

			// Only reallocate backing store when dimensions change (avoids clearing on every draw)
			if (canvas.width !== Math.round(cssW * dpr) || canvas.height !== Math.round(cssH * dpr)) {
				canvas.width = Math.round(cssW * dpr)
				canvas.height = Math.round(cssH * dpr)
			}

			// W1: always set transform explicitly so any external reset is corrected
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

			drawRef.current(ctx, { width: cssW, height: cssH })
		}

		const observer = new ResizeObserver(() => {
			applyDrawRef.current()
		})

		observer.observe(canvas)

		// Initial draw
		applyDrawRef.current()

		return () => {
			observer.disconnect()
		}
	}, [])

	// C1: repaint whenever draw identity changes (dynamic overlay updates)
	useEffect(() => {
		applyDrawRef.current()
	}, [draw])

	return (
		<canvas
			ref={canvasRef}
			className={cn("absolute inset-0 h-full w-full", className)}
			{...ariaProps}
		/>
	)
}
