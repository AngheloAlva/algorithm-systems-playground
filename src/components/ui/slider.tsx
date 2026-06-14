import { Slider as SliderPrimitive } from "@base-ui/react/slider"

import { cn } from "@/lib/utils"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  ...props
}: SliderPrimitive.Root.Props) {
  const _values = Array.isArray(value)
    ? value
    : Array.isArray(defaultValue)
      ? defaultValue
      : [min, max]

  // WCAG 4.1.2: Base UI's SliderPrimitive.Root applies aria-label/aria-labelledby to
  // the root <div role="group">, NOT to the inner <input type="range"> that carries
  // the slider role. SliderPrimitive.Thumb accepts aria-label/aria-labelledby and
  // forwards them to the hidden <input type="range"> (the true interactive control).
  // We forward here so each thumb input is properly labeled for assistive technology.
  const thumbAriaProps: Pick<SliderPrimitive.Thumb.Props, "aria-label" | "aria-labelledby"> = {}
  if (ariaLabelledby) {
    // Prefer aria-labelledby when available — avoids double-labeling
    thumbAriaProps["aria-labelledby"] = ariaLabelledby
  } else if (ariaLabel) {
    thumbAriaProps["aria-label"] = ariaLabel
  }

  return (
    <SliderPrimitive.Root
      className={cn("data-horizontal:w-full data-vertical:h-full", className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow overflow-hidden rounded-full bg-muted select-none data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-primary select-none data-horizontal:h-full data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className="relative block size-3 shrink-0 rounded-full border border-ring bg-background ring-ring/50 transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 focus-visible:outline-hidden active:ring-3 disabled:pointer-events-none disabled:opacity-50"
            {...thumbAriaProps}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
