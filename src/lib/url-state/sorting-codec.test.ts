/**
 * TDD tests for SortingUrlCodec.
 *
 * Tests are written RED-first before implementation exists.
 *
 * Covers:
 *  - encode/decode roundtrip for every field
 *  - default omission in encoded params (clean URLs)
 *  - defaults applied when params are absent
 *  - invalid algorithm slug fallback to default
 *  - invalid speed value fallback to default
 *  - invalid arrayLength value fallback to default
 *  - invalid arrayMode fallback to default
 *  - partial params (one field present, rest absent)
 *  - hostile input: out-of-range, NaN, unknown enum values
 */

import { describe, it, expect } from "vitest"
import { sortingCodec, SORTING_DEFAULTS } from "./sorting-codec"
import type { SortingUrlState } from "./sorting-codec"

describe("sortingCodec — encode", () => {
	it("omits all keys when state matches defaults (clean URL)", () => {
		const params = sortingCodec.encode(SORTING_DEFAULTS)
		expect(params.toString()).toBe("")
	})

	it("encodes algorithm when it differs from default", () => {
		const state: SortingUrlState = { ...SORTING_DEFAULTS, algorithm: "merge" }
		const params = sortingCodec.encode(state)
		expect(params.get("sort")).toBe("merge")
	})

	it("encodes speed when it differs from default", () => {
		const state: SortingUrlState = { ...SORTING_DEFAULTS, speed: 7 }
		const params = sortingCodec.encode(state)
		expect(params.get("speed")).toBe("7")
	})

	it("encodes arrayLength when it differs from default", () => {
		const state: SortingUrlState = { ...SORTING_DEFAULTS, arrayLength: 50 }
		const params = sortingCodec.encode(state)
		expect(params.get("len")).toBe("50")
	})

	it("encodes arrayMode when it differs from default", () => {
		const state: SortingUrlState = { ...SORTING_DEFAULTS, arrayMode: "reversed" }
		const params = sortingCodec.encode(state)
		expect(params.get("mode")).toBe("reversed")
	})

	it("encodes non-default quick algorithm", () => {
		const state: SortingUrlState = { ...SORTING_DEFAULTS, algorithm: "quick" }
		const params = sortingCodec.encode(state)
		expect(params.get("sort")).toBe("quick")
	})

	it("encodes non-default heap algorithm", () => {
		const state: SortingUrlState = { ...SORTING_DEFAULTS, algorithm: "heap" }
		const params = sortingCodec.encode(state)
		expect(params.get("sort")).toBe("heap")
	})

	it("encodes arrayMode=sorted", () => {
		const state: SortingUrlState = { ...SORTING_DEFAULTS, arrayMode: "sorted" }
		const params = sortingCodec.encode(state)
		expect(params.get("mode")).toBe("sorted")
	})

	it("encodes arrayMode=few-unique", () => {
		const state: SortingUrlState = { ...SORTING_DEFAULTS, arrayMode: "few-unique" }
		const params = sortingCodec.encode(state)
		expect(params.get("mode")).toBe("few-unique")
	})
})

describe("sortingCodec — decode", () => {
	it("returns defaults when params are empty", () => {
		const params = new URLSearchParams()
		expect(sortingCodec.decode(params)).toEqual(SORTING_DEFAULTS)
	})

	it("decodes sort=merge correctly", () => {
		const params = new URLSearchParams("sort=merge")
		expect(sortingCodec.decode(params).algorithm).toBe("merge")
	})

	it("decodes sort=quick correctly", () => {
		const params = new URLSearchParams("sort=quick")
		expect(sortingCodec.decode(params).algorithm).toBe("quick")
	})

	it("decodes sort=heap correctly", () => {
		const params = new URLSearchParams("sort=heap")
		expect(sortingCodec.decode(params).algorithm).toBe("heap")
	})

	it("decodes sort=bubble correctly", () => {
		const params = new URLSearchParams("sort=bubble")
		expect(sortingCodec.decode(params).algorithm).toBe("bubble")
	})

	it("falls back to default algorithm for unknown slug", () => {
		const params = new URLSearchParams("sort=unknown")
		expect(sortingCodec.decode(params).algorithm).toBe(SORTING_DEFAULTS.algorithm)
	})

	it("falls back to default algorithm for empty sort param", () => {
		const params = new URLSearchParams("sort=")
		expect(sortingCodec.decode(params).algorithm).toBe(SORTING_DEFAULTS.algorithm)
	})

	it("decodes speed=3 correctly", () => {
		const params = new URLSearchParams("speed=3")
		expect(sortingCodec.decode(params).speed).toBe(3)
	})

	it("decodes speed=8 correctly", () => {
		const params = new URLSearchParams("speed=8")
		expect(sortingCodec.decode(params).speed).toBe(8)
	})

	it("falls back to default speed for NaN", () => {
		const params = new URLSearchParams("speed=NaN")
		expect(sortingCodec.decode(params).speed).toBe(SORTING_DEFAULTS.speed)
	})

	it("falls back to default speed for out-of-range (0)", () => {
		const params = new URLSearchParams("speed=0")
		expect(sortingCodec.decode(params).speed).toBe(SORTING_DEFAULTS.speed)
	})

	it("falls back to default speed for out-of-range (9)", () => {
		const params = new URLSearchParams("speed=9")
		expect(sortingCodec.decode(params).speed).toBe(SORTING_DEFAULTS.speed)
	})

	it("decodes len=50 correctly", () => {
		const params = new URLSearchParams("len=50")
		expect(sortingCodec.decode(params).arrayLength).toBe(50)
	})

	it("clamps len below MIN to MIN", () => {
		const params = new URLSearchParams("len=1")
		const result = sortingCodec.decode(params)
		expect(result.arrayLength).toBeGreaterThanOrEqual(5)
	})

	it("clamps len above MAX to MAX", () => {
		const params = new URLSearchParams("len=9999")
		const result = sortingCodec.decode(params)
		expect(result.arrayLength).toBeLessThanOrEqual(200)
	})

	it("falls back to default arrayLength for NaN", () => {
		const params = new URLSearchParams("len=NaN")
		expect(sortingCodec.decode(params).arrayLength).toBe(SORTING_DEFAULTS.arrayLength)
	})

	it("decodes mode=reversed correctly", () => {
		const params = new URLSearchParams("mode=reversed")
		expect(sortingCodec.decode(params).arrayMode).toBe("reversed")
	})

	it("decodes mode=sorted correctly", () => {
		const params = new URLSearchParams("mode=sorted")
		expect(sortingCodec.decode(params).arrayMode).toBe("sorted")
	})

	it("decodes mode=few-unique correctly", () => {
		const params = new URLSearchParams("mode=few-unique")
		expect(sortingCodec.decode(params).arrayMode).toBe("few-unique")
	})

	it("decodes mode=random correctly", () => {
		const params = new URLSearchParams("mode=random")
		expect(sortingCodec.decode(params).arrayMode).toBe("random")
	})

	it("falls back to default arrayMode for unknown value", () => {
		const params = new URLSearchParams("mode=garbage")
		expect(sortingCodec.decode(params).arrayMode).toBe(SORTING_DEFAULTS.arrayMode)
	})
})

// ---------------------------------------------------------------------------
// Hostile-input decode
// ---------------------------------------------------------------------------

describe("sortingCodec — hostile inputs (speed)", () => {
	it("speed=-1 falls back to default", () => {
		const params = new URLSearchParams("speed=-1")
		expect(sortingCodec.decode(params).speed).toBe(SORTING_DEFAULTS.speed)
	})

	it("speed=999 falls back to default", () => {
		const params = new URLSearchParams("speed=999")
		expect(sortingCodec.decode(params).speed).toBe(SORTING_DEFAULTS.speed)
	})

	it("speed=3.5 (non-integer) falls back to default", () => {
		const params = new URLSearchParams("speed=3.5")
		expect(sortingCodec.decode(params).speed).toBe(SORTING_DEFAULTS.speed)
	})
})

describe("sortingCodec — hostile inputs (algorithm)", () => {
	it("sort=insertion falls back to default (not in allowed set)", () => {
		const params = new URLSearchParams("sort=insertion")
		expect(sortingCodec.decode(params).algorithm).toBe(SORTING_DEFAULTS.algorithm)
	})
})

describe("sortingCodec — hostile inputs (arrayLength)", () => {
	it("len=abc falls back to default (NaN)", () => {
		const params = new URLSearchParams("len=abc")
		expect(sortingCodec.decode(params).arrayLength).toBe(SORTING_DEFAULTS.arrayLength)
	})

	it("len=0 clamps to MIN_ARRAY_LENGTH", () => {
		const params = new URLSearchParams("len=0")
		expect(sortingCodec.decode(params).arrayLength).toBeGreaterThanOrEqual(5)
	})
})

describe("sortingCodec — roundtrip", () => {
	it("roundtrips the default state", () => {
		const encoded = sortingCodec.encode(SORTING_DEFAULTS)
		const decoded = sortingCodec.decode(encoded)
		expect(decoded).toEqual(SORTING_DEFAULTS)
	})

	it("roundtrips { algorithm: merge, speed: 3, arrayLength: 50, arrayMode: reversed }", () => {
		const state: SortingUrlState = {
			algorithm: "merge",
			speed: 3,
			arrayLength: 50,
			arrayMode: "reversed",
		}
		const encoded = sortingCodec.encode(state)
		const decoded = sortingCodec.decode(encoded)
		expect(decoded).toEqual(state)
	})

	it("roundtrips { algorithm: quick, speed: 8, arrayLength: 100, arrayMode: few-unique }", () => {
		const state: SortingUrlState = {
			algorithm: "quick",
			speed: 8,
			arrayLength: 100,
			arrayMode: "few-unique",
		}
		const encoded = sortingCodec.encode(state)
		const decoded = sortingCodec.decode(encoded)
		expect(decoded).toEqual(state)
	})

	it("roundtrips partial state with only algorithm changed", () => {
		const state: SortingUrlState = { ...SORTING_DEFAULTS, algorithm: "heap" }
		const encoded = sortingCodec.encode(state)
		const decoded = sortingCodec.decode(encoded)
		expect(decoded).toEqual(state)
	})

	it("roundtrips partial state with only arrayMode changed", () => {
		const state: SortingUrlState = { ...SORTING_DEFAULTS, arrayMode: "sorted" }
		const encoded = sortingCodec.encode(state)
		const decoded = sortingCodec.decode(encoded)
		expect(decoded).toEqual(state)
	})
})
