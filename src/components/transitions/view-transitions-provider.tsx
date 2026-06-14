"use client"

/**
 * ViewTransitionsProvider — provider + pathname-resolver pattern for manual
 * document.startViewTransition with App Router (REQ-ANIM Slice C critical fix).
 *
 * Architecture:
 *   - Wraps a subtree and exposes `transitionTo(href)` via React context.
 *   - On navigation, calls document.startViewTransition with a Promise callback.
 *   - The Promise resolves when usePathname reports the new route has committed,
 *     so the browser captures the "after" snapshot against the NEW rendered page.
 *   - Safety timeout (400 ms) prevents a hung transition if the route never commits.
 *
 * Graceful degradation (any of the following → plain router.push):
 *   - Reduced motion (useReducedMotion() === true)
 *   - Unsupported browser (document.startViewTransition undefined)
 *   - Same-route navigation (href pathname === current pathname)
 *   - Server environment (typeof document === 'undefined')
 *
 * No new dependencies, no experimental flag, no react@experimental import.
 */

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ViewTransitionContextValue {
  transitionTo: (href: string) => void
}

const ViewTransitionCtx = React.createContext<ViewTransitionContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ViewTransitionsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const reduced = useReducedMotion()

  /**
   * When a transition is in flight, finishRef holds the idempotent finish
   * function that clears the safety timer and resolves the VT promise.
   * Nulled after firing to prevent double-resolve and timer leaks.
   */
  const finishRef = React.useRef<(() => void) | null>(null)

  /**
   * Pathname change effect — resolves any pending transition.
   * This fires after React commits the new route's DOM, so the browser's
   * "after" snapshot will see the newly rendered content.
   */
  React.useEffect(() => {
    if (finishRef.current) {
      const f = finishRef.current
      finishRef.current = null
      f() // clears its own timer + resolves; idempotent via settled flag
    }
  }, [pathname])

  const transitionTo = React.useCallback(
    (href: string) => {
      // Extract pathname from href for same-route check
      const hrefPathname = href.split("?")[0].split("#")[0]

      const supportsVT =
        typeof document !== "undefined" &&
        typeof document.startViewTransition === "function"

      // Fallback conditions: no transition, just navigate
      if (reduced || !supportsVT || hrefPathname === pathname) {
        router.push(href)
        return
      }

      document.startViewTransition(
        () =>
          new Promise<void>((resolve) => {
            let settled = false

            // Idempotent finish: clears the safety timer and resolves once.
            const finish = () => {
              if (settled) return
              settled = true
              clearTimeout(timer)
              resolve()
            }

            // Safety: resolve after 400 ms so the transition never hangs.
            const timer = setTimeout(finish, 400)

            // Store finish so the pathname effect can trigger it.
            finishRef.current = finish

            // Push inside startTransition so React batches correctly.
            React.startTransition(() => {
              router.push(href)
            })
          }),
      )
    },
    [pathname, reduced, router],
  )

  return (
    <ViewTransitionCtx.Provider value={{ transitionTo }}>
      {children}
    </ViewTransitionCtx.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useViewTransitionRouter — returns { transitionTo } from the nearest provider.
 *
 * Graceful fallback: if no ViewTransitionsProvider is mounted in the tree,
 * returns a transitionTo that uses a plain useRouter().push — so the component
 * works correctly even when rendered outside the provider (e.g., in unit tests
 * or Storybook stories that don't wrap with the provider).
 */
export function useViewTransitionRouter(): ViewTransitionContextValue {
  const ctx = React.useContext(ViewTransitionCtx)

  // Fallback hook (always called — Rules of Hooks)
  const router = useRouter()
  const fallback = React.useMemo<ViewTransitionContextValue>(
    () => ({ transitionTo: (href: string) => router.push(href) }),
    [router],
  )

  return ctx ?? fallback
}
