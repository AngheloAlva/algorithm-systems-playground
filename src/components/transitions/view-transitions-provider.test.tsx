/**
 * ViewTransitionsProvider — unit tests
 *
 * Verifies the provider + pathname-resolver pattern:
 * - transitionTo calls document.startViewTransition when supported + motion-allowed
 * - transitionTo calls router.push directly (no VT) when:
 *   - reduced motion is enabled
 *   - startViewTransition is unsupported
 *   - href resolves to the current pathname (same route)
 * - The pending transition resolves when usePathname changes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import * as React from "react"

// ---------------------------------------------------------------------------
// Module-level stable mocks
// ---------------------------------------------------------------------------

const mockPush = vi.fn()
let mockPathname = "/current"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}))

const mockUseReducedMotion = vi.fn(() => false)
vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}))

import { ViewTransitionsProvider, useViewTransitionRouter } from "./view-transitions-provider"

// ---------------------------------------------------------------------------
// Helper: a consumer that calls transitionTo via the hook
// ---------------------------------------------------------------------------

function Consumer({ href }: { href: string }) {
  const { transitionTo } = useViewTransitionRouter()
  return (
    <button onClick={() => transitionTo(href)}>navigate</button>
  )
}

// ---------------------------------------------------------------------------
// Helpers for document.startViewTransition
// ---------------------------------------------------------------------------

function installStartVT(impl: unknown) {
  Object.defineProperty(document, "startViewTransition", {
    value: impl,
    writable: true,
    configurable: true,
  })
}

function removeStartVT() {
  // Delete so it falls back to undefined (unsupported browser sim)
  Object.defineProperty(document, "startViewTransition", {
    value: undefined,
    writable: true,
    configurable: true,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockUseReducedMotion.mockReturnValue(false)
  mockPathname = "/current"
})

afterEach(() => {
  // Clean up document.startViewTransition between tests
  Object.defineProperty(document, "startViewTransition", {
    value: undefined,
    writable: true,
    configurable: true,
  })
})

describe("ViewTransitionsProvider", () => {
  describe("transitionTo — reduced motion disabled, VT supported", () => {
    let startVT: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockUseReducedMotion.mockReturnValue(false)
      startVT = vi.fn((_cb: () => Promise<void>) => {
        // Simulate: immediately resolve by calling the promise callback
        void _cb()
        return {
          ready: Promise.resolve(),
          finished: Promise.resolve(),
          updateCallbackDone: Promise.resolve(),
        }
      })
      installStartVT(startVT)
    })

    it("calls document.startViewTransition when navigating to a different route", () => {
      render(
        <ViewTransitionsProvider>
          <Consumer href="/other" />
        </ViewTransitionsProvider>,
      )
      act(() => {
        screen.getByRole("button").click()
      })
      expect(startVT).toHaveBeenCalledTimes(1)
    })

    it("calls router.push inside the startViewTransition callback", () => {
      render(
        <ViewTransitionsProvider>
          <Consumer href="/other" />
        </ViewTransitionsProvider>,
      )
      act(() => {
        screen.getByRole("button").click()
      })
      expect(mockPush).toHaveBeenCalledWith("/other")
    })
  })

  describe("transitionTo — reduced motion enabled", () => {
    let startVT: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockUseReducedMotion.mockReturnValue(true)
      startVT = vi.fn()
      installStartVT(startVT)
    })

    it("does NOT call startViewTransition", () => {
      render(
        <ViewTransitionsProvider>
          <Consumer href="/other" />
        </ViewTransitionsProvider>,
      )
      act(() => {
        screen.getByRole("button").click()
      })
      expect(startVT).not.toHaveBeenCalled()
    })

    it("calls router.push directly", () => {
      render(
        <ViewTransitionsProvider>
          <Consumer href="/other" />
        </ViewTransitionsProvider>,
      )
      act(() => {
        screen.getByRole("button").click()
      })
      expect(mockPush).toHaveBeenCalledWith("/other")
    })
  })

  describe("transitionTo — VT unsupported", () => {
    beforeEach(() => {
      mockUseReducedMotion.mockReturnValue(false)
      removeStartVT()
    })

    it("calls router.push directly without crashing", () => {
      render(
        <ViewTransitionsProvider>
          <Consumer href="/other" />
        </ViewTransitionsProvider>,
      )
      expect(() =>
        act(() => {
          screen.getByRole("button").click()
        }),
      ).not.toThrow()
      expect(mockPush).toHaveBeenCalledWith("/other")
    })
  })

  describe("transitionTo — same pathname (no-op transition)", () => {
    let startVT: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockUseReducedMotion.mockReturnValue(false)
      startVT = vi.fn()
      installStartVT(startVT)
      // Current pathname is /current; navigating to /current = same route
      mockPathname = "/current"
    })

    it("does NOT call startViewTransition when href matches current pathname", () => {
      render(
        <ViewTransitionsProvider>
          <Consumer href="/current" />
        </ViewTransitionsProvider>,
      )
      act(() => {
        screen.getByRole("button").click()
      })
      expect(startVT).not.toHaveBeenCalled()
    })

    it("calls router.push directly for same-path navigation", () => {
      render(
        <ViewTransitionsProvider>
          <Consumer href="/current" />
        </ViewTransitionsProvider>,
      )
      act(() => {
        screen.getByRole("button").click()
      })
      expect(mockPush).toHaveBeenCalledWith("/current")
    })
  })

  describe("pending transition resolves when pathname changes", () => {
    it("the startViewTransition promise settles after pathname update", async () => {
      // Strategy: capture the raw Promise from the startVT callback without
      // auto-resolving it. Then change mockPathname and rerender so the
      // useEffect([pathname]) fires and calls finish().

      let capturedPromise: Promise<void> | null = null
      const startVT = vi.fn((cb: () => Promise<void>) => {
        // Capture but do NOT auto-resolve — leave it pending
        capturedPromise = cb()
        return {
          ready: Promise.resolve(),
          finished: Promise.resolve(),
          updateCallbackDone: Promise.resolve(),
        }
      })
      installStartVT(startVT)

      const { rerender } = render(
        <ViewTransitionsProvider>
          <Consumer href="/other" />
        </ViewTransitionsProvider>,
      )

      // Trigger navigation — sets finishRef and calls startVT
      act(() => {
        screen.getByRole("button").click()
      })

      expect(startVT).toHaveBeenCalledTimes(1)
      expect(capturedPromise).not.toBeNull()

      // Track settlement via .then side-effect
      let settled = false
      capturedPromise!.then(() => {
        settled = true
      })

      // Promise should still be PENDING — pathname hasn't changed yet
      await act(async () => {
        await Promise.resolve()
      })
      expect(settled).toBe(false)

      // Simulate pathname change: update mock + rerender so the effect fires
      await act(async () => {
        mockPathname = "/other"
        rerender(
          <ViewTransitionsProvider>
            <Consumer href="/other" />
          </ViewTransitionsProvider>,
        )
        // Allow microtasks from .then chains to flush
        await Promise.resolve()
      })

      expect(settled).toBe(true)
    })

    it("safety timeout resolves the promise even when pathname never changes", async () => {
      vi.useFakeTimers()

      let capturedPromise: Promise<void> | null = null
      const startVT = vi.fn((cb: () => Promise<void>) => {
        capturedPromise = cb()
        return {
          ready: Promise.resolve(),
          finished: Promise.resolve(),
          updateCallbackDone: Promise.resolve(),
        }
      })
      installStartVT(startVT)

      render(
        <ViewTransitionsProvider>
          <Consumer href="/other" />
        </ViewTransitionsProvider>,
      )

      // Trigger navigation
      act(() => {
        screen.getByRole("button").click()
      })

      expect(capturedPromise).not.toBeNull()

      let settled = false
      capturedPromise!.then(() => {
        settled = true
      })

      // Still pending before timeout fires
      await act(async () => {
        await Promise.resolve()
      })
      expect(settled).toBe(false)

      // Advance timers past the 400ms safety timeout
      await act(async () => {
        vi.advanceTimersByTime(400)
        await Promise.resolve()
      })

      expect(settled).toBe(true)

      vi.useRealTimers()
    })
  })
})

describe("useViewTransitionRouter — outside provider (graceful degradation)", () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReturnValue(false)
    // Ensure startViewTransition is undefined so VT path is not taken
    removeStartVT()
  })

  it("transitionTo calls router.push when no ViewTransitionsProvider is mounted", () => {
    // Render Consumer WITHOUT any ViewTransitionsProvider in the tree.
    // useViewTransitionRouter() falls back to the useRouter()-based transitionTo.
    render(<Consumer href="/fallback" />)

    act(() => {
      screen.getByRole("button").click()
    })

    expect(mockPush).toHaveBeenCalledWith("/fallback")
  })
})
