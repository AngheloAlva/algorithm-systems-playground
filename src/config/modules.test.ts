/**
 * modules.ts — config tests (SIM6.1, T10)
 *
 * Verifies:
 *   - The simulation module is AVAILABLE (not COMING_SOON) after the flip
 */

import { describe, it, expect } from "vitest"
import { MODULES, MODULE_STATUS } from "./modules"

describe("modules config", () => {
  it("simulation module status is AVAILABLE (SIM6.1-a)", () => {
    const simulationModule = MODULES.find((m) => m.slug === "simulation")
    expect(simulationModule).toBeDefined()
    expect(simulationModule?.status).toBe(MODULE_STATUS.AVAILABLE)
  })

  it("pathfinding and graphs modules are still AVAILABLE", () => {
    const pathfinding = MODULES.find((m) => m.slug === "pathfinding")
    const graphs = MODULES.find((m) => m.slug === "graphs")
    expect(pathfinding?.status).toBe(MODULE_STATUS.AVAILABLE)
    expect(graphs?.status).toBe(MODULE_STATUS.AVAILABLE)
  })
})
