/**
 * Re-exports loadSampleGraph from graph.ts for named-import convenience.
 *
 * This allows components and tests to import the sample graph by a standalone
 * path without pulling in all graph mutation functions.
 */
export { loadSampleGraph } from "./graph"
