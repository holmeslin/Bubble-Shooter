import { describe, expect, it } from 'vitest'
import { EMPTY, findFloating, findMatches, neighbors, snapCell, trace, type Grid } from './grid'
import { LEVELS, generateLevel } from './levels'

const E = EMPTY

describe('grid', () => {
  it('neighbours respect odd-row offset and bounds', () => {
    expect(neighbors(0, 0).sort()).toEqual([[0, 1], [1, 0]])
    expect(neighbors(1, 0).sort()).toEqual([[0, 0], [0, 1], [1, 1], [2, 0], [2, 1]].sort())
    expect(neighbors(2, 3).sort()).toEqual([[1, 2], [1, 3], [2, 2], [2, 4], [3, 2], [3, 3]])
  })

  it('finds same-colour groups through the hex links', () => {
    const g: Grid = [
      [0, 0, 1, E, E, E, E, E],
      [E, 0, E, E, E, E, E],
    ]
    expect(findMatches(g, 0, 0)).toHaveLength(3)
    expect(findMatches(g, 0, 2)).toHaveLength(1)
  })

  it('finds bubbles not connected to the ceiling', () => {
    const g: Grid = [
      [0, E, E, E, E, E, E, E],
      [0, E, E, E, E, E, E],
      [E, E, E, 2, E, E, E, E],
    ]
    expect(findFloating(g)).toEqual([[2, 3]])
  })

  it('snaps to the ceiling or next to an existing bubble', () => {
    const g: Grid = [[0, E, E, E, E, E, E, E]]
    expect(snapCell(g, 380, 20, 0)).toEqual([0, 7])
    expect(snapCell(g, 50, 70, 0)).toEqual([1, 0])
  })

  it('a straight-up shot ends at the ceiling, an angled one bounces', () => {
    const empty: Grid = [[E, E, E, E, E, E, E, E]]
    const up = trace(empty, 200, 560, Math.PI / 2, 0)
    expect(up).toHaveLength(2)
    expect(up[1].y).toBeLessThan(30)
    expect(trace(empty, 200, 560, Math.PI / 6, 0).length).toBeGreaterThan(2)
  })
})

describe('levels', () => {
  it.each(LEVELS.map((l, i) => [i, l] as const))('level %i is anchored and non-empty', (_, def) => {
    const g = generateLevel(def)
    expect(g[0].some((v) => v !== E)).toBe(true)
    expect(findFloating(g)).toEqual([])
    expect(g.flat().every((v) => v === E || (v >= 0 && v < def.colors))).toBe(true)
  })

  it('heart shape keeps a decent number of bubbles', () => {
    const g = generateLevel(LEVELS[8])
    expect(g.flat().filter((v) => v !== E).length).toBeGreaterThan(25)
  })
})
