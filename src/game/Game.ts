import { sfx } from './audio'
import {
  DEAD_ROW, EMPTY, H, LINE_Y, R, ROW_H, SHOOT_X, SHOOT_Y, W,
  cellX, cellY, colorsOnBoard, findFloating, findMatches, isEmpty, lowestRow, setCell, snapCell, trace,
  type Cell, type Grid, type Pt,
} from './grid'
import { COLORS, generateLevel, type LevelDef } from './levels'

export interface HudState { score: number; combo: number; dropIn: number | null }
export interface GameEvents { onHud(h: HudState): void; onEnd(won: boolean, score: number): void }

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface Body { x: number; y: number; vx: number; vy: number; color: number }
interface Pop { x: number; y: number; color: number; delay: number }
interface Shot { path: Pt[]; seg: number; x: number; y: number; color: number; target: Cell }

const MIN_ANGLE = (8 * Math.PI) / 180
const SPEED = 1100 // logical px per second
const MAX_MULT = 5

export class Game {
  paused = false
  private grid: Grid
  private drops = 0
  private topAnim = 0
  private current: number
  private next: number
  private angle: number | null = null
  private pointerDown = false
  private shot: Shot | null = null
  private particles: Particle[] = []
  private fallers: Body[] = []
  private pops: Pop[] = []
  private score = 0
  private combo = 0
  private shotsToDrop: number
  private over = false
  private won = false
  private endTimer = 0
  private raf = 0
  private last = 0
  private ctx: CanvasRenderingContext2D
  private scale = 1
  private dpr = 1
  private sprites: HTMLCanvasElement[] = []

  constructor(private canvas: HTMLCanvasElement, private level: LevelDef, private ev: GameEvents) {
    this.grid = generateLevel(level)
    this.shotsToDrop = level.dropEvery
    this.current = this.randColor()
    this.next = this.randColor()
    this.ctx = canvas.getContext('2d')!
    canvas.addEventListener('pointerdown', this.onDown)
    canvas.addEventListener('pointermove', this.onMove)
    canvas.addEventListener('pointerup', this.onUp)
    canvas.addEventListener('pointercancel', this.onCancel)
    this.emitHud()
    this.raf = requestAnimationFrame(this.frame)
  }

  destroy() {
    cancelAnimationFrame(this.raf)
    this.canvas.removeEventListener('pointerdown', this.onDown)
    this.canvas.removeEventListener('pointermove', this.onMove)
    this.canvas.removeEventListener('pointerup', this.onUp)
    this.canvas.removeEventListener('pointercancel', this.onCancel)
  }

  resize(cssWidth: number) {
    this.scale = cssWidth / W
    this.dpr = window.devicePixelRatio || 1
    this.canvas.style.width = `${cssWidth}px`
    this.canvas.style.height = `${(cssWidth * H) / W}px`
    this.canvas.width = Math.round(cssWidth * this.dpr)
    this.canvas.height = Math.round(((cssWidth * H) / W) * this.dpr)
    this.sprites = COLORS.map((c) => bubbleSprite(c, this.scale * this.dpr))
  }

  get ended() { return this.over }

  private get top() { return this.drops * ROW_H }

  // ---------- input ----------
  private toLogical(e: PointerEvent): Pt {
    const rect = this.canvas.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H }
  }

  private updateAim(e: PointerEvent) {
    const p = this.toLogical(e)
    if (p.y > SHOOT_Y - 10) { this.angle = null; return } // below the launcher = cancel
    const a = Math.atan2(SHOOT_Y - p.y, p.x - SHOOT_X)
    this.angle = Math.min(Math.max(a, MIN_ANGLE), Math.PI - MIN_ANGLE)
  }

  private canAim() { return !this.paused && !this.over && !this.shot }

  private onDown = (e: PointerEvent) => {
    if (!this.canAim()) return
    this.pointerDown = true
    this.canvas.setPointerCapture(e.pointerId)
    this.updateAim(e)
  }

  private onMove = (e: PointerEvent) => { if (this.pointerDown) this.updateAim(e) }

  private onUp = (e: PointerEvent) => {
    if (!this.pointerDown) return
    this.updateAim(e)
    this.pointerDown = false
    if (this.angle !== null && this.canAim()) this.fire(this.angle)
    this.angle = null
  }

  private onCancel = () => { this.pointerDown = false; this.angle = null }

  // ---------- rules ----------
  private randColor() {
    const on = colorsOnBoard(this.grid)
    const pool = on.length ? on : [...Array(this.level.colors).keys()]
    return pool[Math.floor(Math.random() * pool.length)]
  }

  private fire(angle: number) {
    const path = trace(this.grid, SHOOT_X, SHOOT_Y, angle, this.top)
    const end = path[path.length - 1]
    const target = snapCell(this.grid, end.x, end.y, this.top)
    this.shot = { path, seg: 0, x: SHOOT_X, y: SHOOT_Y, color: this.current, target }
    this.current = this.next
    this.next = this.randColor()
    sfx.shoot()
  }

  private land(shot: Shot) {
    const [r, c] = shot.target
    setCell(this.grid, r, c, shot.color)
    sfx.stick()

    const match = findMatches(this.grid, r, c)
    if (match.length >= 3) {
      this.combo++
      const mult = Math.min(this.combo, MAX_MULT)
      match.forEach(([mr, mc], i) => {
        this.pops.push({ x: cellX(mr, mc), y: cellY(mr, this.topAnim), color: this.grid[mr][mc], delay: i * 0.035 })
        this.grid[mr][mc] = EMPTY
      })
      const floating = findFloating(this.grid)
      for (const [fr, fc] of floating) {
        this.fallers.push({
          x: cellX(fr, fc), y: cellY(fr, this.topAnim),
          vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 180, color: this.grid[fr][fc],
        })
        this.grid[fr][fc] = EMPTY
      }
      this.score += (match.length * 10 + floating.length * 20) * mult
      sfx.pop(this.combo)
      if (floating.length) sfx.drop()
    } else {
      this.combo = 0
    }

    if (isEmpty(this.grid)) return this.finish(true)

    if (this.level.dropEvery && --this.shotsToDrop === 0) {
      this.drops++
      this.shotsToDrop = this.level.dropEvery
      sfx.ceiling()
    }
    if (lowestRow(this.grid) + this.drops >= DEAD_ROW) return this.finish(false)

    // only shoot colours that still exist on the board
    const on = colorsOnBoard(this.grid)
    if (!on.includes(this.current)) this.current = this.randColor()
    if (!on.includes(this.next)) this.next = this.randColor()
    this.emitHud()
  }

  private finish(won: boolean) {
    this.over = true
    this.won = won
    this.endTimer = 1.1 // let the particles play before showing the panel
    this.emitHud()
    if (won) sfx.win()
    else sfx.lose()
  }

  private emitHud() {
    this.ev.onHud({ score: this.score, combo: this.combo, dropIn: this.level.dropEvery ? this.shotsToDrop : null })
  }

  // ---------- loop ----------
  private frame = (t: number) => {
    const dt = Math.min(0.05, Math.max(0, (t - this.last) / 1000)) // clamp so a pause/tab switch doesn't jump
    this.last = t
    if (!this.paused) this.update(dt)
    if (this.sprites.length) this.render()
    this.raf = requestAnimationFrame(this.frame)
  }

  private update(dt: number) {
    this.topAnim += (this.top - this.topAnim) * Math.min(1, dt * 10)

    const shot = this.shot
    if (shot) {
      let dist = SPEED * dt
      while (dist > 0 && shot.seg < shot.path.length - 1) {
        const b = shot.path[shot.seg + 1]
        const d = Math.hypot(b.x - shot.x, b.y - shot.y)
        if (d <= dist) {
          shot.x = b.x; shot.y = b.y; dist -= d; shot.seg++
          if (shot.seg < shot.path.length - 1) sfx.bounce()
        } else {
          shot.x += ((b.x - shot.x) / d) * dist
          shot.y += ((b.y - shot.y) / d) * dist
          dist = 0
        }
      }
      if (shot.seg === shot.path.length - 1) { this.shot = null; this.land(shot) }
    }

    this.pops = this.pops.filter((p) => {
      p.delay -= dt
      if (p.delay > 0) return true
      this.burst(p.x, p.y, COLORS[p.color], 14)
      return false
    })

    this.fallers = this.fallers.filter((f) => {
      f.vy += 1800 * dt
      f.x += f.vx * dt
      f.y += f.vy * dt
      if (f.y < LINE_Y + 40) return true
      this.burst(f.x, f.y, COLORS[f.color], 10)
      return false
    })

    this.particles = this.particles.filter((p) => {
      p.vy += 700 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dt
      return p.life > 0
    })

    if (this.over && this.endTimer > 0) {
      this.endTimer -= dt
      if (this.endTimer <= 0) this.ev.onEnd(this.won, this.score)
    }
  }

  private burst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const s = 80 + Math.random() * 260
      const max = 0.4 + Math.random() * 0.4
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: max, max, color, size: 2 + Math.random() * 4 })
    }
  }

  // ---------- drawing ----------
  private drawBubble(x: number, y: number, color: number, size = 1, alpha = 1) {
    const s = (R + 2) * size
    this.ctx.globalAlpha = alpha
    this.ctx.drawImage(this.sprites[color], x - s, y - s, s * 2, s * 2)
    this.ctx.globalAlpha = 1
  }

  private render() {
    const c = this.ctx
    const k = this.scale * this.dpr
    c.setTransform(k, 0, 0, k, 0, 0)
    c.clearRect(0, 0, W, H)

    // ceiling plate that pushes the board down
    if (this.topAnim > 0.5) {
      const g = c.createLinearGradient(0, 0, 0, this.topAnim)
      g.addColorStop(0, '#2a3557')
      g.addColorStop(1, '#3d4b78')
      c.fillStyle = g
      c.fillRect(0, 0, W, this.topAnim)
      c.fillStyle = 'rgba(255,214,10,0.7)'
      c.fillRect(0, this.topAnim - 3, W, 3)
    }

    const dim = this.over && !this.won ? 0.35 : 1
    this.grid.forEach((row, r) => row.forEach((v, col) => {
      if (v !== EMPTY) this.drawBubble(cellX(r, col), cellY(r, this.topAnim), v, 1, dim)
    }))

    // danger line
    c.strokeStyle = 'rgba(255,93,143,0.55)'
    c.lineWidth = 2
    c.setLineDash([10, 8])
    c.beginPath()
    c.moveTo(0, LINE_Y)
    c.lineTo(W, LINE_Y)
    c.stroke()

    // aim line + landing ghost
    if (this.angle !== null && this.canAim()) {
      const path = trace(this.grid, SHOOT_X, SHOOT_Y, this.angle, this.top)
      c.strokeStyle = 'rgba(255,255,255,0.6)'
      c.lineWidth = 3
      c.setLineDash([2, 10])
      c.lineCap = 'round'
      c.beginPath()
      path.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)))
      c.stroke()
      const end = path[path.length - 1]
      const [gr, gc] = snapCell(this.grid, end.x, end.y, this.top)
      c.setLineDash([4, 4])
      c.lineWidth = 2
      c.strokeStyle = COLORS[this.current]
      c.beginPath()
      c.arc(cellX(gr, gc), cellY(gr, this.top), R - 2, 0, Math.PI * 2)
      c.stroke()
    }
    c.setLineDash([])

    for (const p of this.pops) this.drawBubble(p.x, p.y, p.color)
    for (const f of this.fallers) this.drawBubble(f.x, f.y, f.color)
    if (this.shot) this.drawBubble(this.shot.x, this.shot.y, this.shot.color)

    for (const p of this.particles) {
      c.globalAlpha = Math.max(0, p.life / p.max)
      c.fillStyle = p.color
      c.beginPath()
      c.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      c.fill()
    }
    c.globalAlpha = 1

    // launcher
    c.fillStyle = 'rgba(255,255,255,0.08)'
    c.beginPath()
    c.arc(SHOOT_X, SHOOT_Y, R + 12, 0, Math.PI * 2)
    c.fill()
    if (!this.over) this.drawBubble(SHOOT_X, SHOOT_Y, this.current)

    // next preview
    c.fillStyle = 'rgba(232,236,245,0.7)'
    c.font = '600 13px system-ui, sans-serif'
    c.textAlign = 'center'
    c.fillText('下一顆', 60, SHOOT_Y - 26)
    this.drawBubble(60, SHOOT_Y + 2, this.next, 0.75)
  }
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const mix = (v: number) => Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt))
  return `rgb(${mix(n >> 16)},${mix((n >> 8) & 255)},${mix(n & 255)})`
}

/** Pre-rendered glossy bubble so each frame is just drawImage calls. */
function bubbleSprite(color: string, pxPerUnit: number) {
  const size = R * 2 + 4
  const cv = document.createElement('canvas')
  cv.width = cv.height = Math.ceil(size * pxPerUnit)
  const c = cv.getContext('2d')!
  c.scale(cv.width / size, cv.height / size)
  const m = size / 2
  const g = c.createRadialGradient(m - R * 0.35, m - R * 0.4, R * 0.1, m, m, R)
  g.addColorStop(0, shade(color, 0.55))
  g.addColorStop(0.45, color)
  g.addColorStop(1, shade(color, -0.45))
  c.fillStyle = g
  c.beginPath()
  c.arc(m, m, R - 1, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = 'rgba(0,0,0,0.3)'
  c.lineWidth = 1
  c.stroke()
  c.fillStyle = 'rgba(255,255,255,0.75)'
  c.beginPath()
  c.ellipse(m - R * 0.35, m - R * 0.45, R * 0.3, R * 0.16, -0.6, 0, Math.PI * 2)
  c.fill()
  return cv
}
