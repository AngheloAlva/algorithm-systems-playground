import {
  GitBranchIcon,
  LayoutDashboardIcon,
  NetworkIcon,
  RouteIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Module status
// ---------------------------------------------------------------------------

export const MODULE_STATUS = {
  AVAILABLE: "available",
  COMING_SOON: "coming-soon",
} as const;

export type ModuleStatus = (typeof MODULE_STATUS)[keyof typeof MODULE_STATUS];

// ---------------------------------------------------------------------------
// Module interface
// ---------------------------------------------------------------------------

export interface Module {
  /** URL slug — used as the route path segment: /{slug} */
  slug: string;
  /** Display title shown in navigation and cards */
  title: string;
  /** One-line description of what the module demonstrates */
  description: string;
  /** Current availability status */
  status: ModuleStatus;
  /** Lucide icon component */
  icon: LucideIcon;
}

// ---------------------------------------------------------------------------
// Single source of truth for all modules
//
// To activate a module: change status to MODULE_STATUS.AVAILABLE
// ---------------------------------------------------------------------------

export const MODULES: Module[] = [
  {
    slug: "pathfinding",
    title: "Pathfinding",
    description:
      "Visualize A*, Dijkstra, BFS, and DFS on interactive grid mazes.",
    status: MODULE_STATUS.AVAILABLE,
    icon: RouteIcon,
  },
  {
    slug: "graphs",
    title: "Graphs",
    description:
      "Explore graph traversal, shortest paths, and connectivity algorithms.",
    status: MODULE_STATUS.AVAILABLE,
    icon: NetworkIcon,
  },
  {
    slug: "simulation",
    title: "Simulation",
    description:
      "Run step-by-step algorithm simulations with configurable parameters.",
    status: MODULE_STATUS.COMING_SOON,
    icon: GitBranchIcon,
  },
  {
    slug: "dashboard",
    title: "Dashboard",
    description:
      "Compare algorithm performance with real-time metrics and benchmarks.",
    status: MODULE_STATUS.COMING_SOON,
    icon: LayoutDashboardIcon,
  },
] as const;
