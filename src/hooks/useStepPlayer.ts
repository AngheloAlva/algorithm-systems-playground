"use client"

/**
 * useStepPlayer — generic rAF-driven animation cursor hook.
 *
 * Trace-agnostic: the hook operates on `length` (trace.length) and reports
 * cursor positions via `onAdvance`. It does NOT hold or read the trace itself
 * — that data lives in the store or component that owns the trace. This keeps
 * the hook reusable across pathfinding, sorting, and any future step-based
 * animation (design §3, D11).
 *
 * Speed model: time accumulator (design §3, D4).
 *   - Each rAF frame provides elapsed ms since the last frame.
 *   - `advance(acc, elapsedMs, 1, msPerStep)` computes whole steps and carry-over.
 *   - Decoupled from monitor refresh rate: correct on 60/120/144Hz.
 */

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react"
import { advance } from "@/lib/animation/stepper"
import { getMsPerStep } from "@/lib/animation/speed-config"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const PLAYER_STATUS = {
	IDLE: "idle",
	PLAYING: "playing",
	PAUSED: "paused",
	DONE: "done",
} as const

export type PlayerStatus = (typeof PLAYER_STATUS)[keyof typeof PLAYER_STATUS]

export interface UseStepPlayerOptions {
	/** Total number of steps (trace.length). 0 = nothing to play. */
	length: number
	/** Discrete speed level (1–8). Resolved to ms/step via SPEED_MAP. */
	speed: number
	/**
	 * Called each frame (or manual step) with the new cursor position.
	 * Cursor is 0-indexed; valid range is [0, length - 1].
	 * Not called when length === 0.
	 */
	onAdvance: (cursor: number) => void
}

export interface UseStepPlayerReturn {
	status: PlayerStatus
	cursor: number
	play: () => void
	pause: () => void
	/** Advance exactly one step (pauses first if playing). */
	step: () => void
	reset: () => void
	/** Jump directly to a cursor position. Pauses first if playing. */
	seek: (cursor: number) => void
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStepPlayer({
	length,
	speed,
	onAdvance,
}: UseStepPlayerOptions): UseStepPlayerReturn {
	const [cursor, setCursor] = useState(0)
	const [status, setStatus] = useState<PlayerStatus>(PLAYER_STATUS.IDLE)

	// Mutable refs — shared with the rAF loop closure
	const rafRef = useRef<number | null>(null)
	const lastTimeRef = useRef<number | null>(null)
	const accRef = useRef<number>(0)
	const cursorRef = useRef<number>(0)
	const statusRef = useRef<PlayerStatus>(PLAYER_STATUS.IDLE)
	const lengthRef = useRef<number>(length)
	const speedRef = useRef<number>(speed)
	const onAdvanceRef = useRef<(cursor: number) => void>(onAdvance)

	// Keep prop refs current after each render (runs before browser paint).
	// Using useLayoutEffect avoids the "ref access during render" lint error.
	useLayoutEffect(() => {
		lengthRef.current = length
		speedRef.current = speed
		onAdvanceRef.current = onAdvance
	})

	// ---------------------------------------------------------------------------
	// Internal state helpers
	// ---------------------------------------------------------------------------

	const syncCursor = useCallback((newCursor: number) => {
		cursorRef.current = newCursor
		setCursor(newCursor)
	}, [])

	const syncStatus = useCallback((newStatus: PlayerStatus) => {
		statusRef.current = newStatus
		setStatus(newStatus)
	}, [])

	// Cancel any in-flight rAF and reset timing state
	const cancelRaf = useCallback(() => {
		if (rafRef.current !== null) {
			cancelAnimationFrame(rafRef.current)
			rafRef.current = null
		}
		lastTimeRef.current = null
		accRef.current = 0
	}, [])

	// ---------------------------------------------------------------------------
	// rAF loop
	// The tick fn is stored in a ref so it can reference itself recursively
	// without creating a circular useCallback dependency (which would cause a
	// lint error from the React hooks/immutability rule).
	// ---------------------------------------------------------------------------

	const tickRef = useRef<(timestamp: number) => void>(() => {})

	// Assign the actual implementation to tickRef — wrapped in useLayoutEffect
	// so it always has the latest closures without breaking lint rules.
	useLayoutEffect(() => {
		tickRef.current = (timestamp: number) => {
			if (statusRef.current !== PLAYER_STATUS.PLAYING) return

			const last = lastTimeRef.current ?? timestamp
			const elapsedMs = timestamp - last
			lastTimeRef.current = timestamp

			const currentLength = lengthRef.current
			if (currentLength === 0) {
				cancelRaf()
				syncStatus(PLAYER_STATUS.DONE)
				return
			}

			const remaining = currentLength - 1 - cursorRef.current
			if (remaining <= 0) {
				cancelRaf()
				syncStatus(PLAYER_STATUS.DONE)
				return
			}

			const msPerStep = getMsPerStep(speedRef.current)
			const { steps, nextAcc } = advance(accRef.current, elapsedMs, 1, msPerStep, remaining)
			accRef.current = nextAcc

			if (steps > 0) {
				const newCursor = cursorRef.current + steps
				syncCursor(newCursor)
				onAdvanceRef.current(newCursor)

				if (newCursor >= currentLength - 1) {
					cancelRaf()
					syncStatus(PLAYER_STATUS.DONE)
					return
				}
			}

			// Re-queue for next frame using the ref — avoids circular dep
			rafRef.current = requestAnimationFrame((t) => tickRef.current(t))
		}
	})

	// Start the rAF loop
	const startLoop = useCallback(() => {
		cancelRaf()
		accRef.current = 0
		lastTimeRef.current = null
		rafRef.current = requestAnimationFrame((t) => tickRef.current(t))
	}, [cancelRaf])

	// ---------------------------------------------------------------------------
	// Controls
	// ---------------------------------------------------------------------------

	const play = useCallback(() => {
		if (lengthRef.current === 0) return
		if (statusRef.current === PLAYER_STATUS.DONE) return
		if (statusRef.current === PLAYER_STATUS.PLAYING) return
		syncStatus(PLAYER_STATUS.PLAYING)
		startLoop()
	}, [startLoop, syncStatus])

	const pause = useCallback(() => {
		if (statusRef.current !== PLAYER_STATUS.PLAYING) return
		cancelRaf()
		syncStatus(PLAYER_STATUS.PAUSED)
	}, [cancelRaf, syncStatus])

	const step = useCallback(() => {
		if (lengthRef.current === 0) return
		// Pause first if playing
		if (statusRef.current === PLAYER_STATUS.PLAYING) {
			cancelRaf()
			syncStatus(PLAYER_STATUS.PAUSED)
		}
		if (statusRef.current === PLAYER_STATUS.DONE) return

		const newCursor = Math.min(cursorRef.current + 1, lengthRef.current - 1)
		syncCursor(newCursor)
		onAdvanceRef.current(newCursor)

		if (newCursor >= lengthRef.current - 1) {
			syncStatus(PLAYER_STATUS.DONE)
		} else {
			syncStatus(PLAYER_STATUS.PAUSED)
		}
	}, [cancelRaf, syncCursor, syncStatus])

	const reset = useCallback(() => {
		cancelRaf()
		syncCursor(0)
		syncStatus(PLAYER_STATUS.IDLE)
		onAdvanceRef.current(0)
	}, [cancelRaf, syncCursor, syncStatus])

	const seek = useCallback(
		(targetCursor: number) => {
			if (lengthRef.current === 0) return
			// Pause first if playing
			if (statusRef.current === PLAYER_STATUS.PLAYING) {
				cancelRaf()
			}
			const clamped = Math.max(0, Math.min(targetCursor, lengthRef.current - 1))
			syncCursor(clamped)
			onAdvanceRef.current(clamped)

			if (clamped >= lengthRef.current - 1) {
				syncStatus(PLAYER_STATUS.DONE)
			} else {
				syncStatus(PLAYER_STATUS.PAUSED)
			}
		},
		[cancelRaf, syncCursor, syncStatus]
	)

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current)
			}
		}
	}, [])

	return { status, cursor, play, pause, step, reset, seek }
}
