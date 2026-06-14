/**
 * MetricsTable — unit tests (UI-3)
 *
 * Spec: UI-3 — tabular summary of snapshot results with Algorithm, Comparisons, Swaps.
 * Merge Sort row must have a note marker on the Swaps cell.
 */

import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, screen } from "@testing-library/react"
import type { BarChartRow } from "@/store/dashboard-store"

beforeAll(() => {
  class MutationObserverMock {
    observe = vi.fn()
    disconnect = vi.fn()
    takeRecords = vi.fn(() => [])
  }
  vi.stubGlobal("MutationObserver", MutationObserverMock)
})

import { MetricsTable } from "./MetricsTable"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_ROWS: BarChartRow[] = [
  { algorithm: "bubble", label: "Bubble Sort", comparisons: 100, swaps: 50 },
  { algorithm: "insertion", label: "Insertion Sort", comparisons: 80, swaps: 40 },
  { algorithm: "quick", label: "Quick Sort", comparisons: 30, swaps: 10 },
  { algorithm: "merge", label: "Merge Sort", comparisons: 25, swaps: 0 },
  { algorithm: "heap", label: "Heap Sort", comparisons: 35, swaps: 15 },
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MetricsTable", () => {
  it("renders without crashing with empty rows", () => {
    expect(() => render(<MetricsTable rows={[]} />)).not.toThrow()
  })

  it("renders without crashing with sample rows (UI-3)", () => {
    expect(() => render(<MetricsTable rows={SAMPLE_ROWS} />)).not.toThrow()
  })

  it("renders column headers: Algorithm, Comparisons, Swaps (UI-3)", () => {
    const { container } = render(<MetricsTable rows={SAMPLE_ROWS} />)
    // Query specifically within thead to avoid matching table data or note text
    const headers = container.querySelectorAll("th")
    const headerTexts = Array.from(headers).map((h) => h.textContent?.toLowerCase() ?? "")
    expect(headerTexts.some((t) => t.includes("algorithm"))).toBe(true)
    expect(headerTexts.some((t) => t.includes("comparisons"))).toBe(true)
    expect(headerTexts.some((t) => t.includes("swaps"))).toBe(true)
  })

  it("renders 5 data rows — one per algorithm (UI-3)", () => {
    render(<MetricsTable rows={SAMPLE_ROWS} />)
    // Each algorithm label should appear in the table
    expect(screen.getByText("Bubble Sort")).toBeDefined()
    expect(screen.getByText("Insertion Sort")).toBeDefined()
    expect(screen.getByText("Quick Sort")).toBeDefined()
    expect(screen.getByText("Merge Sort")).toBeDefined()
    expect(screen.getByText("Heap Sort")).toBeDefined()
  })

  it("renders comparisons values (UI-3)", () => {
    render(<MetricsTable rows={SAMPLE_ROWS} />)
    expect(screen.getByText("100")).toBeDefined()
    expect(screen.getByText("25")).toBeDefined()
  })

  it("Merge Sort swaps cell contains a note marker (UI-3)", () => {
    render(<MetricsTable rows={SAMPLE_ROWS} />)
    // Must have a note marker indicating Merge Sort uses PLACE not SWAP
    const mergeNote = screen.getByTestId("table-merge-swaps-note")
    expect(mergeNote).toBeDefined()
  })

  it("renders merge swaps note explaining zero-swap behavior", () => {
    render(<MetricsTable rows={SAMPLE_ROWS} />)
    const note = screen.getByTestId("table-merge-swaps-note")
    // Note must convey information about merge sorting placing elements
    expect(note.textContent).toMatch(/place|merge|0/i)
  })

  it("merge-swaps testid targets the outer span containing the numeric swap value (REQ-CARRY-2)", () => {
    // The testid must be on the outer <span> (not the sr-only inner span),
    // so its textContent includes the numeric swap count for Merge Sort.
    render(<MetricsTable rows={SAMPLE_ROWS} />)
    const outerSpan = screen.getByTestId("table-merge-swaps-note")
    // The outer span's text must include the swap number "0" as rendered numeric value
    // (not just the sr-only label text that also happens to contain "0")
    // We assert the element is NOT the sr-only span by checking it has no sr-only class
    expect(outerSpan.classList.contains("sr-only")).toBe(false)
    // And its text content begins with the numeric value (the outer span renders swap count first)
    expect(outerSpan.textContent).toMatch(/^0/)
  })
})
