// Ambient module declarations for Vite-style import query strings.
// These are resolved at runtime by Vitest (which uses Vite under the hood),
// but tsc has no knowledge of them without explicit declarations.

declare module '*?raw' {
  const content: string
  export default content
}
