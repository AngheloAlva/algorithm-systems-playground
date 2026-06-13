"use client"

/**
 * SimulationVisualizer — "use client" island for the SIRD epidemic simulator.
 *
 * Assembles:
 *   - Toolbar: Play / Pause / Reset buttons (RUN_STATUS-driven disabled states)
 *   - Param sliders: beta, gamma, mu, n, i0 — each calls setParam (resets run)
 *   - Speed slider: calls setSpeed (does NOT reset run) — separate from param sliders
 *   - TimeSeriesChart: S/I/R/D time-series with herd-immunity ReferenceLine
 *   - PhasePlaneChart: parametric I-vs-S trajectory
 *   - SimMetricsPanel: R0/CFR/herd/peak/deaths/duration
 *
 * URL sync (mirrors GraphVisualizer):
 *   - On mount: reads useSearchParams() → simulationCodec.decode → applies via setParam
 *   - On param change: writes URL via simulationCodec.encode + router.replace
 *
 * Spec: SIM6.2, SIM7.4–7.6, SIM8.1
 * Design: §COMPONENT COMPOSITION
 */

import { useCallback, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import {
  useSimulationStore,
  RUN_STATUS,
  selectStatus,
  selectSpeed,
  selectTicks,
  selectSimMetrics,
} from "@/store/simulation-store"
import { useSimulationLoop } from "@/hooks/useSimulationLoop"
import { simulationCodec } from "@/lib/url-state/simulation-codec"
import { SIRD_DEFAULTS } from "@/lib/simulation/sird"
import { MIN_SPEED, MAX_SPEED } from "@/lib/animation/speed-config"

import { TimeSeriesChart } from "./TimeSeriesChart"
import { PhasePlaneChart } from "./PhasePlaneChart"
import { SimMetricsPanel } from "./SimMetricsPanel"
import { ControlPanel } from "@/components/controls/control-panel"
import { Toolbar } from "@/components/controls/toolbar"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { PlayIcon, PauseIcon, RotateCcwIcon } from "lucide-react"

// ---------------------------------------------------------------------------
// Param slider config
// ---------------------------------------------------------------------------

interface ParamSliderConfig {
  key: keyof typeof SIRD_DEFAULTS
  label: string
  min: number
  max: number
  step: number
}

const PARAM_SLIDERS: ParamSliderConfig[] = [
  {
    key: "beta",
    label: "β (Transmission)",
    min: 0.01,
    max: 1.0,
    step: 0.01,
  },
  {
    key: "gamma",
    label: "γ (Recovery)",
    min: 0.0,
    max: 0.5,
    step: 0.01,
  },
  {
    key: "mu",
    label: "μ (Mortality)",
    min: 0.0,
    max: 0.1,
    step: 0.001,
  },
  {
    key: "n",
    label: "Population (N)",
    min: 100,
    max: 10000,
    step: 100,
  },
  {
    key: "i0",
    label: "Initial infected (I₀)",
    min: 1,
    max: 100,
    step: 1,
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SimulationVisualizer() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // -------------------------------------------------------------------------
  // Store subscriptions (narrow selectors — SIM8.1)
  // -------------------------------------------------------------------------

  const status = useSimulationStore(selectStatus)
  const speed = useSimulationStore(selectSpeed)
  const ticks = useSimulationStore(selectTicks)
  const metrics = useSimulationStore(selectSimMetrics)
  const params = useSimulationStore((s) => s.params)

  const play = useSimulationStore((s) => s.play)
  const pause = useSimulationStore((s) => s.pause)
  const reset = useSimulationStore((s) => s.reset)
  const setParam = useSimulationStore((s) => s.setParam)
  const setSpeed = useSimulationStore((s) => s.setSpeed)
  const step = useSimulationStore((s) => s.step)

  // -------------------------------------------------------------------------
  // rAF-driven simulation loop
  // -------------------------------------------------------------------------

  const isRunning = status === RUN_STATUS.RUNNING
  useSimulationLoop({ speed, isRunning, step })

  // -------------------------------------------------------------------------
  // URL sync — read once on mount, write explicitly on param change
  // (mirrors GraphVisualizer's mount-read / explicit-write pattern)
  // -------------------------------------------------------------------------

  const urlSyncedRef = useRef(false)

  useEffect(() => {
    if (urlSyncedRef.current) return
    urlSyncedRef.current = true
    const decoded = simulationCodec.decode(searchParams)
    const current = useSimulationStore.getState().params
    // Only apply params that differ from current store state.
    // This avoids unnecessary setParam calls (which reset the run) when the
    // URL carries default values — mirrors GraphVisualizer's "only set if changed" pattern.
    if (decoded.beta !== current.beta) setParam("beta", decoded.beta)
    if (decoded.gamma !== current.gamma) setParam("gamma", decoded.gamma)
    if (decoded.mu !== current.mu) setParam("mu", decoded.mu)
    if (decoded.n !== current.n) setParam("n", decoded.n)
    if (decoded.i0 !== current.i0) setParam("i0", decoded.i0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const syncUrl = useCallback(() => {
    // Read params from the store directly so we always get the latest values,
    // not a stale closure snapshot. This mirrors the mount-decode path which
    // also uses getState() (see urlSyncedRef effect above).
    // The store is updated synchronously by setParam before the microtask fires,
    // so getState().params always returns the current values here.
    const liveParams = useSimulationStore.getState().params
    const urlState = {
      beta: liveParams.beta,
      gamma: liveParams.gamma,
      mu: liveParams.mu,
      n: liveParams.n,
      i0: liveParams.i0,
    }
    const urlParams = simulationCodec.encode(urlState)
    const qs = urlParams.toString()
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false })
  }, [router])

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------

  const isIdle = status === RUN_STATUS.IDLE
  const isDone = status === RUN_STATUS.DONE

  // Herd-immunity y value for the time-series chart ReferenceLine (ADR-4)
  // = threshold fraction × N (population count)
  const herdLine =
    metrics.herdImmunityThreshold > 0
      ? metrics.herdImmunityThreshold * params.n
      : null

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleParamChange = useCallback(
    (key: keyof typeof SIRD_DEFAULTS, value: number) => {
      setParam(key, value)
      // Sync URL after param change (mirrors GraphVisualizer syncUrl pattern).
      // We schedule as a micro-task so the store has updated before we read params.
      Promise.resolve().then(syncUrl)
    },
    [setParam, syncUrl]
  )

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Playback toolbar */}
      <Toolbar>
        <span className="text-muted-foreground text-xs font-medium mr-1">Simulation:</span>

        <Button
          size="sm"
          variant="outline"
          onClick={play}
          disabled={isRunning || isDone}
          aria-label="Play"
          aria-disabled={isRunning || isDone}
          className="h-8"
        >
          <PlayIcon className="h-3 w-3" />
          <span className="ml-1 text-xs">Play</span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={pause}
          disabled={isIdle || isDone}
          aria-label="Pause"
          aria-disabled={isIdle || isDone}
          className="h-8"
        >
          <PauseIcon className="h-3 w-3" />
          <span className="ml-1 text-xs">Pause</span>
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={reset}
          aria-label="Reset"
          className="h-8"
        >
          <RotateCcwIcon className="h-3 w-3" />
          <span className="ml-1 text-xs">Reset</span>
        </Button>

        <div className="flex-1" />

        {/* Status badge */}
        <span className="text-muted-foreground text-xs capitalize">{status}</span>
      </Toolbar>

      {/* Main content area */}
      <div className="flex flex-1 gap-4">
        {/* Charts column */}
        <div className="flex flex-1 flex-col gap-4">
          <ControlPanel title="Time Series (S / I / R / D)">
            <TimeSeriesChart ticks={ticks} herdLine={herdLine} />
          </ControlPanel>

          <ControlPanel title="Phase Plane (I vs S)">
            <PhasePlaneChart ticks={ticks} />
          </ControlPanel>
        </div>

        {/* Right panel */}
        <div className="flex w-64 flex-col gap-3">
          {/* Metrics */}
          <SimMetricsPanel metrics={metrics} status={status} />

          {/* Param sliders — SIM7.4 */}
          <ControlPanel title="Parameters">
            <div className="flex flex-col gap-3">
              {PARAM_SLIDERS.map(({ key, label, min, max, step }) => {
                const labelId = `sim-param-label-${key}`
                return (
                  <div key={key} className="flex flex-col gap-1">
                    <label
                      id={labelId}
                      className="text-muted-foreground text-xs flex justify-between"
                    >
                      <span>{label}</span>
                      <span className="font-medium tabular-nums text-foreground">
                        {params[key]}
                      </span>
                    </label>
                    <Slider
                      min={min}
                      max={max}
                      step={step}
                      value={[params[key] as number]}
                      onValueChange={(vals) => {
                        const v = Array.isArray(vals) ? vals[0] : vals
                        handleParamChange(key, v as number)
                      }}
                      aria-labelledby={labelId}
                      className="w-full"
                    />
                  </div>
                )
              })}
            </div>
          </ControlPanel>

          {/* Speed slider — SIM7.5 (separate — does NOT reset run) */}
          <ControlPanel title="Speed">
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">
                Speed: {speed}
              </span>
              <Slider
                min={MIN_SPEED}
                max={MAX_SPEED}
                step={1}
                value={[speed]}
                onValueChange={(vals) => {
                  const v = Array.isArray(vals) ? vals[0] : vals
                  setSpeed(v as number)
                }}
                aria-label="Playback speed"
                className="w-full"
              />
            </div>
          </ControlPanel>
        </div>
      </div>
    </div>
  )
}
