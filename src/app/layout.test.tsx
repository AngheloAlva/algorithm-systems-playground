/**
 * RootLayout — unit tests for skip link and main landmark (REQ-A11Y-1, REQ-A11Y-2)
 *
 * NOTE: layout.tsx uses next/font/google and complex UI deps. We mock the heavy imports
 * and test only the structural accessibility concerns added in Slice A.
 *
 * Focus/keyboard behavior of the skip link is only fully verifiable in a real browser;
 * that is deferred to Slice D's E2E specs (see apply-progress notes).
 */

import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"

// ---------------------------------------------------------------------------
// Mocks — isolate layout from Next.js infrastructure
// ---------------------------------------------------------------------------

// Mock next/font/google so Geist/Geist_Mono don't error in jsdom
vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans", className: "font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono", className: "font-geist-mono" }),
}))

// Mock globals.css import (no-op in test environment)
vi.mock("./globals.css", () => ({}))

// Mock complex layout components to isolate structural concerns
vi.mock("@/components/layout/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/layout/app-sidebar", () => ({
  AppSidebar: () => <aside data-testid="mock-sidebar" />,
}))

vi.mock("@/components/layout/site-header", () => ({
  SiteHeader: () => <header data-testid="mock-header" />,
}))

vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SidebarInset: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <main data-slot="sidebar-inset" {...props}>{children}</main>
  ),
}))

vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import RootLayout from "./layout"

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RootLayout", () => {
  it("renders a skip link as the first focusable element (REQ-A11Y-1)", () => {
    const { container } = render(
      <RootLayout>
        <p>page content</p>
      </RootLayout>
    )
    const skipLink = container.querySelector('a[href="#main-content"]')
    expect(skipLink).toBeTruthy()
    expect(skipLink?.textContent?.toLowerCase()).toContain("skip")
  })

  it("skip link has sr-only class for visually hidden when not focused (REQ-A11Y-1)", () => {
    const { container } = render(
      <RootLayout>
        <p>page content</p>
      </RootLayout>
    )
    const skipLink = container.querySelector('a[href="#main-content"]')
    expect(skipLink).toBeTruthy()
    // Must have sr-only to be visually hidden when not focused
    expect(skipLink?.classList.contains("sr-only")).toBe(true)
  })

  it("layout has exactly one <main> landmark (REQ-A11Y-2)", () => {
    const { container } = render(
      <RootLayout>
        <p>page content</p>
      </RootLayout>
    )
    const mains = container.querySelectorAll("main")
    expect(mains.length).toBe(1)
  })

  it("the single <main> has id=main-content and tabIndex=-1 (REQ-A11Y-1)", () => {
    const { container } = render(
      <RootLayout>
        <p>page content</p>
      </RootLayout>
    )
    const main = container.querySelector("main")
    expect(main).toBeTruthy()
    expect(main?.id).toBe("main-content")
    expect(main?.getAttribute("tabindex")).toBe("-1")
  })

  it("skip link is the first child element of body — DOM ordering (WCAG 2.4.1)", () => {
    const { container } = render(
      <RootLayout>
        <p>page content</p>
      </RootLayout>
    )
    // RTL wraps the rendered output in a <div> container appended to document.body.
    // When layout.tsx renders <html><body>…</body></html>, jsdom absorbs those outer
    // tags and places the body children inside the RTL container div.
    // The skip link must be the FIRST element child of that container (before sidebar,
    // before header) so keyboard users encounter it before any navigation.
    const skipLink = container.querySelector('a[href="#main-content"]')
    expect(skipLink).toBeTruthy()
    expect(container.firstElementChild).toBe(skipLink)
  })
})
