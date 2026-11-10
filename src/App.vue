<script setup lang="ts">
import { reactive, ref } from 'vue'
import GameView from './components/GameView.vue'
import { setMuted, unlockAudio } from './game/audio'
import { LEVELS } from './game/levels'
import { loadSave, writeSave } from './game/storage'

const save = reactive(loadSave())
setMuted(save.muted)

const screen = ref<'menu' | 'levels' | 'game'>('menu')
const level = ref(0)
const run = ref(0) // bumping the key remounts GameView = fresh game

function play(i: number) {
  level.value = i
  run.value++
  screen.value = 'game'
}

function toggleMute() {
  save.muted = !save.muted
  setMuted(save.muted)
  writeSave(save)
}

function onWon(score: number) {
  const i = level.value
  if (score > (save.best[i] ?? 0)) save.best[i] = score
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, i + 2))
  writeSave(save)
}
</script>

<template>
  <!-- touch only grants audio permission on pointerup/click, mouse on pointerdown -->
  <div class="app" @pointerdown="unlockAudio" @pointerup="unlockAudio" @click="unlockAudio">
    <main v-if="screen === 'menu'" class="menu">
      <button class="icon-btn mute" :aria-label="save.muted ? '開啟聲音' : '靜音'" @click="toggleMute">
        {{ save.muted ? '🔇' : '🔊' }}
      </button>
      <h1 class="title">泡泡龍</h1>
      <p class="subtitle">BUBBLE SHOOTER</p>
      <div class="panel menu-buttons">
        <button class="btn primary" @click="play(save.unlocked - 1)">開始遊戲</button>
        <button class="btn" @click="screen = 'levels'">選擇關卡</button>
      </div>
    </main>

    <section v-else-if="screen === 'levels'" class="levels">
      <header class="levels-head">
        <button class="icon-btn" aria-label="返回" @click="screen = 'menu'">‹</button>
        <h2 class="title small">選擇關卡</h2>
        <span class="spacer" />
      </header>
      <div class="level-grid">
        <button
          v-for="(lv, i) in LEVELS" :key="i" class="level-cell panel"
          :disabled="i >= save.unlocked" @click="play(i)"
        >
          <span class="num">{{ i + 1 }}</span>
          <span class="name">{{ lv.name }}</span>
          <span v-if="i < save.unlocked" class="best">最高 {{ save.best[i] ?? 0 }}</span>
          <span v-else class="lock" aria-label="未解鎖">🔒</span>
        </button>
      </div>
    </section>

    <GameView
      v-else :key="run" :level-index="level" :best="save.best[level] ?? 0" :muted="save.muted"
      @won="onWon" @restart="run++" @next="play(level + 1)" @menu="screen = 'menu'" @toggle-mute="toggleMute"
    />
  </div>
</template>

<style scoped>
.menu {
  position: relative; flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 8px; padding: 24px 16px;
}
.mute { position: absolute; top: 16px; right: 16px; }
.subtitle { margin: 0 0 32px; letter-spacing: 0.3em; color: var(--muted); font-size: 13px; }
.menu-buttons { width: 100%; max-width: 300px; display: flex; flex-direction: column; gap: 12px; }
.levels { padding: 16px; }
.levels-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.spacer { width: 44px; }
.level-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.level-cell {
  aspect-ratio: 1; padding: 8px; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 2px; color: var(--text); font: inherit; cursor: pointer;
  transition: transform 0.15s;
}
.level-cell:not(:disabled):active { transform: scale(0.95); }
.level-cell:disabled { opacity: 0.45; cursor: not-allowed; }
.num { font-size: 26px; font-weight: 800; }
.name { font-size: 14px; }
.best { font-size: 12px; color: var(--yellow); }
.lock { font-size: 16px; }
</style>
