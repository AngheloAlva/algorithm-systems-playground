import { Suspense } from "react"
import type { Metadata } from "next"
import { MODULES } from "@/config/modules"
import { SimulationVisualizer } from "@/components/simulation/SimulationVisualizer"

const mod = MODULES.find((m) => m.slug === "simulation")!

export const metadata: Metadata = {
  title: `${mod.title} — Algorithm Playground`,
  description: mod.description,
}

/**
 * SimulationPage — RSC shell + Suspense-wrapped client island.
 *
 * The Suspense boundary is required by Next.js App Router whenever a client
 * component calls `useSearchParams()`. Without it the entire page would be
 * forced into CSR or throw a build-time error.
 *
 * Mirrors graphs/page.tsx structure exactly (T9, SIM6.2).
 *
 * @see https://nextjs.org/docs/app/api-reference/functions/use-search-params#static-rendering
 */
export default function SimulationPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Server-rendered header */}
      <header className="flex flex-col gap-1">
        <h1 className="text-foreground text-2xl font-bold tracking-tight">{mod.title}</h1>
        <p className="text-muted-foreground text-sm">{mod.description}</p>
      </header>

      {/* Client visualizer island — Suspense required for useSearchParams */}
      <Suspense
        fallback={
          <div className="bg-muted/30 border-border flex h-96 items-center justify-center rounded-lg border">
            <span className="text-muted-foreground text-sm">Loading simulator…</span>
          </div>
        }
      >
        <SimulationVisualizer />
      </Suspense>
    </main>
  )
}
