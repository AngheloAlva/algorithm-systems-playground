/**
 * BenchmarkControls — unit tests (UI-4, UI-6)
 *
 * Spec:
 *   UI-4 — array-length slider (min 5, max 200), mode select, Regenerate button
 *   UI-6 — all controls have accessible labels
 *
 * Strategy: mock next/navigation (router), control store directly.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"

// ---------------------------------------------------------------------------
// next/navigation mock
// ---------------------------------------------------------------------------

const mockReplace = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => ({ get: () => null, toString: () => "" }),
}))

beforeAll(() => {
  class MutationObserverMock {
    observe = vi.fn()
    disconnect = vi.fn()
    takeRecords = vi.fn(() => [])
  }
  vi.stubGlobal("MutationObserver", MutationObserverMock)

  class ResizeObserverMock {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverMock)
})

import { useDashboardStore } from "@/store/dashboard-store"
import { BenchmarkControls } from "./BenchmarkControls"

function resetStore() {
  useDashboardStore.setState({
    arrayLength: 50,
    arrayMode: "random",
    seed: 42,
    snapshot: null,
    sweep: null,
    status: "idle",
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  resetStore()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BenchmarkControls", () => {
  it("renders without crashing (UI-4)", () => {
    expect(() => render(<BenchmarkControls />)).not.toThrow()
  })

  it("renders an array length slider (UI-4)", () => {
    const { container } = render(<BenchmarkControls />)
    const slider = container.querySelector("[data-slot='slider']")
    expect(slider).toBeTruthy()
  })

  it("slider has an accessible label — UI-6", () => {
    const { container } = render(<BenchmarkControls />)
    // Slider must have aria-label or aria-labelledby
    const slider = container.querySelector("[data-slot='slider']")
    const hasAriaLabel =
      slider?.hasAttribute("aria-label") ||
      slider?.hasAttribute("aria-labelledby")
    expect(hasAriaLabel).toBe(true)
  })

  it("displays the current array length value", () => {
    render(<BenchmarkControls />)
    // The store default is 50 — some text showing 50 or "50" must be present
    expect(screen.getByText(/50/)).toBeDefined()
  })

  it("renders a Regenerate button (UI-4)", () => {
    render(<BenchmarkControls />)
    const btn = screen.getByRole("button", { name: /regenerate/i })
    expect(btn).toBeDefined()
  })

  it("Regenerate button calls store regenerate()", () => {
    const regenerateSpy = vi.fn()
    useDashboardStore.setState({ regenerate: regenerateSpy })

    render(<BenchmarkControls />)
    fireEvent.click(screen.getByRole("button", { name: /regenerate/i }))
    expect(regenerateSpy).toHaveBeenCalledTimes(1)
  })

  it("slider onValueChange wires through to store arrayLength (UI-4, spec)", () => {
    // Spy on setArrayLength to assert the control→store chain
    const setArrayLengthSpy = vi.fn()
    useDashboardStore.setState({ setArrayLength: setArrayLengthSpy })

    const { container } = render(<BenchmarkControls />)

    // Trigger the slider's onValueChange with value 120
    // The Radix Slider fires onValueChange with a number[] array
    const sliderRoot = container.querySelector("[data-slot='slider']")
    expect(sliderRoot).toBeTruthy()

    // Fire the change event at the internal input (Radix exposes a hidden input)
    const input = container.querySelector("input[type='range']")
    if (input) {
      fireEvent.change(input, { target: { value: "120" } })
    }

    // Verify store is updated via setArrayLength
    expect(setArrayLengthSpy).toHaveBeenCalledWith(120)
    expect(useDashboardStore.getState().arrayLength).not.toBe(120) // spy replaced real fn
  })

  it("mode-select onValueChange wires through to store setArrayMode (REQ-CARRY-1)", async () => {
    // Spy on setArrayMode to assert the control→store chain
    const setArrayModeSpy = vi.fn()
    useDashboardStore.setState({ setArrayMode: setArrayModeSpy })

    const { container } = render(<BenchmarkControls />)

    // Base UI Select renders a visually-hidden <input aria-hidden="true"> for form/autofill.
    // Firing a change event on it (with a valid mode value) exercises the component's
    // onValueChange → handleModeChange → setArrayMode path via queueMicrotask.
    const hiddenInput = container.querySelector('input[aria-hidden="true"]')
    expect(hiddenInput).toBeTruthy()

    await act(async () => {
      fireEvent.change(hiddenInput!, { target: { value: "sorted" } })
      // Flush the queueMicrotask scheduled inside Base UI's hidden input onChange handler
      await Promise.resolve()
    })

    // setArrayMode should be called once with the selected mode
    expect(setArrayModeSpy).toHaveBeenCalledOnce()
    expect(setArrayModeSpy).toHaveBeenCalledWith("sorted")
  })
})
