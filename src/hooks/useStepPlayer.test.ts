/**
 * Tests for useStepPlayer hook.
 *
 * rAF-based timing is tested with vitest fake timers + manual rAF stepping.
 * We verify the pure state machine behavior (play/pause/step/reset/seek)
 * without relying on real wall-clock time.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useStepPlayer, PLAYER_STATUS } from "./useStepPlayer"

// ---------------------------------------------------------------------------
// rAF mock helpers
// ---------------------------------------------------------------------------

type RafCallback = (timestamp: number) => void

let rafCallbacks: RafCallback[] = []
let rafTimestamp = 0

function setupRafMock() {
	rafCallbacks = []
	rafTimestamp = 0
	vi.stubGlobal(
		"requestAnimationFrame",
		vi.fn((cb: RafCallback) => {
			rafCallbacks.push(cb)
			return rafCallbacks.length
		})
	)
	vi.stubGlobal("cancelAnimationFrame", vi.fn())
}

function flushRaf(deltaMs = 16) {
	rafTimestamp += deltaMs
	const cbs = rafCallbacks.splice(0)
	for (const cb of cbs) {
		cb(rafTimestamp)
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useStepPlayer", () => {
	beforeEach(() => {
		setupRafMock()
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("starts with idle status and cursor 0", () => {
		const onAdvance = vi.fn()
		const { result } = renderHook(() => useStepPlayer({ length: 10, speed: 4, onAdvance }))
		expect(result.current.status).toBe(PLAYER_STATUS.IDLE)
		expect(result.current.cursor).toBe(0)
	})

	it("transitions to playing when play() is called", () => {
		const { result } = renderHook(() => useStepPlayer({ length: 10, speed: 4, onAdvance: vi.fn() }))
		act(() => {
			result.current.play()
		})
		expect(result.current.status).toBe(PLAYER_STATUS.PLAYING)
	})

	it("transitions to paused when pause() is called from playing", () => {
		const { result } = renderHook(() => useStepPlayer({ length: 10, speed: 4, onAdvance: vi.fn() }))
		act(() => {
			result.current.play()
		})
		act(() => {
			result.current.pause()
		})
		expect(result.current.status).toBe(PLAYER_STATUS.PAUSED)
	})

	it("step() from idle advances cursor by 1 and transitions to paused", () => {
		const onAdvance = vi.fn()
		const { result } = renderHook(() => useStepPlayer({ length: 10, speed: 4, onAdvance }))
		act(() => {
			result.current.step()
		})
		expect(result.current.cursor).toBe(1)
		expect(result.current.status).toBe(PLAYER_STATUS.PAUSED)
		expect(onAdvance).toHaveBeenCalledWith(1)
	})

	it("reset() returns cursor to 0 and status to idle", () => {
		const onAdvance = vi.fn()
		const { result } = renderHook(() => useStepPlayer({ length: 10, speed: 4, onAdvance }))
		act(() => {
			result.current.step()
		})
		act(() => {
			result.current.reset()
		})
		expect(result.current.cursor).toBe(0)
		expect(result.current.status).toBe(PLAYER_STATUS.IDLE)
	})

	it("seek() jumps to given cursor and pauses", () => {
		const onAdvance = vi.fn()
		const { result } = renderHook(() => useStepPlayer({ length: 20, speed: 4, onAdvance }))
		act(() => {
			result.current.seek(10)
		})
		expect(result.current.cursor).toBe(10)
		expect(result.current.status).toBe(PLAYER_STATUS.PAUSED)
		expect(onAdvance).toHaveBeenCalledWith(10)
	})

	it("seek() clamps to [0, length-1]", () => {
		const { result } = renderHook(() => useStepPlayer({ length: 5, speed: 4, onAdvance: vi.fn() }))
		act(() => {
			result.current.seek(100)
		})
		expect(result.current.cursor).toBe(4) // length - 1
	})

	it("seek() to last index transitions to done", () => {
		const { result } = renderHook(() => useStepPlayer({ length: 5, speed: 4, onAdvance: vi.fn() }))
		act(() => {
			result.current.seek(4)
		})
		expect(result.current.status).toBe(PLAYER_STATUS.DONE)
	})

	it("step() at last position transitions to done", () => {
		const { result } = renderHook(() => useStepPlayer({ length: 2, speed: 4, onAdvance: vi.fn() }))
		act(() => {
			result.current.step() // cursor → 1 (last)
		})
		expect(result.current.status).toBe(PLAYER_STATUS.DONE)
	})

	it("play() is no-op when already done", () => {
		const { result } = renderHook(() => useStepPlayer({ length: 2, speed: 4, onAdvance: vi.fn() }))
		act(() => result.current.seek(1)) // done
		act(() => result.current.play())
		expect(result.current.status).toBe(PLAYER_STATUS.DONE)
	})

	it("rAF loop advances cursor over multiple frames", () => {
		const onAdvance = vi.fn()
		const { result } = renderHook(() =>
			// Speed 8 = 1ms/step; each 16ms frame should advance ~16 steps
			useStepPlayer({ length: 100, speed: 8, onAdvance })
		)
		act(() => {
			result.current.play()
		})
		// Flush two 16ms frames; at 1ms/step, 2 × 16ms = 32 steps are expected.
		// We assert >= 10 to allow for accumulator carry-over on the first frame
		// (elapsed = 0 on the first tick) while still proving real progress.
		act(() => {
			flushRaf(16) // frame 1 — establishes baseline timestamp (elapsed = 0)
			flushRaf(16) // frame 2 — advances ~16 steps
		})
		expect(result.current.cursor).toBeGreaterThanOrEqual(10)
		expect(onAdvance).toHaveBeenCalled()
	})

	it("rAF loop marks done when cursor reaches end of trace", async () => {
		const onAdvance = vi.fn()
		const { result } = renderHook(() =>
			// Very short trace (3 steps); speed 8 = 1ms/step
			useStepPlayer({ length: 3, speed: 8, onAdvance })
		)
		act(() => {
			result.current.play()
		})
		// Frame 1: establishes the baseline timestamp (elapsedMs = 0 on first tick)
		act(() => {
			flushRaf(16)
		})
		// Frame 2: elapsedMs = 100ms @ 1ms/step = 100 steps → capped at remaining=2 → done
		await act(async () => {
			flushRaf(100)
		})
		// onAdvance was called with the final cursor position (2)
		expect(onAdvance).toHaveBeenCalledWith(2)
		expect(result.current.status).toBe(PLAYER_STATUS.DONE)
	})

	it("play() on zero-length trace does nothing", () => {
		const { result } = renderHook(() => useStepPlayer({ length: 0, speed: 4, onAdvance: vi.fn() }))
		act(() => {
			result.current.play()
		})
		expect(result.current.status).toBe(PLAYER_STATUS.IDLE)
	})

	// W2: missing behavioral tests

	it("play→pause→play resumes from current cursor position, not from 0", () => {
		const onAdvance = vi.fn()
		const { result } = renderHook(() => useStepPlayer({ length: 100, speed: 8, onAdvance }))
		act(() => {
			result.current.play()
		})
		// Advance a few frames to move the cursor forward
		act(() => {
			flushRaf(16)
			flushRaf(16)
		})
		const cursorAfterPlay = result.current.cursor
		expect(cursorAfterPlay).toBeGreaterThan(0)
		// Pause
		act(() => {
			result.current.pause()
		})
		expect(result.current.status).toBe(PLAYER_STATUS.PAUSED)
		expect(result.current.cursor).toBe(cursorAfterPlay)
		// Play again — cursor must continue from cursorAfterPlay, not reset to 0
		act(() => {
			result.current.play()
		})
		expect(result.current.status).toBe(PLAYER_STATUS.PLAYING)
		expect(result.current.cursor).toBe(cursorAfterPlay)
	})

	it("step() while PLAYING cancels the loop, advances 1 step, and ends PAUSED", () => {
		const onAdvance = vi.fn()
		const { result } = renderHook(() => useStepPlayer({ length: 100, speed: 8, onAdvance }))
		act(() => {
			result.current.play()
		})
		act(() => {
			flushRaf(16)
		})
		const cursorBeforeStep = result.current.cursor
		// step() while playing
		act(() => {
			result.current.step()
		})
		expect(result.current.status).toBe(PLAYER_STATUS.PAUSED)
		expect(result.current.cursor).toBe(cursorBeforeStep + 1)
	})

	it("seek() while PLAYING cancels the loop and ends PAUSED", () => {
		const onAdvance = vi.fn()
		const { result } = renderHook(() => useStepPlayer({ length: 100, speed: 8, onAdvance }))
		act(() => {
			result.current.play()
		})
		act(() => {
			flushRaf(16)
		})
		// seek() while playing
		act(() => {
			result.current.seek(50)
		})
		expect(result.current.status).toBe(PLAYER_STATUS.PAUSED)
		expect(result.current.cursor).toBe(50)
	})

	it("reset() while PLAYING cancels the loop, returns IDLE at cursor 0", () => {
		const onAdvance = vi.fn()
		const { result } = renderHook(() => useStepPlayer({ length: 100, speed: 8, onAdvance }))
		act(() => {
			result.current.play()
		})
		act(() => {
			flushRaf(16)
		})
		// reset() while playing
		act(() => {
			result.current.reset()
		})
		expect(result.current.status).toBe(PLAYER_STATUS.IDLE)
		expect(result.current.cursor).toBe(0)
	})
})
