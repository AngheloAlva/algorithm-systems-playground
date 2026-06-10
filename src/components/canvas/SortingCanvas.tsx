"use client"

/**
 * SortingCanvas — bar chart renderer for the sorting visualizer.
 *
 * Composes a single CanvasLayer instance (display-only, no pointer interaction).
 * Renders each array element as a vertical bar with height proportional to its
 * value relative to max(arr). Colors come from --viz-* semantic tokens read
 * via getComputedStyle (same pattern as PathfindingCanvas).
 *
 * ## Color coding (spec §4.1)
 * - Default bar color: --viz-visited
 * - COMPARE indices: --viz-frontier
 * - SWAP indices: --viz-path
 * - PLACE indices: --viz-end
 *
 * ## Repaint contract
 * Repaints on every change to arr or currentStep via the draw callback prop
 * passed to CanvasLayer. Theme changes trigger a repaint via themeVersion state.
 *
 * ## Accessibility
 * role="img" + aria-label on the CanvasLayer. An aria-live region for status
 * is rendered by SortingVisualizer (outside role="img"), not here.
 *
 * @see spec §4, §8
 */

import { useRef, useEffect, useState, useCallback } from "react"
import { CanvasLayer } from "./CanvasLayer"
import type { SortStep } from "@/lib/algorithms/sorting/types"
import { SORT_STEP_KIND } from "@/lib/algorithms/sorting/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SortingCanvasProps {
	/** Current array to visualize. Repaints when this changes. */
	arr: ReadonlyArray<number>
	/** Current step in the trace (null when idle or done). */
	currentStep: SortStep | null
	/** Animation status string — used for aria-label. */
	status: string
	/** Additional className on the container div. */
	className?: string
}

// ---------------------------------------------------------------------------
// Token reading
// ---------------------------------------------------------------------------

interface SortVizTokens {
	bar: string
	compare: string
	swap: string
	place: string
}

/** Read sorting bar color tokens from the given element. */
function readSortVizTokens(el: HTMLElement): SortVizTokens {
	const s = getComputedStyle(el)
	const get = (name: string) => s.getPropertyValue(name).trim() || "#888"
	return {
		// Default bar: --viz-visited (reuse per spec §4.1)
		bar: get("--viz-visited"),
		// COMPARE: --viz-frontier
		compare: get("--viz-frontier"),
		// SWAP: --viz-path
		swap: get("--viz-path"),
		// PLACE: --viz-end
		place: get("--viz-end"),
	}
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

const MIN_BAR_WIDTH = 2

function drawBars(
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	arr: ReadonlyArray<number>,
	currentStep: SortStep | null,
	tokens: SortVizTokens
) {
	ctx.clearRect(0, 0, width, height)

	const n = arr.length
	if (n === 0) return

	const maxVal = Math.max(...arr)
	if (maxVal === 0) return

	// Compute bar width and gap
	// Minimum bar width is MIN_BAR_WIDTH; below that, gap collapses to 0
	const totalWidth = width
	// Try with 1px gap between bars
	let barWidth = Math.floor((totalWidth - (n - 1)) / n)
	let gap = 1
	if (barWidth < MIN_BAR_WIDTH) {
		// Gap collapses to 0
		barWidth = Math.max(MIN_BAR_WIDTH, Math.floor(totalWidth / n))
		gap = 0
	}

	// Build a set of highlighted indices for O(1) lookup
	const highlightedSet = new Set<number>(currentStep?.indices ?? [])

	// Determine highlight color from step kind
	let highlightColor = tokens.compare
	if (currentStep) {
		switch (currentStep.kind) {
			case SORT_STEP_KIND.COMPARE:
				highlightColor = tokens.compare
				break
			case SORT_STEP_KIND.SWAP:
				highlightColor = tokens.swap
				break
			case SORT_STEP_KIND.PLACE:
				highlightColor = tokens.place
				break
			default:
				highlightColor = tokens.bar
		}
	}

	for (let i = 0; i < n; i++) {
		const barHeight = Math.max(1, Math.floor((arr[i] / maxVal) * height))
		const x = i * (barWidth + gap)
		const y = height - barHeight

		ctx.fillStyle = highlightedSet.has(i) ? highlightColor : tokens.bar
		ctx.fillRect(x, y, barWidth, barHeight)
	}
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SortingCanvas({ arr, currentStep, status, className }: SortingCanvasProps) {
	const containerRef = useRef<HTMLDivElement>(null)
	const tokensRef = useRef<SortVizTokens | null>(null)

	// Bump on theme change to invalidate token cache and force repaint
	const [themeVersion, setThemeVersion] = useState(0)

	// Subscribe to theme changes (next-themes toggles .dark on <html>)
	useEffect(() => {
		const html = document.documentElement
		const observer = new MutationObserver(() => {
			tokensRef.current = null
			setThemeVersion((v) => v + 1)
		})
		observer.observe(html, { attributes: true, attributeFilter: ["class"] })
		return () => observer.disconnect()
	}, [])

	const getTokens = useCallback((): SortVizTokens => {
		const el = containerRef.current
		if (!el) {
			return {
				bar: "#60a5fa",
				compare: "#fbbf24",
				swap: "#6366f1",
				place: "#ef4444",
			}
		}
		const tokens = readSortVizTokens(el)
		tokensRef.current = tokens
		return tokens
	}, [])

	// Draw fn — re-created when arr, currentStep, or theme changes
	const draw = useCallback(
		(ctx: CanvasRenderingContext2D, size: { width: number; height: number }) => {
			const tokens = tokensRef.current ?? getTokens()
			drawBars(ctx, size.width, size.height, arr, currentStep, tokens)
		},
		// themeVersion in deps ensures new function identity after theme change
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[arr, currentStep, getTokens, themeVersion]
	)

	// Compute accessible label from status and arr info
	const ariaLabel = `Sorting visualization: ${arr.length}-element array, ${status}`

	return (
		<div
			ref={containerRef}
			className={className}
			style={{ position: "relative" }}
		>
			<CanvasLayer
				draw={draw}
				role="img"
				aria-label={ariaLabel}
			/>
		</div>
	)
}
