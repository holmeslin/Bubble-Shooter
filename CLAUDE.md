# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

泡泡龍 Bubble Shooter：Vue 3 + Vite + TypeScript 網頁遊戲，介面為繁體中文。遊戲畫面全部用 Canvas 繪製，音效全部用 Web Audio 合成，沒有任何遊戲引擎、音檔或圖片素材，請維持這個原則。

## 指令

- `npm run dev`：開發伺服器（已帶 `--host`，區網內的手機可直接連線測試觸控）
- `npm test`：Vitest 單元測試；跑單一測試用 `npx vitest run -t "<測試名稱>"`
- `npm run build`：`vue-tsc --noEmit` 型別檢查加上 `vite build`

## 架構

- `src/game/grid.ts`：純邏輯，不依賴 DOM，所有單元測試都針對這一層。內容包含六角格幾何（每排 8 顆，奇數排 7 顆並右移半格）、`neighbors`、同色 BFS `findMatches`、懸空 BFS `findFloating`、吸附 `snapCell` 和射擊模擬 `trace`。所有座標都是邏輯座標（`W`=400、`H`=610），繪製時才依實際寬度和 devicePixelRatio 縮放。
- `trace()` 同時用來畫瞄準線和決定實際飛行路徑。射擊時一次算出整條折線和落點，飛行動畫只是沿著折線移動，所以瞄準預測和實際結果一定一致。修改碰撞規則時只要改 `trace`。
- 天花板下降用 `drops` 計數表示，整面盤面以 `drops * ROW_H` 的距離往下畫。格子索引永遠不變，所以奇偶排的錯位不會因為下降而改變。遊戲結束的判定是 `lowestRow + drops >= DEAD_ROW`。
- `src/game/Game.ts`：Canvas 引擎，負責 requestAnimationFrame 迴圈、pointer 輸入、規則結算（`land`）、粒子和繪製。泡泡外觀是預先畫好的 sprite，`resize` 時重建。它透過 `onHud` 和 `onEnd` 兩個回呼和 Vue 溝通，本身不碰 Vue。
- `src/game/levels.ts`：10 個關卡的定義和 `generateLevel`。菱形和愛心是形狀遮罩，產生完會刪掉懸空泡泡，測試會確認每關都連得到天花板。
- `src/game/storage.ts`：localStorage 存檔，包含已解鎖關卡、每關最高分和靜音設定。讀取時會驗證每個欄位，因為使用者可以自行修改 localStorage。
- `src/game/audio.ts`：瀏覽器規定 AudioContext 要在使用者互動時才能建立。`App.vue` 在 `pointerdown`、`pointerup` 和 `click` 都會呼叫 `unlockAudio`，因為觸控要到 `pointerup` 或 `click` 才算使用者互動，請不要拿掉任何一個。
- 畫面切換由 `App.vue` 的 `screen` 狀態控制。`GameView` 用 `:key="run"` 綁定，「重新開始」和「下一關」都是讓 key 加一，重新掛載一個新的 `Game`。過關存檔在 `App.onWon` 裡處理。
