"use client"

/**
 * MetricsTable — tabular summary of snapshot benchmark results.
 *
 * Columns: Algorithm, Comparisons, Swaps.
 * Merge Sort swaps cell carries a note marker (asterisk) per spec UI-3.
 * The note text is rendered below the table explaining the zero-swap behavior.
 *
 * Spec: UI-3
 */

import type { BarChartRow } from "@/store/dashboard-store"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MetricsTableProps {
  rows: BarChartRow[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MetricsTable({ rows }: MetricsTableProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Algorithm
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Comparisons
              </th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Swaps
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isMerge = row.algorithm === "merge"
              return (
                <tr
                  key={row.algorithm}
                  className={
                    idx % 2 === 0
                      ? "bg-background"
                      : "bg-muted/10"
                  }
                >
                  <td className="px-3 py-2 font-medium text-foreground">
                    {row.label}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground">
                    {row.comparisons.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-foreground">
                    {isMerge ? (
                      <span data-testid="table-merge-swaps-note">
                        {row.swaps}
                        <span className="ml-1 text-muted-foreground sr-only">
                          Merge Sort places elements, not swaps — 0 by design
                        </span>
                        <span aria-hidden="true" className="ml-1 text-muted-foreground">*</span>
                      </span>
                    ) : (
                      row.swaps.toLocaleString()
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footnote explaining Merge Sort zero-swap behavior — spec UI-3, design ADR-D */}
      {rows.some((r) => r.algorithm === "merge") && (
        <p className="text-muted-foreground text-xs">
          * Merge Sort places elements into auxiliary arrays rather than swapping
          adjacent elements, so its swap count is always 0.
        </p>
      )}
    </div>
  )
}
