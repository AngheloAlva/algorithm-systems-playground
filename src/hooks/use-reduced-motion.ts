"use client"

/**
 * useReducedMotion — reads the prefers-reduced-motion OS preference.
 *
 * Returns true when the user has requested reduced motion.
 * SSR-safe: defaults to false on the server or when matchMedia is unavailable.
 * Subscribes to media-query change events so the component re-renders
 * immediately when the user toggles the OS preference.
 *
 * Single source of truth for the motion gate (REQ-ANIM-4, ADR-3).
 */

import * as React from "react"

const QUERY = "(prefers-reduced-motion: reduce)"

function getReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }
  return window.matchMedia(QUERY).matches
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState<boolean>(getReducedMotion)

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return
    }

    const mql = window.matchMedia(QUERY)
    const onChange = (e: MediaQueryListEvent) => {
      setReduced(e.matches)
    }

    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return reduced
}
