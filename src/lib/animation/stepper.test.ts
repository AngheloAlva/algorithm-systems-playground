/**
 * TDD tests for the pure accumulator-based stepper math.
 *
 * `advance(acc, elapsedMs, speed, msPerStep) => { steps, nextAcc }`
 *
 * Contract:
 *  - acc (ms remainder from last frame) + elapsedMs * speed gives total progress
 *  - steps = floor(total / msPerStep)  — whole steps to advance
 *  - nextAcc = total % msPerStep       — carry-over remainder for next frame
 *  - steps is capped by an optional `remaining` parameter when provided
 */

import { describe, it, expect } from "vitest"
import { advance } from "./stepper"

describe("advance", () => {
	describe("basic accumulation", () => {
		it("advances zero steps when elapsed is less than one step", () => {
			const result = advance(0, 8, 1, 16)
			expect(result.steps).toBe(0)
			expect(result.nextAcc).toBeCloseTo(8)
		})

		it("advances exactly one step when elapsed equals msPerStep", () => {
			const result = advance(0, 16, 1, 16)
			expect(result.steps).toBe(1)
			expect(result.nextAcc).toBeCloseTo(0)
		})

		it("advances multiple steps when elapsed covers several msPerStep intervals", () => {
			// 0 acc + 64ms * 1x speed / 16ms per step = 4 steps
			const result = advance(0, 64, 1, 16)
			expect(result.steps).toBe(4)
			expect(result.nextAcc).toBeCloseTo(0)
		})

		it("carries remainder into nextAcc", () => {
			// 0 acc + 20ms * 1x / 16ms = 1 step, 4ms carry
			const result = advance(0, 20, 1, 16)
			expect(result.steps).toBe(1)
			expect(result.nextAcc).toBeCloseTo(4)
		})
	})

	describe("carry-over accumulation", () => {
		it("adds existing acc to new elapsed before computing steps", () => {
			// 8ms acc + 8ms elapsed * 1x = 16ms total → 1 step, 0 carry
			const result = advance(8, 8, 1, 16)
			expect(result.steps).toBe(1)
			expect(result.nextAcc).toBeCloseTo(0)
		})

		it("carries non-zero acc across frames", () => {
			// 4ms acc + 10ms elapsed * 1x = 14ms → 0 steps, 14ms carry
			const result = advance(4, 10, 1, 16)
			expect(result.steps).toBe(0)
			expect(result.nextAcc).toBeCloseTo(14)
		})

		it("compounds acc over two successive frames", () => {
			// Frame 1: 0 + 8ms = 8ms carry
			const frame1 = advance(0, 8, 1, 16)
			expect(frame1.steps).toBe(0)
			// Frame 2: 8ms carry + 8ms = 16ms → 1 step
			const frame2 = advance(frame1.nextAcc, 8, 1, 16)
			expect(frame2.steps).toBe(1)
			expect(frame2.nextAcc).toBeCloseTo(0)
		})
	})

	describe("speed multiplier", () => {
		it("doubles steps at 2x speed", () => {
			// 0 + 16ms * 2 / 16ms = 2 steps
			const result = advance(0, 16, 2, 16)
			expect(result.steps).toBe(2)
			expect(result.nextAcc).toBeCloseTo(0)
		})

		it("halves steps at 0.5x speed (sub-frame accumulation)", () => {
			// 0 + 16ms * 0.5 / 16ms = 0.5 → 0 steps, 8ms carry
			const result = advance(0, 16, 0.5, 16)
			expect(result.steps).toBe(0)
			expect(result.nextAcc).toBeCloseTo(8)
		})

		it("batches 8 steps per frame at 8x speed", () => {
			// 0 + 16ms * 8 / 16ms = 8 steps
			const result = advance(0, 16, 8, 16)
			expect(result.steps).toBe(8)
			expect(result.nextAcc).toBeCloseTo(0)
		})
	})

	describe("remaining cap", () => {
		it("caps steps at remaining when remaining is provided and smaller", () => {
			// Would yield 8 steps but only 3 remain
			const result = advance(0, 128, 1, 16, 3)
			expect(result.steps).toBe(3)
		})

		it("does not cap when remaining is larger than natural steps", () => {
			// Would yield 2 steps; remaining = 10 → no cap
			const result = advance(0, 32, 1, 16, 10)
			expect(result.steps).toBe(2)
		})

		it("returns zero steps when remaining is zero", () => {
			const result = advance(0, 64, 1, 16, 0)
			expect(result.steps).toBe(0)
		})

		it("carries remainder even when capped", () => {
			// 64ms / 16ms = 4 steps, capped at 2; leftover acc is 0 (64ms was exact multiple)
			const result = advance(0, 64, 1, 16, 2)
			expect(result.steps).toBe(2)
			// acc should still be computed from total (64ms) so leftover = 0
			expect(result.nextAcc).toBeCloseTo(0)
		})
	})

	describe("edge cases", () => {
		it("returns zero steps and zero acc when elapsedMs is zero", () => {
			const result = advance(0, 0, 1, 16)
			expect(result.steps).toBe(0)
			expect(result.nextAcc).toBe(0)
		})

		it("returns zero steps with existing acc when still below msPerStep", () => {
			const result = advance(5, 0, 1, 16)
			expect(result.steps).toBe(0)
			expect(result.nextAcc).toBeCloseTo(5)
		})

		it("result.steps is always a non-negative integer", () => {
			const result = advance(3, 7, 2.5, 16)
			expect(result.steps).toBeGreaterThanOrEqual(0)
			expect(Number.isInteger(result.steps)).toBe(true)
		})

		it("result.nextAcc is always between 0 (inclusive) and msPerStep (exclusive)", () => {
			const result = advance(7, 13, 1.5, 16)
			expect(result.nextAcc).toBeGreaterThanOrEqual(0)
			expect(result.nextAcc).toBeLessThan(16)
		})
	})
})
