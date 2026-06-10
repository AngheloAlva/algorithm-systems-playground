# ADR: URL-Serializable Module State

All module-specific user configuration is encoded as URL query parameters so that any session can be reproduced by sharing a link.

## Status

Accepted — Phase 0 (documentation only; implemented per module in Phase 1+)

## Quick path

1. Define a `StateCodec<MyState>` in the module's lib file.
2. Call `codec.encode(state)` on every state change; push to URL via `router.replace`.
3. Call `codec.decode(useSearchParams())` on mount to restore state.

## Details

| Topic | Decision |
|-------|----------|
| Pattern name | URL-serializable state |
| Contract file | `src/lib/url-state.ts` — `StateCodec<T>` interface |
| Parameter format | Lowercase ASCII keys, no dashes: `algo`, `speed`, `rows`, `cols` |
| Numeric values | Plain decimal string: `speed=5` |
| Boolean values | `"1"` for true, `"0"` for false |
| Enum values | String literal of the enum member: `algo=astar` |
| Arrays | Repeated keys: `selected=a&selected=b` |
| Defaults omitted | Keys whose value equals the module default are left out of the URL |
| Read on mount | `useSearchParams()` in a `"use client"` component inside a `<Suspense>` boundary |
| Write on change | `router.replace(pathname + "?" + params.toString(), { scroll: false })` |
| Debouncing | High-frequency updates (slider drag) are debounced before calling `replace` |
| Serialization boundary | Plain object only — no class instances, no functions |
| History strategy | `replace` (not `push`) — back/forward navigates between meaningful states, not every interaction |

## Rationale

Sharing a URL is the simplest collaboration primitive. When a user wants to show a specific algorithm run to a colleague, they copy the URL. No backend, no session tokens, no export flow.

`router.replace` with `{ scroll: false }` is the correct Next.js App Router API for shallow URL updates from client components. It does not remount the page; it only updates the browser history entry.

## Example codec (pathfinding module — Phase 1)

```typescript
import type { StateCodec } from "@/lib/url-state"

type Algorithm = "astar" | "dijkstra" | "bfs" | "dfs"

interface PathfindingState {
  algorithm: Algorithm
  speed: number  // 1–10
  rows: number
  cols: number
}

const DEFAULT: PathfindingState = { algorithm: "astar", speed: 5, rows: 20, cols: 30 }

export const pathfindingCodec: StateCodec<PathfindingState> = {
  encode(state) {
    const p = new URLSearchParams()
    if (state.algorithm !== DEFAULT.algorithm) p.set("algo", state.algorithm)
    if (state.speed !== DEFAULT.speed) p.set("speed", String(state.speed))
    if (state.rows !== DEFAULT.rows) p.set("rows", String(state.rows))
    if (state.cols !== DEFAULT.cols) p.set("cols", String(state.cols))
    return p
  },
  decode(params) {
    return {
      algorithm: (params.get("algo") ?? DEFAULT.algorithm) as Algorithm,
      speed: Number(params.get("speed") ?? DEFAULT.speed),
      rows: Number(params.get("rows") ?? DEFAULT.rows),
      cols: Number(params.get("cols") ?? DEFAULT.cols),
    }
  },
}
```

## Checklist

- [ ] `StateCodec<T>` interface exists in `src/lib/url-state.ts`
- [ ] Each module that goes live defines a codec in its own `lib/` subfolder
- [ ] The module's top-level client component reads from `useSearchParams()` on mount
- [ ] State writes use `router.replace` with `{ scroll: false }`
- [ ] High-frequency updates are debounced (300 ms recommended)

## Next step

When implementing the Pathfinding module (Phase 1), create `src/app/pathfinding/lib/codec.ts` implementing `StateCodec<PathfindingState>` and wire it to the module page.
