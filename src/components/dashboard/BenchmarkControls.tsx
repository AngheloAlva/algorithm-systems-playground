"use client"

/**
 * BenchmarkControls — array length slider + array mode select + Regenerate button.
 *
 * Wired to useDashboardStore. URL sync is handled by DashboardVisualizer on change.
 *
 * Spec: UI-4 (controls), UI-6 (a11y labels)
 */

import { useDashboardStore, DASHBOARD_STORE_DEFAULTS } from "@/store/dashboard-store"
import { ARRAY_MODE, MIN_ARRAY_LENGTH, MAX_ARRAY_LENGTH } from "@/lib/algorithms/sorting/array-gen"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ShuffleIcon } from "lucide-react"

// ---------------------------------------------------------------------------
// Array mode display labels
// ---------------------------------------------------------------------------

const MODE_LABELS: Record<string, string> = {
  [ARRAY_MODE.RANDOM]: "Random",
  [ARRAY_MODE.SORTED]: "Sorted",
  [ARRAY_MODE.REVERSED]: "Reversed",
  [ARRAY_MODE.FEW_UNIQUE]: "Few Unique",
}

// ---------------------------------------------------------------------------
// Props — all wired via store (no external props needed)
// ---------------------------------------------------------------------------

export interface BenchmarkControlsProps {
  /** Called after any config change so the parent can sync URL. */
  onConfigChange?: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BenchmarkControls({ onConfigChange }: BenchmarkControlsProps) {
  const arrayLength = useDashboardStore((s) => s.arrayLength)
  const arrayMode = useDashboardStore((s) => s.arrayMode)
  const setArrayLength = useDashboardStore((s) => s.setArrayLength)
  const setArrayMode = useDashboardStore((s) => s.setArrayMode)
  const regenerate = useDashboardStore((s) => s.regenerate)

  const lengthLabelId = "dashboard-length-label"

  function handleLengthChange(vals: number | readonly number[]) {
    const v = Array.isArray(vals) ? (vals as readonly number[])[0] : (vals as number)
    setArrayLength(v)
    onConfigChange?.()
  }

  function handleModeChange(value: string | null) {
    if (value === null) return
    setArrayMode(value as (typeof ARRAY_MODE)[keyof typeof ARRAY_MODE])
    onConfigChange?.()
  }

  function handleRegenerate() {
    regenerate()
    onConfigChange?.()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Array length slider — UI-4, UI-6 */}
      <div className="flex flex-col gap-2">
        <label
          id={lengthLabelId}
          className="flex items-center justify-between text-xs text-muted-foreground"
        >
          <span>Array Length</span>
          <span className="font-medium tabular-nums text-foreground">{arrayLength}</span>
        </label>
        <Slider
          min={MIN_ARRAY_LENGTH}
          max={MAX_ARRAY_LENGTH}
          step={1}
          value={[arrayLength]}
          onValueChange={handleLengthChange}
          aria-labelledby={lengthLabelId}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{MIN_ARRAY_LENGTH}</span>
          <span>{MAX_ARRAY_LENGTH}</span>
        </div>
      </div>

      {/* Array mode select — UI-4, UI-6 */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="dashboard-mode-select"
          className="text-xs text-muted-foreground"
        >
          Array Mode
        </label>
        <Select
          value={arrayMode}
          onValueChange={handleModeChange}
          defaultValue={DASHBOARD_STORE_DEFAULTS.arrayMode}
        >
          <SelectTrigger
            id="dashboard-mode-select"
            aria-label="Array mode"
            className="w-full"
          >
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {Object.values(ARRAY_MODE).map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {MODE_LABELS[mode] ?? mode}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Regenerate button — bumps seed → new random array */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleRegenerate}
        aria-label="Regenerate — shuffle array with a new seed"
        className="w-full"
      >
        <ShuffleIcon className="h-3.5 w-3.5" />
        <span>Regenerate</span>
      </Button>
    </div>
  )
}
