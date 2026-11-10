// Pure board logic: hex grid geometry, matching, floating detection, shot tracing.
// Odd rows are shifted right by half a bubble and hold one fewer bubble.

export const COLS = 8
export const W = 400 // logical canvas width
export const H = 610 // logical canvas height
export const R = W / COLS / 2
export const ROW_H = R * Math.sqrt(3)
export const DEAD_ROW = 11 // a bubble at effective row >= 11 (the 12th row) ends the game
export const LINE_Y = 10 * ROW_H + 2 * R // bottom edge of the last safe row
export const SHOOT_X = W / 2
export const SHOOT_Y = 560
export const EMPTY = -1

export type Grid = number[][]
export type Cell = [number, number]
export interface Pt { x: number; y: number }

export const colsInRow = (r: number) => (r % 2 === 0 ? COLS : COLS - 1)
export const cellX = (r: number, c: number) => R + c * 2 * R + (r % 2) * R
export const cellY = (r: number, top: number) => top + R + r * ROW_H
export const get = (g: Grid, r: number, c: number) => g[r]?.[c] ?? EMPTY

export function setCell(g: Grid, r: number, c: number, v: number) {
  while (g.length <= r) g.push(new Array(colsInRow(g.length)).fill(EMPTY))
  g[r][c] = v
}

export function neighbors(r: number, c: number): Cell[] {
  const d = r % 2 === 1
    ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]]
    : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]]
  return d
    .map(([dr, dc]) => [r + dr, c + dc] as Cell)
    .filter(([rr, cc]) => rr >= 0 && cc >= 0 && cc < colsInRow(rr))
}

function bfs(g: Grid, starts: Cell[], ok: (v: number) => boolean): Cell[] {
  const seen = new Set(starts.map(([r, c]) => r * 100 + c))
  const out: Cell[] = []
  const queue = [...starts]
  while (queue.length) {
    const cell = queue.shift()!
    out.push(cell)
    for (const [r, c] of neighbors(...cell)) {
      const k = r * 100 + c
      if (!seen.has(k) && ok(get(g, r, c))) { seen.add(k); queue.push([r, c]) }
    }
  }
  return out
}

/** Same-colour group containing (r, c), in BFS order. */
export function findMatches(g: Grid, r: number, c: number): Cell[] {
  const color = get(g, r, c)
  return color === EMPTY ? [] : bfs(g, [[r, c]], (v) => v === color)
}

/** Bubbles not connected to the ceiling (row 0). */
export function findFloating(g: Grid): Cell[] {
  const roots: Cell[] = (g[0] ?? []).flatMap((v, c) => (v !== EMPTY ? [[0, c] as Cell] : []))
  const anchored = new Set(bfs(g, roots, (v) => v !== EMPTY).map(([r, c]) => r * 100 + c))
  const out: Cell[] = []
  g.forEach((row, r) => row.forEach((v, c) => { if (v !== EMPTY && !anchored.has(r * 100 + c)) out.push([r, c]) }))
  return out
}

export const colorsOnBoard = (g: Grid) => [...new Set(g.flat().filter((v) => v !== EMPTY))]
export const isEmpty = (g: Grid) => g.every((row) => row.every((v) => v === EMPTY))

export function lowestRow(g: Grid) {
  for (let r = g.length - 1; r >= 0; r--) if (g[r].some((v) => v !== EMPTY)) return r
  return -1
}

/** Nearest empty cell to (x, y) that touches the ceiling or an existing bubble. */
export function snapCell(g: Grid, x: number, y: number, top: number): Cell {
  let best: Cell = [0, 0]
  let bestD = Infinity
  for (let r = 0; r <= lowestRow(g) + 1; r++) {
    for (let c = 0; c < colsInRow(r); c++) {
      if (get(g, r, c) !== EMPTY) continue
      if (r > 0 && !neighbors(r, c).some(([rr, cc]) => get(g, rr, cc) !== EMPTY)) continue
      const d = (cellX(r, c) - x) ** 2 + (cellY(r, top) - y) ** 2
      if (d < bestD) { bestD = d; best = [r, c] }
    }
  }
  return best
}

/**
 * Simulate a shot. Returns the polyline (start, every wall bounce, end).
 * Used both for the aim line and the actual flight, so they always agree.
 */
export function trace(g: Grid, x: number, y: number, angle: number, top: number): Pt[] {
  let dx = Math.cos(angle)
  const dy = -Math.sin(angle)
  const pts: Pt[] = [{ x, y }]
  const hitD2 = (2 * R * 0.85) ** 2 // slightly forgiving so bubbles can slip through gaps
  const bubbles: Pt[] = []
  g.forEach((row, r) => row.forEach((v, c) => { if (v !== EMPTY) bubbles.push({ x: cellX(r, c), y: cellY(r, top) }) }))
  for (let i = 0; i < 4000; i++) {
    x += dx * 4
    y += dy * 4
    if (x < R) { x = 2 * R - x; dx = -dx; pts.push({ x: R, y }) }
    else if (x > W - R) { x = 2 * (W - R) - x; dx = -dx; pts.push({ x: W - R, y }) }
    if (y - R <= top) break
    if (bubbles.some((b) => (b.x - x) ** 2 + (b.y - y) ** 2 < hitD2)) break
  }
  pts.push({ x, y })
  return pts
}
