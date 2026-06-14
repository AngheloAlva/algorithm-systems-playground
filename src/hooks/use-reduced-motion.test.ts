/**
 * useReducedMotion — unit tests (REQ-ANIM-4)
 *
 * Verifies the hook reads prefers-reduced-motion, subscribes to changes,
 * returns the correct boolean, and is SSR-safe (no crash when matchMedia is undefined).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"

// ---------------------------------------------------------------------------
// matchMedia mock helpers
// ---------------------------------------------------------------------------

type MediaQueryListListener = (event: MediaQueryListEvent) => void

function createMatchMediaMock(matches: boolean) {
  const listeners: MediaQueryListListener[] = []

  const mql = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: vi.fn((event: string, cb: MediaQueryListListener) => {
      if (event === "change") listeners.push(cb)
    }),
    removeEventListener: vi.fn((event: string, cb: MediaQueryListListener) => {
      const idx = listeners.indexOf(cb)
      if (idx !== -1) listeners.splice(idx, 1)
    }),
    dispatchEvent: vi.fn(),
    // Helper to fire a change event on active listeners
    _fire: (newMatches: boolean) => {
      listeners.forEach((cb) =>
        cb({ matches: newMatches, media: "(prefers-reduced-motion: reduce)" } as MediaQueryListEvent),
      )
    },
  }

  return mql
}

describe("useReducedMotion", () => {
  let originalMatchMedia: typeof window.matchMedia

  beforeEach(() => {
    originalMatchMedia = window.matchMedia
  })

  afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: originalMatchMedia,
    })
    vi.resetModules()
  })

  it("returns true when matchMedia reports matches: true (REQ-ANIM-4 scenario 4.1)", async () => {
    const mock = createMatchMediaMock(true)
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn(() => mock),
    })

    const { useReducedMotion } = await import("./use-reduced-motion")
    const { result } = renderHook(() => useReducedMotion())

    expect(result.current).toBe(true)
  })

  it("returns false when matchMedia reports matches: false (REQ-ANIM-4 scenario 4.2)", async () => {
    const mock = createMatchMediaMock(false)
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn(() => mock),
    })

    const { useReducedMotion } = await import("./use-reduced-motion")
    const { result } = renderHook(() => useReducedMotion())

    expect(result.current).toBe(false)
  })

  it("updates when the media query change event fires", async () => {
    const mock = createMatchMediaMock(false)
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn(() => mock),
    })

    const { useReducedMotion } = await import("./use-reduced-motion")
    const { result } = renderHook(() => useReducedMotion())

    expect(result.current).toBe(false)

    act(() => {
      mock._fire(true)
    })

    expect(result.current).toBe(true)

    act(() => {
      mock._fire(false)
    })

    expect(result.current).toBe(false)
  })

  it("does not crash when matchMedia is undefined (SSR/jsdom guard)", async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: undefined,
    })

    const { useReducedMotion } = await import("./use-reduced-motion")
    expect(() => renderHook(() => useReducedMotion())).not.toThrow()
  })

  it("returns false as SSR-safe default when matchMedia is undefined", async () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: undefined,
    })

    const { useReducedMotion } = await import("./use-reduced-motion")
    const { result } = renderHook(() => useReducedMotion())

    expect(result.current).toBe(false)
  })

  it("subscribes with addEventListener on mount and removes with removeEventListener on unmount (REQ-ANIM-4 cleanup)", async () => {
    const mock = createMatchMediaMock(false)
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn(() => mock),
    })

    const { useReducedMotion } = await import("./use-reduced-motion")
    const { unmount } = renderHook(() => useReducedMotion())

    // Mount: addEventListener must have been called once with "change" and a function
    expect(mock.addEventListener).toHaveBeenCalledTimes(1)
    expect(mock.addEventListener).toHaveBeenCalledWith("change", expect.any(Function))

    unmount()

    // Unmount: removeEventListener must have been called once with "change" and a function
    expect(mock.removeEventListener).toHaveBeenCalledTimes(1)
    expect(mock.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function))
  })
})
