<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { Game, type HudState } from '../game/Game'
import { H, W } from '../game/grid'
import { LEVELS } from '../game/levels'

const props = defineProps<{ levelIndex: number; best: number; muted: boolean }>()
const emit = defineEmits<{ won: [score: number]; restart: []; next: []; menu: []; toggleMute: [] }>()

const level = LEVELS[props.levelIndex]
const isLast = props.levelIndex === LEVELS.length - 1
const canvas = ref<HTMLCanvasElement>()
const hud = reactive<HudState>({ score: 0, combo: 0, dropIn: null })
const panel = ref<null | 'pause' | 'won' | 'lost'>(null)
const finalScore = ref(0)
const isRecord = ref(false)
let game: Game

const HUD_HEIGHT = 64

function fit() {
  game.resize(Math.floor(Math.min(420, window.innerWidth, ((window.innerHeight - HUD_HEIGHT) * W) / H)))
}

function pause() {
  if (panel.value || game.ended) return // pausing during the end delay could discard a win
  panel.value = 'pause'
  game.paused = true
}

function resume() {
  panel.value = null
  game.paused = false
}

const onVisibility = () => { if (document.hidden) pause() }

onMounted(() => {
  game = new Game(canvas.value!, level, {
    onHud: (h) => Object.assign(hud, h),
    onEnd: (won, score) => {
      finalScore.value = score
      if (won) {
        isRecord.value = score > props.best
        emit('won', score)
      }
      panel.value = won ? 'won' : 'lost'
    },
  })
  fit()
  window.addEventListener('resize', fit)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  game.destroy()
  window.removeEventListener('resize', fit)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <div class="game">
    <header class="hud">
      <button class="icon-btn" aria-label="暫停" @click="pause">❚❚</button>
      <div class="stat"><small>第 {{ levelIndex + 1 }} 關</small><b>{{ hud.score }}</b></div>
      <div class="stat"><small>連擊</small><b :class="{ hot: hud.combo > 1 }">×{{ Math.max(1, Math.min(hud.combo, 5)) }}</b></div>
      <div class="stat"><small>下降倒數</small><b>{{ hud.dropIn ?? '—' }}</b></div>
      <button class="icon-btn" :aria-label="muted ? '開啟聲音' : '靜音'" @click="emit('toggleMute')">{{ muted ? '🔇' : '🔊' }}</button>
    </header>

    <canvas ref="canvas" class="board" />

    <div v-if="panel" class="overlay">
      <div class="panel">
        <template v-if="panel === 'pause'">
          <h2>暫停</h2>
          <button class="btn primary" @click="resume">繼續遊戲</button>
          <button class="btn" @click="emit('restart')">重新開始</button>
          <button class="btn" @click="emit('menu')">回主選單</button>
        </template>
        <template v-else-if="panel === 'won'">
          <h2 class="title small">{{ isLast ? '全部通關！' : '過關！' }}</h2>
          <p class="level-name">第 {{ levelIndex + 1 }} 關 · {{ level.name }}</p>
          <p class="score">{{ finalScore }}</p>
          <p v-if="isRecord" class="record">★ 新紀錄！</p>
          <button v-if="!isLast" class="btn primary" @click="emit('next')">下一關</button>
          <button class="btn" :class="{ primary: isLast }" @click="emit('menu')">回主選單</button>
        </template>
        <template v-else>
          <h2>遊戲結束</h2>
          <p class="level-name">第 {{ levelIndex + 1 }} 關 · {{ level.name }}</p>
          <p class="score">{{ finalScore }}</p>
          <button class="btn primary" @click="emit('restart')">再玩一次</button>
          <button class="btn" @click="emit('menu')">回主選單</button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.game { position: relative; display: flex; flex-direction: column; align-items: center; }
.hud {
  width: 100%; height: 64px; display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding: 8px 12px;
}
.stat { display: flex; flex-direction: column; align-items: center; min-width: 64px; }
.stat small { color: var(--muted); font-size: 12px; }
.stat b { font-size: 20px; font-variant-numeric: tabular-nums; }
.stat b.hot { color: var(--yellow); }
.board { display: block; touch-action: none; }
.overlay {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(6, 10, 20, 0.45); padding: 16px;
}
.panel { width: 100%; max-width: 320px; display: flex; flex-direction: column; gap: 12px; text-align: center; }
.panel h2 { margin: 0 0 4px; font-size: 30px; }
.level-name { margin: 0; color: var(--muted); }
.score { margin: 0; font-size: 44px; font-weight: 800; font-variant-numeric: tabular-nums; }
.record { margin: 0; color: var(--yellow); font-weight: 700; }
</style>
