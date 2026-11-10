import { EMPTY, R, W, cellX, colsInRow, findFloating, type Grid } from './grid'

export const COLORS = ['#FF4D6D', '#FF9F1C', '#FFD60A', '#2EC4B6', '#4361EE', '#9D4EDD', '#E9ECEF']

export type Shape = 'normal' | 'diamond' | 'heart'
export interface LevelDef { name: string; colors: number; rows: number; dropEvery: number; shape: Shape }

const L = (name: string, colors: number, rows: number, dropEvery: number, shape: Shape = 'normal'): LevelDef =>
  ({ name, colors, rows, dropEvery, shape })

// dropEvery 0 = the ceiling never drops
export const LEVELS: LevelDef[] = [
  L('暖身', 3, 5, 0),
  L('起步', 3, 6, 20),
  L('漸進', 4, 6, 18),
  L('加速', 4, 7, 16),
  L('挑戰', 5, 7, 15),
  L('密集', 5, 8, 14),
  L('菱形', 5, 8, 12, 'diamond'),
  L('極限', 6, 9, 12),
  L('心跳', 6, 9, 10, 'heart'),
  L('最終關', 7, 10, 8),
]

function inShape(shape: Shape, r: number, c: number, rows: number) {
  const x = cellX(r, c)
  if (shape === 'diamond') return Math.abs(x - W / 2) <= R * (1 + 2 * Math.min(r, rows - 1 - r)) + 0.01
  if (shape === 'heart') {
    // (x²+y²−1)³ − x²y³ ≤ 0, top row at y=1.2 so both lobes touch the ceiling
    const hx = ((x - W / 2) / (W / 2)) * 1.45
    const hy = 1.2 - (r / (rows - 1)) * 2.3
    return (hx * hx + hy * hy - 1) ** 3 - hx * hx * hy ** 3 <= 0
  }
  return true
}

export function generateLevel(def: LevelDef, rand = Math.random): Grid {
  const g: Grid = []
  for (let r = 0; r < def.rows; r++) {
    const row: number[] = []
    for (let c = 0; c < colsInRow(r); c++) {
      if (!inShape(def.shape, r, c, def.rows)) { row.push(EMPTY); continue }
      // 40% chance to copy a neighbour so colours form clusters
      const nb = [row[c - 1], g[r - 1]?.[c]].filter((v) => v !== undefined && v !== EMPTY)
      row.push(nb.length && rand() < 0.4 ? nb[Math.floor(rand() * nb.length)] : Math.floor(rand() * def.colors))
    }
    g.push(row)
  }
  for (const [r, c] of findFloating(g)) g[r][c] = EMPTY
  return g
}
