"use client"

/**
 * TransitionLink — navigation wrapper that delegates to ViewTransitionsProvider
 * for the provider + pathname-resolver animated transition pattern.
 *
 * Renders a real <a href> via next/link at all times so keyboard navigation,
 * screen readers, and "open in new tab" work correctly without JavaScript.
 *
 * On click:
 *   - Modifier / middle click (metaKey, ctrlKey, shiftKey, altKey, button !== 0):
 *     returns without intercepting — browser opens in new tab/window.
 *   - Plain left-click: preventDefault, then calls transitionTo(href) from context.
 *     The provider handles VT eligibility (reduced motion, same-route, support check).
 *     Falls back gracefully to router.push when no provider is mounted.
 *
 * Implementation: provider + pathname-resolver pattern (REQ-ANIM Slice C fix).
 * NOTE: no experimental.viewTransition flag needed — this API is browser-native.
 */

import * as React from "react"
import Link from "next/link"
import { useViewTransitionRouter } from "./view-transitions-provider"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TransitionLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** The destination href (passed through to next/link for prefetch + real <a>). */
  href: string
  /** Disable Next.js prefetching (forwarded to next/link). */
  prefetch?: boolean
  /**
   * Children are optional here because SidebarMenuButton uses the render prop
   * pattern — it injects children into the element after cloning it.
   * In all other usages children should be provided.
   */
  children?: React.ReactNode
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Whether this click should be let through to the browser without hijacking.
 * Modifier keys open the link in a new tab/window; middle-click does the same.
 * We must NOT intercept those.
 */
function isModifierClick(e: React.MouseEvent<HTMLAnchorElement>): boolean {
  return e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransitionLink({
  href,
  prefetch,
  children,
  onClick,
  ...rest
}: TransitionLinkProps) {
  const { transitionTo } = useViewTransitionRouter()

  /**
   * Click handler that mirrors native anchor behavior:
   *   - The caller-provided `onClick` is always forwarded FIRST, including for
   *     modifier/middle clicks, consistent with how a plain <a> fires onclick
   *     before the browser acts on the navigation.
   *   - After forwarding, modifier/middle clicks are passed through to the browser
   *     (open in new tab/window) and the view transition is NOT triggered.
   *   - Plain left-clicks prevent the default <a> navigation and delegate to
   *     transitionTo() so the provider can manage the VT lifecycle.
   */
  const handleClick = React.useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      // Forward caller onClick regardless of modifier state (mirrors native anchor)
      onClick?.(e)

      // Let the browser handle modifier / middle clicks natively (new tab, etc.)
      if (isModifierClick(e)) return

      // Prevent default <a> navigation — provider drives it
      e.preventDefault()

      transitionTo(href)
    },
    [href, onClick, transitionTo],
  )

  return (
    <Link href={href} prefetch={prefetch} onClick={handleClick} {...rest}>
      {children}
    </Link>
  )
}
