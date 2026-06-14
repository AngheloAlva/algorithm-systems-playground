/**
 * Unit tests for Slider — WCAG 4.1.2 accessible name forwarding.
 *
 * Base UI's SliderPrimitive.Root applies aria-label/aria-labelledby to the
 * root <div role="group">. The hidden <input type="range"> inside each
 * SliderPrimitive.Thumb is the true interactive control and must carry its
 * own accessible name. Our Slider wrapper forwards the root's aria props to
 * each Thumb so axe does not flag an unlabeled input.
 *
 * Note: Base UI's Thumb renders the input as visually-hidden via clip-path/fixed
 * positioning. We query it via `container.querySelector('input[type="range"]')`
 * to avoid jsdom's role-accessibility limitations with off-screen elements.
 */

import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Slider } from "./slider";

describe("Slider — accessible name forwarding (WCAG 4.1.2)", () => {
  it("forwards aria-label to the thumb input", () => {
    const { container } = render(
      <Slider
        defaultValue={[50]}
        min={0}
        max={100}
        aria-label="Animation speed"
      />
    );

    const input = container.querySelector('input[type="range"]');
    expect(input, "thumb input should exist").not.toBeNull();
    expect(input).toHaveAttribute("aria-label", "Animation speed");
  });

  it("forwards aria-labelledby to the thumb input", () => {
    const { container } = render(
      <div>
        <span id="speed-label">Playback speed</span>
        <Slider
          defaultValue={[30]}
          min={0}
          max={100}
          aria-labelledby="speed-label"
        />
      </div>
    );

    const input = container.querySelector('input[type="range"]');
    expect(input, "thumb input should exist").not.toBeNull();
    expect(input).toHaveAttribute("aria-labelledby", "speed-label");
  });

  it("prefers aria-labelledby over aria-label when both are provided", () => {
    const { container } = render(
      <div>
        <span id="len-label">Array length</span>
        <Slider
          defaultValue={[20]}
          min={0}
          max={100}
          aria-label="Array length"
          aria-labelledby="len-label"
        />
      </div>
    );

    const input = container.querySelector('input[type="range"]');
    expect(input, "thumb input should exist").not.toBeNull();
    // When both are present, aria-labelledby takes precedence on the thumb input
    expect(input).toHaveAttribute("aria-labelledby", "len-label");
    expect(input).not.toHaveAttribute("aria-label");
  });
});
