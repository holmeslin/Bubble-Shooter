// All sound effects are synthesised with Web Audio; no audio files.
let ctx: AudioContext | null = null
let muted = false

export const setMuted = (m: boolean) => { muted = m }

/** Browsers only allow audio after a user gesture, so call this from one. */
export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch { /* no Web Audio support: stay silent */ }
}

function tone(f0: number, f1: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, at = 0) {
  if (muted || !ctx) return
  const t = ctx.currentTime + at
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(f1, t + dur)
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  o.connect(g).connect(ctx.destination)
  o.start(t)
  o.stop(t + dur)
}

function noise(dur: number, vol: number, freq: number) {
  if (muted || !ctx) return
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
  const src = ctx.createBufferSource()
  const filter = ctx.createBiquadFilter()
  const g = ctx.createGain()
  src.buffer = buf
  filter.type = 'bandpass'
  filter.frequency.value = freq
  g.gain.value = vol
  src.connect(filter).connect(g).connect(ctx.destination)
  src.start()
}

export const sfx = {
  shoot: () => tone(320, 880, 0.12, 'triangle', 0.12),
  bounce: () => tone(620, 480, 0.05, 'square', 0.04),
  stick: () => tone(180, 80, 0.12, 'sine', 0.22),
  pop: (combo: number) => {
    const f = 520 * 1.12 ** Math.min(combo, 8) // pitch rises with the combo
    tone(f, f * 2, 0.14, 'sine', 0.18)
    noise(0.1, 0.25, 2500)
  },
  drop: () => tone(700, 140, 0.45, 'triangle', 0.12),
  ceiling: () => noise(0.25, 0.4, 300),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.3, 'triangle', 0.15, i * 0.12)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, f * 0.97, 0.4, 'sawtooth', 0.07, i * 0.2)),
}
