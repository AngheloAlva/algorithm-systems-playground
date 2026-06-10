import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn()", () => {
  it("returns a single class unchanged", () => {
    expect(cn("flex")).toBe("flex");
  });

  it("merges multiple classes", () => {
    expect(cn("flex", "items-center", "gap-4")).toBe("flex items-center gap-4");
  });

  it("filters falsy values", () => {
    expect(cn("flex", false && "hidden", null, undefined)).toBe("flex");
  });

  it("resolves Tailwind conflicts — last value wins", () => {
    // tailwind-merge should keep the latter padding class
    expect(cn("px-4", "px-8")).toBe("px-8");
  });

  it("handles conditional classes", () => {
    const isActive = true;
    expect(cn("base-class", isActive && "active")).toBe("base-class active");
  });
});
