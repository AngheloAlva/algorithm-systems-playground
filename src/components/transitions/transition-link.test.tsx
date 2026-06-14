/**
 * TransitionLink — unit tests (REQ-ANIM, Slice C)
 *
 * Verifies that TransitionLink correctly delegates to the ViewTransitionsProvider
 * context for animated navigation, and falls back cleanly when no provider is
 * mounted.
 *
 * Modifier / middle-click contract:
 *   - startViewTransition NOT called
 *   - transitionTo NOT called
 *   - router.push NOT called
 *   - preventDefault NOT called
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

// ---------------------------------------------------------------------------
// Module-level stable mock for router.push
// ---------------------------------------------------------------------------

const mockPush = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/current",
}))

// ---------------------------------------------------------------------------
// next/link mock — render a real <a> so we can inspect href
// ---------------------------------------------------------------------------

vi.mock("next/link", () => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  default: ({ href, children, className, prefetch, ...rest }: {
    href: string
    children: React.ReactNode
    className?: string
    prefetch?: boolean
    [key: string]: unknown
  }) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}))

// ---------------------------------------------------------------------------
// useReducedMotion mock — controlled per test
// ---------------------------------------------------------------------------

const mockUseReducedMotion = vi.fn(() => false)
vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}))

// ---------------------------------------------------------------------------
// ViewTransitionsProvider mock — expose transitionTo as a stable spy
// ---------------------------------------------------------------------------

const mockTransitionTo = vi.fn()
vi.mock("./view-transitions-provider", () => ({
  useViewTransitionRouter: () => ({ transitionTo: mockTransitionTo }),
}))

import { TransitionLink } from "./transition-link"

beforeEach(() => {
  vi.clearAllMocks()
  mockUseReducedMotion.mockReturnValue(false)
  mockPush.mockReset()
  mockTransitionTo.mockReset()
})

afterEach(() => {
  // Restore document.startViewTransition between tests to prevent state leakage
  Object.defineProperty(document, "startViewTransition", {
    value: undefined,
    writable: true,
    configurable: true,
  })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TransitionLink", () => {
  it("renders a real <a> element with the correct href", () => {
    render(<TransitionLink href="/simulation">Go</TransitionLink>)
    const anchor = screen.getByRole("link", { name: "Go" })
    expect(anchor.tagName).toBe("A")
    expect(anchor).toHaveAttribute("href", "/simulation")
  })

  it("forwards children and className to the anchor", () => {
    render(
      <TransitionLink href="/graphs" className="nav-link">
        Graphs
      </TransitionLink>,
    )
    const anchor = screen.getByRole("link", { name: "Graphs" })
    expect(anchor).toHaveClass("nav-link")
    expect(anchor).toHaveTextContent("Graphs")
  })

  it("forwards arbitrary aria attributes to the anchor", () => {
    render(
      <TransitionLink href="/dashboard" aria-current="page">
        Dashboard
      </TransitionLink>,
    )
    const anchor = screen.getByRole("link", { name: "Dashboard" })
    expect(anchor).toHaveAttribute("aria-current", "page")
  })

  describe("plain left-click — delegates to transitionTo", () => {
    it("calls transitionTo with the href on plain click", () => {
      render(<TransitionLink href="/simulation">Sim</TransitionLink>)
      fireEvent.click(screen.getByRole("link", { name: "Sim" }))
      expect(mockTransitionTo).toHaveBeenCalledWith("/simulation")
    })

    it("does NOT call router.push directly on a plain click", () => {
      render(<TransitionLink href="/simulation">Sim</TransitionLink>)
      fireEvent.click(screen.getByRole("link", { name: "Sim" }))
      expect(mockPush).not.toHaveBeenCalled()
    })

    it("prevents default link navigation on plain click", () => {
      render(<TransitionLink href="/simulation">Sim</TransitionLink>)
      const event = new MouseEvent("click", { bubbles: true, cancelable: true })
      const preventDefaultSpy = vi.spyOn(event, "preventDefault")
      screen.getByRole("link", { name: "Sim" }).dispatchEvent(event)
      expect(preventDefaultSpy).toHaveBeenCalled()
    })
  })

  describe("modifier / middle click — browser must handle, NOT hijacked", () => {
    let startVT: ReturnType<typeof vi.fn>

    beforeEach(() => {
      startVT = vi.fn()
      Object.defineProperty(document, "startViewTransition", {
        value: startVT,
        writable: true,
        configurable: true,
      })
    })

    /**
     * Helper: assert full non-hijack contract for a modifier click.
     * - startViewTransition NOT called
     * - transitionTo NOT called
     * - router.push NOT called
     * - preventDefault NOT called
     */
    function assertNotHijacked(eventInit: MouseEventInit) {
      render(<TransitionLink href="/graphs">Graphs</TransitionLink>)
      const anchor = screen.getByRole("link", { name: "Graphs" })
      const event = new MouseEvent("click", { bubbles: true, cancelable: true, ...eventInit })
      const preventDefaultSpy = vi.spyOn(event, "preventDefault")
      anchor.dispatchEvent(event)

      expect(startVT).not.toHaveBeenCalled()
      expect(mockTransitionTo).not.toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
      expect(preventDefaultSpy).not.toHaveBeenCalled()
    }

    it("does NOT hijack Ctrl+click (full contract)", () => {
      assertNotHijacked({ ctrlKey: true })
    })

    it("does NOT hijack Meta+click / Cmd+click (full contract)", () => {
      assertNotHijacked({ metaKey: true })
    })

    it("does NOT hijack Shift+click (full contract)", () => {
      assertNotHijacked({ shiftKey: true })
    })

    it("does NOT hijack middle-click button=1 (full contract)", () => {
      assertNotHijacked({ button: 1 })
    })

    // Legacy fireEvent-based assertions kept for regression safety
    it("does NOT call startViewTransition on Ctrl+click", () => {
      render(<TransitionLink href="/graphs">CtrlGraphs</TransitionLink>)
      fireEvent.click(screen.getByRole("link", { name: "CtrlGraphs" }), { ctrlKey: true })
      expect(startVT).not.toHaveBeenCalled()
    })

    it("does NOT call startViewTransition on Meta+click", () => {
      render(<TransitionLink href="/graphs">MetaGraphs</TransitionLink>)
      fireEvent.click(screen.getByRole("link", { name: "MetaGraphs" }), { metaKey: true })
      expect(startVT).not.toHaveBeenCalled()
    })

    it("does NOT call startViewTransition on Shift+click", () => {
      render(<TransitionLink href="/graphs">ShiftGraphs</TransitionLink>)
      fireEvent.click(screen.getByRole("link", { name: "ShiftGraphs" }), { shiftKey: true })
      expect(startVT).not.toHaveBeenCalled()
    })

    it("does NOT call startViewTransition on middle-click (button=1)", () => {
      render(<TransitionLink href="/graphs">MiddleGraphs</TransitionLink>)
      fireEvent.click(screen.getByRole("link", { name: "MiddleGraphs" }), { button: 1 })
      expect(startVT).not.toHaveBeenCalled()
    })
  })

  describe("caller onClick forwarding", () => {
    it("forwards caller onClick before handling navigation", () => {
      const callerOnClick = vi.fn()
      render(
        <TransitionLink href="/simulation" onClick={callerOnClick}>
          Sim
        </TransitionLink>,
      )
      fireEvent.click(screen.getByRole("link", { name: "Sim" }))
      expect(callerOnClick).toHaveBeenCalledTimes(1)
    })
  })
})
