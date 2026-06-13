/**
 * SimulationVisualizer — integration tests (SIM6.2, SIM7.4–7.6)
 *
 * Tests:
 *   - Component renders without crashing
 *   - Play/Pause/Reset buttons are present and wired to store
 *   - Param sliders (5) dispatch setParam
 *   - Speed slider dispatches setSpeed (no reset)
 *   - Charts and metrics panel are rendered
 *   - URL sync on mount (reads searchParams)
 *   - Status-driven button disabled states
 *
 * Strategy: mock next/navigation, mock recharts, mock child components, and
 * control simulation-store directly (no rAF, no real timing).
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"

// ---------------------------------------------------------------------------
// next/navigation mock
// ---------------------------------------------------------------------------

const mockReplace = vi.fn()
const mockSearchParams: { get: (key: string) => string | null; toString: () => string } = {
  get: () => null,
  toString: () => "",
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}))

// ---------------------------------------------------------------------------
// Recharts mock (same as chart tests)
// ---------------------------------------------------------------------------

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ children, data }: { children?: React.ReactNode; data?: unknown[] }) => (
    <div data-testid="line-chart" data-points={String(data?.length ?? 0)}>
      {children}
    </div>
  ),
  Line: ({ dataKey }: { dataKey: string }) => <div data-testid={`line-${dataKey}`} />,
  XAxis: ({ dataKey, type }: { dataKey?: string; type?: string }) => (
    <div data-testid="x-axis" data-key={dataKey ?? ""} data-type={type ?? ""} />
  ),
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ReferenceLine: ({ y }: { y?: number }) => (
    <div data-testid="reference-line" data-y={y} />
  ),
  Legend: () => <div data-testid="legend" />,
}))

// ---------------------------------------------------------------------------
// jsdom stubs
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Import store AFTER mocks (so vi.mock hoisting works correctly)
// ---------------------------------------------------------------------------

import { useSimulationStore, getInitialState, RUN_STATUS } from "@/store/simulation-store"
import { SimulationVisualizer } from "./SimulationVisualizer"

// ---------------------------------------------------------------------------
// Reset store before each test
// NOTE: getInitialState() returns data-only (no action functions). We use
// setState with replace=false (merge) so actions are preserved.
// ---------------------------------------------------------------------------

function resetStore() {
  // Merge data fields back to initial values (do NOT replace — that strips actions)
  useSimulationStore.setState(getInitialState(), false)
}

beforeEach(() => {
  vi.clearAllMocks()
  resetStore()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SimulationVisualizer — mount", () => {
  it("renders without crashing", () => {
    expect(() => render(<SimulationVisualizer />)).not.toThrow()
  })

  it("renders a Play button", () => {
    render(<SimulationVisualizer />)
    expect(screen.getByRole("button", { name: /play/i })).toBeDefined()
  })

  it("renders a Pause button", () => {
    render(<SimulationVisualizer />)
    expect(screen.getByRole("button", { name: /pause/i })).toBeDefined()
  })

  it("renders a Reset button", () => {
    render(<SimulationVisualizer />)
    expect(screen.getByRole("button", { name: /reset/i })).toBeDefined()
  })

  it("renders the time-series chart area", () => {
    render(<SimulationVisualizer />)
    // TimeSeriesChart renders line-s line-i line-r line-d
    expect(screen.getByTestId("line-s")).toBeDefined()
  })

  it("renders the phase-plane chart area", () => {
    render(<SimulationVisualizer />)
    // PhasePlaneChart renders a line-y
    expect(screen.getByTestId("line-y")).toBeDefined()
  })

  it("renders metrics panel with label R₀ or R0", () => {
    render(<SimulationVisualizer />)
    expect(screen.getByText(/R[₀0]/)).toBeDefined()
  })

  it("renders 5 param sliders (beta, gamma, mu, n, i0) — SIM7.4", () => {
    const { container } = render(<SimulationVisualizer />)
    // Base UI Slider renders with data-slot="slider"; count them.
    // 5 param sliders + 1 speed slider = 6 total.
    const sliders = container.querySelectorAll("[data-slot='slider']")
    expect(sliders.length).toBeGreaterThanOrEqual(5)
  })

  it("renders a speed slider — SIM7.5", () => {
    const { container } = render(<SimulationVisualizer />)
    // At least 1 slider for speed (plus 5 param sliders)
    const sliders = container.querySelectorAll("[data-slot='slider']")
    expect(sliders.length).toBeGreaterThanOrEqual(1)
    // Speed label text should be present
    expect(screen.getByText(/Speed:/)).toBeDefined()
  })
})

describe("SimulationVisualizer — playback controls (SIM7.6)", () => {
  it("Play button calls store play()", () => {
    const playSpy = vi.fn()
    useSimulationStore.setState({ play: playSpy })

    render(<SimulationVisualizer />)
    fireEvent.click(screen.getByRole("button", { name: /play/i }))
    expect(playSpy).toHaveBeenCalledTimes(1)
  })

  it("Pause button calls store pause()", () => {
    const pauseSpy = vi.fn()
    // Set status to RUNNING so Pause button is enabled
    useSimulationStore.setState({ status: RUN_STATUS.RUNNING, pause: pauseSpy })

    render(<SimulationVisualizer />)
    fireEvent.click(screen.getByRole("button", { name: /pause/i }))
    expect(pauseSpy).toHaveBeenCalledTimes(1)
  })

  it("Reset button calls store reset()", () => {
    const resetSpy = vi.fn()
    useSimulationStore.setState({ reset: resetSpy })

    render(<SimulationVisualizer />)
    fireEvent.click(screen.getByRole("button", { name: /reset/i }))
    expect(resetSpy).toHaveBeenCalledTimes(1)
  })

  it("Play button is disabled when status is RUNNING (SIM7.6 disabled states)", () => {
    // Set state BEFORE render so the component mounts with RUNNING status
    useSimulationStore.setState({ status: RUN_STATUS.RUNNING })
    const { getByRole } = render(<SimulationVisualizer />)
    const playBtn = getByRole("button", { name: /play/i })
    expect(playBtn).toBeDisabled()
  })

  it("Pause button is disabled when status is IDLE", () => {
    // Default state is IDLE — Pause should be disabled
    const { getByRole } = render(<SimulationVisualizer />)
    const pauseBtn = getByRole("button", { name: /pause/i })
    expect(pauseBtn).toBeDisabled()
  })

  it("Pause button is disabled when status is DONE", () => {
    useSimulationStore.setState({ status: RUN_STATUS.DONE })
    const { getByRole } = render(<SimulationVisualizer />)
    const pauseBtn = getByRole("button", { name: /pause/i })
    expect(pauseBtn).toBeDisabled()
  })
})

describe("SimulationVisualizer — URL sync on mount", () => {
  it("reads searchParams on mount (codec.decode called)", () => {
    // Provide a non-default beta value in URL params
    mockSearchParams.get = (key: string) => (key === "b" ? "0.5" : null)

    render(<SimulationVisualizer />)

    // After mount, store beta should be 0.5 (applied via setParam)
    const params = useSimulationStore.getState().params
    expect(params.beta).toBe(0.5)
  })

  it("writes URL containing the NEW param value when a param changes (FIX 2 — stale-closure regression)", async () => {
    // This test exercises the handleParamChange → syncUrl path to verify the
    // stale-closure bug is fixed.
    //
    // Bug BEFORE FIX 2: syncUrl closes over the stale `params` snapshot from
    // the last render, so router.replace encodes the OLD value even though
    // setParam already updated the store.
    // After FIX 2: syncUrl calls useSimulationStore.getState().params, reading
    // the fresh store value, so router.replace encodes the NEW value.
    //
    // Strategy: set beta to a non-default value (0.3) so the component renders
    // with beta=0.3 in its closure. Then trigger handleParamChange("beta", 0.5)
    // by finding the beta slider element and invoking its onValueChange through
    // the React fiber (the most direct path without a native <input type=range>).
    // Flush the Promise microtask and assert router.replace was called with b=0.5.

    // Start with beta=0.3 so closure captures 0.3
    useSimulationStore.setState((s) => ({ params: { ...s.params, beta: 0.3 } }))
    const { container } = render(<SimulationVisualizer />)
    mockReplace.mockClear()

    // Find the slider Root elements (data-slot="slider"); the beta slider is first.
    const sliderRoots = container.querySelectorAll("[data-slot='slider']")
    const betaSliderRoot = sliderRoots[0] as HTMLElement

    // Extract the onValueChange prop from the React fiber and call it directly.
    // This is the same handler the Slider's internal thumb fires on drag.
    type FiberNode = { memoizedProps?: Record<string, unknown>; return?: FiberNode }
    const getFiberProp = (el: HTMLElement, prop: string): unknown => {
      const key = Object.keys(el).find((k) => k.startsWith("__reactFiber") || k.startsWith("__reactInternalInstance"))
      if (!key) return undefined
      let fiber = (el as unknown as Record<string, FiberNode>)[key]
      while (fiber) {
        if (fiber.memoizedProps && prop in fiber.memoizedProps) {
          return fiber.memoizedProps[prop]
        }
        fiber = fiber.return as FiberNode
      }
      return undefined
    }

    const onValueChange = getFiberProp(betaSliderRoot, "onValueChange") as ((v: number[]) => void) | undefined

    if (onValueChange) {
      // Call through the component's actual handler — this exercises handleParamChange
      await act(async () => {
        onValueChange([0.5])
        await Promise.resolve()
      })
    } else {
      // Fallback: the fiber walk could not locate onValueChange (e.g. the fiber
      // key changed between React versions). We call setParam directly, which
      // updates the store but does NOT invoke syncUrl — the URL write will NOT
      // happen through this path. This fallback will cause the router.replace
      // assertion below to fail loudly, surfacing the broken primary path rather
      // than silently passing with an inaccurate signal.
      await act(async () => {
        useSimulationStore.getState().setParam("beta", 0.5)
        await Promise.resolve()
        await Promise.resolve()
      })
    }

    // router.replace must have been called after the microtask flush
    expect(mockReplace).toHaveBeenCalled()
    // The URL must encode the NEW value (0.5), NOT the stale closure value (0.3).
    // Before FIX 1 this fails because syncUrl reads the stale closure params.beta=0.3.
    // After FIX 1 this passes because syncUrl reads getState().params.beta=0.5.
    const callUrl = mockReplace.mock.calls[mockReplace.mock.calls.length - 1][0] as string
    expect(callUrl).toContain("b=0.5")
  })
})

describe("SimulationVisualizer — speed slider (SIM7.5 — no reset)", () => {
  it("speed change does not reset store ticks", () => {
    // Mount first (URL sync fires setParam which resets ticks — that's expected)
    render(<SimulationVisualizer />)

    // THEN inject ticks (after URL sync has fired)
    const fakeTick = { day: 1, s: 990, i: 9, r: 0.5, d: 0.5 }
    act(() => {
      useSimulationStore.setState({ ticks: [fakeTick] })
    })
    expect(useSimulationStore.getState().ticks).toHaveLength(1)

    // Now call setSpeed — must NOT clear ticks (SIM7.5 / SIM3.3-b)
    act(() => {
      useSimulationStore.getState().setSpeed(6)
    })

    expect(useSimulationStore.getState().ticks).toHaveLength(1)
    expect(useSimulationStore.getState().speed).toBe(6)
  })
})

describe("SimulationVisualizer — slider a11y (FIX 4)", () => {
  it("each param slider is programmatically associated with its visible label via aria-labelledby", () => {
    const { container } = render(<SimulationVisualizer />)

    // Each param slider group renders:
    //   <label id="sim-param-label-{key}">…label text…</label>
    //   <Slider aria-labelledby="sim-param-label-{key}" />  (Slider root = div[role="group"])
    //
    // We verify the full association chain for each param: the label id exists in the DOM,
    // the slider carries aria-labelledby pointing to it, and the label's text content
    // matches the visible label string. This test FAILS if htmlFor self-reference is
    // re-introduced or if aria-labelledby is removed or points to a missing element.

    const PARAM_KEYS = ["beta", "gamma", "mu", "n", "i0"] as const
    const EXPECTED_LABEL_TEXT: Record<string, RegExp> = {
      beta: /β.*Transmission/i,
      gamma: /γ.*Recovery/i,
      mu: /μ.*Mortality/i,
      n: /Population/i,
      i0: /Initial infected/i,
    }

    for (const key of PARAM_KEYS) {
      const labelId = `sim-param-label-${key}`

      // 1. Label element with the expected id must exist
      const labelEl = container.querySelector<HTMLElement>(`#${labelId}`)
      expect(labelEl, `Expected <label id="${labelId}"> for param "${key}"`).toBeTruthy()

      // 2. Label text must match the visible label string
      expect(
        labelEl?.textContent,
        `Label "${labelId}" text should match ${EXPECTED_LABEL_TEXT[key]}`
      ).toMatch(EXPECTED_LABEL_TEXT[key])

      // 3. A slider root with aria-labelledby pointing to this label must exist
      const slider = container.querySelector<HTMLElement>(
        `[data-slot='slider'][aria-labelledby='${labelId}']`
      )
      expect(
        slider,
        `Expected <Slider aria-labelledby="${labelId}"> for param "${key}" — association broken`
      ).toBeTruthy()

      // 4. The label must NOT have htmlFor (self-referencing htmlFor on a div[role="group"] is invalid)
      expect(
        labelEl?.getAttribute("for"),
        `Label "${labelId}" must not carry htmlFor — Slider root is a div, not a labelable control`
      ).toBeNull()
    }
  })
})
