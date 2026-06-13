/**
 * Tests for the dashboard Zustand store.
 *
 * Covers:
 * - STORE-1: setArrayLength clamps to [5, 200]
 * - STORE-2: results populated after recompute() (5 snapshot rows, 5 sweep points)
 * - STORE-3: status lifecycle (idle → done after recompute)
 * - Selector shapes: selectBarChartData, selectSweepChartData
 */

import { describe, it, expect, beforeEach } from "vitest"
import {
  useDashboardStore,
  selectConfig,
  selectSnapshot,
  selectSweep,
  selectStatus,
  selectBarChartData,
  selectSweepChartData,
  DASHBOARD_STORE_DEFAULTS,
} from "./dashboard-store"
import { RUN_STATUS } from "./pathfinding-store"

// Helper: grab the raw store state directly (outside React)
function getState() {
  return useDashboardStore.getState()
}

// Reset store to defaults before each test to avoid cross-test pollution.
beforeEach(() => {
  useDashboardStore.setState({
    arrayLength: DASHBOARD_STORE_DEFAULTS.arrayLength,
    arrayMode: DASHBOARD_STORE_DEFAULTS.arrayMode,
    seed: DASHBOARD_STORE_DEFAULTS.seed,
    snapshot: null,
    sweep: null,
    status: RUN_STATUS.IDLE,
  })
})

describe("useDashboardStore", () => {
  // ---------------------------------------------------------------------------
  // STORE-1: setArrayLength clamps
  // ---------------------------------------------------------------------------

  describe("setArrayLength", () => {
    it("clamps values below minimum (0 → 5)", () => {
      getState().setArrayLength(0)
      expect(useDashboardStore.getState().arrayLength).toBe(5)
    })

    it("clamps values below minimum (-100 → 5)", () => {
      getState().setArrayLength(-100)
      expect(useDashboardStore.getState().arrayLength).toBe(5)
    })

    it("clamps values above maximum (9999 → 200)", () => {
      getState().setArrayLength(9999)
      expect(useDashboardStore.getState().arrayLength).toBe(200)
    })

    it("accepts values within range (120 → 120)", () => {
      getState().setArrayLength(120)
      expect(useDashboardStore.getState().arrayLength).toBe(120)
    })

    it("accepts boundary value 5", () => {
      getState().setArrayLength(5)
      expect(useDashboardStore.getState().arrayLength).toBe(5)
    })

    it("accepts boundary value 200", () => {
      getState().setArrayLength(200)
      expect(useDashboardStore.getState().arrayLength).toBe(200)
    })

    it("populates snapshot (not null) and sets status to DONE after call", () => {
      getState().setArrayLength(100)
      const state = useDashboardStore.getState()
      expect(state.snapshot).not.toBeNull()
      expect(state.status).toBe(RUN_STATUS.DONE)
    })
  })

  // ---------------------------------------------------------------------------
  // setSeed
  // ---------------------------------------------------------------------------

  describe("setSeed", () => {
    it("sets seed to the given value", () => {
      getState().setSeed(7)
      expect(useDashboardStore.getState().seed).toBe(7)
    })

    it("triggers recompute — snapshot is populated after setSeed", () => {
      getState().setSeed(99)
      const state = useDashboardStore.getState()
      expect(state.snapshot).not.toBeNull()
      expect(state.sweep).not.toBeNull()
      expect(state.status).toBe(RUN_STATUS.DONE)
    })

    it("is deterministic: setSeed(7) produces same snapshot as config with seed=7", () => {
      getState().setSeed(7)
      const rows1 = useDashboardStore.getState().snapshot!.rows

      useDashboardStore.setState({
        arrayLength: DASHBOARD_STORE_DEFAULTS.arrayLength,
        arrayMode: DASHBOARD_STORE_DEFAULTS.arrayMode,
        seed: 7,
        snapshot: null,
        sweep: null,
        status: RUN_STATUS.IDLE,
      })
      getState().recompute()
      const rows2 = useDashboardStore.getState().snapshot!.rows

      expect(rows1).toEqual(rows2)
    })
  })

  // ---------------------------------------------------------------------------
  // setArrayMode
  // ---------------------------------------------------------------------------

  describe("setArrayMode", () => {
    it("updates arrayMode", () => {
      getState().setArrayMode("reversed")
      expect(useDashboardStore.getState().arrayMode).toBe("reversed")
    })

    it("populates snapshot (not null) and sets status to DONE after call", () => {
      getState().setArrayMode("sorted")
      const state = useDashboardStore.getState()
      expect(state.snapshot).not.toBeNull()
      expect(state.status).toBe(RUN_STATUS.DONE)
    })
  })

  // ---------------------------------------------------------------------------
  // regenerate
  // ---------------------------------------------------------------------------

  describe("regenerate", () => {
    it("changes the seed value", () => {
      const before = useDashboardStore.getState().seed
      getState().regenerate()
      const after = useDashboardStore.getState().seed
      expect(after).not.toBe(before)
    })

    it("increments seed by exactly 1", () => {
      const before = useDashboardStore.getState().seed
      getState().regenerate()
      expect(useDashboardStore.getState().seed).toBe(before + 1)
    })

    it("populates snapshot and sweep after call (recompute ran)", () => {
      getState().regenerate()
      const state = useDashboardStore.getState()
      expect(state.snapshot).not.toBeNull()
      expect(state.sweep).not.toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // STORE-3: status lifecycle
  // ---------------------------------------------------------------------------

  describe("status", () => {
    it("starts as IDLE before any recompute", () => {
      expect(useDashboardStore.getState().status).toBe(RUN_STATUS.IDLE)
    })

    it("becomes DONE after recompute()", () => {
      getState().recompute()
      expect(useDashboardStore.getState().status).toBe(RUN_STATUS.DONE)
    })
  })

  // ---------------------------------------------------------------------------
  // STORE-2: results populated after recompute
  // ---------------------------------------------------------------------------

  describe("recompute", () => {
    it("populates snapshot with 5 rows (one per algorithm)", () => {
      getState().recompute()
      const snapshot = useDashboardStore.getState().snapshot
      expect(snapshot).not.toBeNull()
      expect(snapshot!.rows).toHaveLength(5)
    })

    it("each snapshot row has algorithm, label, comparisons, swaps, steps", () => {
      getState().recompute()
      const rows = useDashboardStore.getState().snapshot!.rows
      for (const row of rows) {
        expect(typeof row.algorithm).toBe("string")
        expect(typeof row.label).toBe("string")
        expect(typeof row.comparisons).toBe("number")
        expect(row.comparisons).toBeGreaterThanOrEqual(0)
        expect(typeof row.swaps).toBe("number")
        expect(row.swaps).toBeGreaterThanOrEqual(0)
        expect(typeof row.steps).toBe("number")
        expect(row.steps).toBeGreaterThanOrEqual(0)
      }
    })

    it("populates sweep with 5 points (one per SWEEP_SIZES entry)", () => {
      getState().recompute()
      const sweep = useDashboardStore.getState().sweep
      expect(sweep).not.toBeNull()
      expect(sweep!.points).toHaveLength(5)
    })

    it("each sweep point has n and comparisons for all 5 algorithms", () => {
      getState().recompute()
      const points = useDashboardStore.getState().sweep!.points
      for (const point of points) {
        expect(typeof point.n).toBe("number")
        expect(point.n).toBeGreaterThan(0)
        expect(typeof point.comparisons.bubble).toBe("number")
        expect(typeof point.comparisons.insertion).toBe("number")
        expect(typeof point.comparisons.quick).toBe("number")
        expect(typeof point.comparisons.merge).toBe("number")
        expect(typeof point.comparisons.heap).toBe("number")
      }
    })

    it("is deterministic: same config produces identical snapshot rows", () => {
      getState().recompute()
      const rows1 = useDashboardStore.getState().snapshot!.rows

      getState().recompute()
      const rows2 = useDashboardStore.getState().snapshot!.rows

      expect(rows1).toEqual(rows2)
    })
  })

  // ---------------------------------------------------------------------------
  // Selectors
  // ---------------------------------------------------------------------------

  describe("selectConfig", () => {
    it("returns arrayLength, arrayMode, seed", () => {
      const state = useDashboardStore.getState()
      const config = selectConfig(state)
      expect(config).toEqual({
        arrayLength: DASHBOARD_STORE_DEFAULTS.arrayLength,
        arrayMode: DASHBOARD_STORE_DEFAULTS.arrayMode,
        seed: DASHBOARD_STORE_DEFAULTS.seed,
      })
    })
  })

  describe("selectSnapshot", () => {
    it("returns null before recompute", () => {
      expect(selectSnapshot(useDashboardStore.getState())).toBeNull()
    })

    it("returns SnapshotResult after recompute", () => {
      getState().recompute()
      expect(selectSnapshot(useDashboardStore.getState())).not.toBeNull()
    })
  })

  describe("selectSweep", () => {
    it("returns null before recompute", () => {
      expect(selectSweep(useDashboardStore.getState())).toBeNull()
    })

    it("returns SweepResult after recompute", () => {
      getState().recompute()
      expect(selectSweep(useDashboardStore.getState())).not.toBeNull()
    })
  })

  describe("selectStatus", () => {
    it("returns status from state", () => {
      expect(selectStatus(useDashboardStore.getState())).toBe(RUN_STATUS.IDLE)
    })
  })

  describe("selectBarChartData", () => {
    it("returns null when snapshot is null", () => {
      expect(selectBarChartData(useDashboardStore.getState())).toBeNull()
    })

    it("returns 5 entries with algorithm, comparisons, swaps after recompute", () => {
      getState().recompute()
      const data = selectBarChartData(useDashboardStore.getState())
      expect(data).not.toBeNull()
      expect(data).toHaveLength(5)
      for (const entry of data!) {
        expect(typeof entry.algorithm).toBe("string")
        expect(typeof entry.comparisons).toBe("number")
        expect(typeof entry.swaps).toBe("number")
      }
    })

    it("each entry has a label field", () => {
      getState().recompute()
      const data = selectBarChartData(useDashboardStore.getState())!
      for (const entry of data) {
        expect(typeof entry.label).toBe("string")
        expect(entry.label.length).toBeGreaterThan(0)
      }
    })
  })

  describe("selectSweepChartData", () => {
    it("returns null when sweep is null", () => {
      expect(selectSweepChartData(useDashboardStore.getState())).toBeNull()
    })

    it("returns 5 points with n and algorithm keys after recompute", () => {
      getState().recompute()
      const data = selectSweepChartData(useDashboardStore.getState())
      expect(data).not.toBeNull()
      expect(data).toHaveLength(5)
      for (const point of data!) {
        expect(typeof point.n).toBe("number")
        expect(typeof point.bubble).toBe("number")
        expect(typeof point.insertion).toBe("number")
        expect(typeof point.quick).toBe("number")
        expect(typeof point.merge).toBe("number")
        expect(typeof point.heap).toBe("number")
      }
    })

    it("each algorithm series value is > 0 for RANDOM mode (guards registry drop)", () => {
      // Sweep uses RANDOM mode by default (DASHBOARD_STORE_DEFAULTS.arrayMode).
      // All SWEEP_SIZES are >= 10, so every algorithm must produce > 0 comparisons.
      // This catches a future registry drop that the ?? 0 fallback would otherwise silence.
      getState().recompute()
      const data = selectSweepChartData(useDashboardStore.getState())
      expect(data).not.toBeNull()
      for (const point of data!) {
        expect(point.n).toBeGreaterThanOrEqual(10)
        expect(point.bubble).toBeGreaterThan(0)
        expect(point.insertion).toBeGreaterThan(0)
        expect(point.quick).toBeGreaterThan(0)
        expect(point.merge).toBeGreaterThan(0)
        expect(point.heap).toBeGreaterThan(0)
      }
    })
  })
})
