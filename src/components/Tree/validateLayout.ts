import type { LayoutResultV3 } from '../../types'

/**
 * Validate a layout result for correctness.
 *
 * Checks:
 * 1. No duplicate visualIds
 * 2. All visual nodes have finite x/y
 * 3. Every parentVisualId/childVisualId in connectors references an existing node
 * 4. No duplicate familyId in connectors
 * 5. No two distinct visual nodes overlap on the same generation row
 *
 * In dev/test: throws Error on first failure.
 * In production: logs warning.
 */
export function validateLayoutResult(result: LayoutResultV3): void {
  const errors: string[] = []

  // 1. No duplicate visualIds
  const seenIds = new Set<string>()
  for (const node of result.visualNodes) {
    if (seenIds.has(node.visualId)) {
      errors.push(`Duplicate visualId: "${node.visualId}"`)
    }
    seenIds.add(node.visualId)
  }

  // 2. All visual nodes have finite x/y
  for (const node of result.visualNodes) {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      errors.push(`Node "${node.visualId}" has non-finite coordinates: (${node.x}, ${node.y})`)
    }
  }

  // 3. All connector references are valid
  const validIds = new Set(result.visualNodes.map(n => n.visualId))
  for (const fam of result.families) {
    for (const vid of fam.parentVisualIds) {
      if (!validIds.has(vid)) {
        errors.push(`Family "${fam.familyId}" references missing parent visual node: "${vid}"`)
      }
    }
    for (const vid of fam.childVisualIds) {
      if (!validIds.has(vid)) {
        errors.push(`Family "${fam.familyId}" references missing child visual node: "${vid}"`)
      }
    }
  }

  // 4. No duplicate familyId in connectors
  const seenFamilyIds = new Set<string>()
  for (const fam of result.families) {
    if (seenFamilyIds.has(fam.familyId)) {
      errors.push(`Duplicate family connector for familyId: "${fam.familyId}"`)
    }
    seenFamilyIds.add(fam.familyId)
  }

  // 5. No overlapping distinct positions on same row
  const rowMap = new Map<number, number[]>()
  for (const node of result.visualNodes) {
    let row = rowMap.get(node.y)
    if (!row) {
      row = []
      rowMap.set(node.y, row)
    }
    row.push(node.x)
  }

  for (const [y, xPositions] of rowMap) {
    const uniqueXs = [...new Set(xPositions)].sort((a, b) => a - b)
    for (let i = 1; i < uniqueXs.length; i++) {
      const gap = uniqueXs[i] - uniqueXs[i - 1]
      if (gap < result.visualNodes[0]?.width ?? 140) {
        errors.push(`Overlap at y=${y}: gap=${gap}px between x=${uniqueXs[i - 1]} and x=${uniqueXs[i]}`)
      }
    }
  }

  if (errors.length === 0) return

  const message = `Layout validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`

  if (import.meta.env?.MODE === 'production') {
    console.warn(`[validateLayout] ${message}`)
  } else {
    throw new Error(message)
  }
}
