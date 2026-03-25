/**
 * TreeLayout barrel file.
 *
 * The v2 monolithic layout engine has been decomposed into:
 * - assignGenerations.ts  — BFS generation assignment
 * - familySelection.ts    — pickCenterFamily, pickPrimaryBirthFamily
 * - measureLayout.ts      — family-block measurement with per-family memoization
 * - placeLayout.ts        — placement with visual instances
 * - computeTreeLayoutV3.ts — orchestrator pipeline
 * - validateLayout.ts     — layout result validation
 *
 * This file re-exports the main entry point for backward compatibility.
 */

// Re-export the v3 layout function
export { computeTreeLayoutV3 as computeTreeLayout } from './computeTreeLayoutV3'
export { computeTreeLayoutV3 } from './computeTreeLayoutV3'

// Re-export generation utilities
export { assignGenerations, buildFamilyLookups } from './assignGenerations'
export type { GenerationTable } from './assignGenerations'

// Re-export measure utilities
export { measureFamilyV3 as measureFamily, measureAllV3 as measureAllFamilies, measurePersonDescendants as measurePerson, defaultLayoutConfig } from './measureLayout'

// Re-export selection utilities
export { pickCenterFamily, pickPrimaryBirthFamily } from './familySelection'

// Re-export placement utilities
export { makeVisualId } from './placeLayout'

// Re-export validation
export { validateLayoutResult } from './validateLayout'

// Re-export types for backward compat
export type { VisualPersonNode, LayoutResultV3, LayoutConfig, PositionedFamilyConnectorV3 } from '../../types'

// Legacy types (kept for test compat)
import type { Person } from '../../types'

export interface LayoutLink {
  targetId: string
  type: 'partner' | 'parent-child'
}

export interface LayoutNode {
  personId: string
  person: Person
  x: number
  y: number
  links: LayoutLink[]
}
