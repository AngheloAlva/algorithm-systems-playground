import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RouteIcon } from "lucide-react";

import { EmptyState } from "./empty-state";
import { MODULES, MODULE_STATUS } from "@/config/modules";

describe("EmptyState", () => {
  it("renders the module title and description", () => {
    render(
      <EmptyState
        title="Pathfinding"
        description="Visualize A*, Dijkstra, BFS, and DFS on interactive grid mazes."
        icon={RouteIcon}
      />
    );

    expect(screen.getByText("Pathfinding")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Visualize A*, Dijkstra, BFS, and DFS on interactive grid mazes."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
  });

  it("renders the icon with aria-hidden to keep it decorative", () => {
    const { container } = render(
      <EmptyState title="Graphs" description="Graph traversal." icon={RouteIcon} />
    );

    const svg = container.querySelector("svg[aria-hidden='true']");
    expect(svg).toBeInTheDocument();
  });
});

describe("MODULES registry", () => {
  it("has exactly 4 entries", () => {
    expect(MODULES).toHaveLength(4);
  });

  it("every module has required fields", () => {
    for (const mod of MODULES) {
      expect(mod.slug).toBeTruthy();
      expect(mod.title).toBeTruthy();
      expect(mod.description).toBeTruthy();
      // Lucide icons at v1+ are React component objects (not plain functions)
      expect(mod.icon).toBeTruthy();
      expect([MODULE_STATUS.AVAILABLE, MODULE_STATUS.COMING_SOON]).toContain(
        mod.status
      );
    }
  });

  it("each slug is unique", () => {
    const slugs = MODULES.map((m) => m.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(MODULES.length);
  });

  it("all 4 modules are currently coming-soon", () => {
    const comingSoon = MODULES.filter(
      (m) => m.status === MODULE_STATUS.COMING_SOON
    );
    expect(comingSoon).toHaveLength(4);
  });
});
