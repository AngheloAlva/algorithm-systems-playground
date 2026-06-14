/**
 * ThemeToggle — unit tests (REQ-ANIM-1)
 *
 * Spec:
 *   REQ-ANIM-1 — transition-all MUST NOT appear; an explicit property transition utility MUST be present.
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render } from "@testing-library/react"

// ---------------------------------------------------------------------------
// next-themes mock — ThemeToggle calls useTheme()
// ---------------------------------------------------------------------------

vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: "light",
    setTheme: vi.fn(),
  }),
}))

import { ThemeToggle } from "./theme-toggle"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("ThemeToggle", () => {
  it("renders without crashing", () => {
    expect(() => render(<ThemeToggle />)).not.toThrow()
  })

  it("SVG icons inside ThemeToggle do NOT use transition-all (REQ-ANIM-1)", () => {
    const { container } = render(<ThemeToggle />)
    // Only inspect the SVG icon elements (the ones that previously had transition-all).
    // The host Button component may use transition-all in its own className — that is
    // a separate concern; ThemeToggle owns only the icon class strings.
    const svgs = Array.from(container.querySelectorAll("svg"))
    const svgClasses = svgs
      .flatMap((el) => Array.from(el.classList))
      .join(" ")
    expect(svgClasses).not.toContain("transition-all")
  })

  it("SVG icons inside ThemeToggle use an explicit transition property utility (REQ-ANIM-1)", () => {
    const { container } = render(<ThemeToggle />)
    // Only inspect the SVG icon elements for explicit transition utilities.
    const svgs = Array.from(container.querySelectorAll("svg"))
    const svgClasses = svgs
      .flatMap((el) => Array.from(el.classList))
      .join(" ")
    // Must contain an explicit transition utility (transition-colors, transition-transform,
    // transition-opacity, or a custom transition-[...] bracket notation class)
    const hasExplicitTransition =
      svgClasses.includes("transition-colors") ||
      svgClasses.includes("transition-transform") ||
      svgClasses.includes("transition-opacity") ||
      /transition-\[/.test(svgClasses)
    expect(hasExplicitTransition).toBe(true)
  })
})
