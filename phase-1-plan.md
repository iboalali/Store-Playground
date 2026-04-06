# Phase 1: Project Scaffolding - Implementation Plan

## Context

Store Playground is a greenfield Electron + Svelte 5 desktop app for managing Google Play Store listing assets. The repo currently contains only documentation (tech-document.md, implementation-plan.md, LICENSE, README.md) — zero application code exists. Phase 1 creates the project skeleton: a running Electron window with Svelte 5 rendering "Store Playground".

**Branch:** `claude/phase-1-planning-X6Z9R`

---

## Files to Create (in order)

### 1. `.gitignore`
```
node_modules
out
dist
.env
.DS_Store
*.log
```

### 2. `package.json`
- name: `store-playground`, version: `0.1.0`, type: `module`
- main: `./out/main/index.js` (electron-vite output)
- Scripts:
  - `dev`: `electron-vite dev`
  - `build`: `electron-vite build`
  - `start`: `electron-vite preview`
  - `typecheck:node`: `tsc --noEmit -p tsconfig.node.json`
  - `typecheck:web`: `svelte-check --tsconfig ./tsconfig.web.json`
  - `typecheck`: `npm run typecheck:node && npm run typecheck:web`
- Runtime deps: `chokidar`, `googleapis`, `image-size`, `sharp`
- Dev deps: `electron`, `electron-vite`, `electron-builder`, `@sveltejs/vite-plugin-svelte`, `svelte`, `typescript`, `svelte-check`, `@electron-toolkit/preload`, `@electron-toolkit/utils`, `@types/node`, `vite`

### 3. `npm install`

### 4. `electron.vite.config.ts`
- Three sections: main, preload, renderer
- Externalize `sharp` (native bindings) in main/preload
- Renderer: `svelte()` plugin + path aliases (`$shared` -> `src/shared`, `$lib` -> `src/renderer/src/lib`)

### 5. TypeScript configs
- **`tsconfig.json`** — solution-style root, references node + web
- **`tsconfig.node.json`** — composite, ESNext module, bundler resolution, includes `electron.vite.config.ts`, `src/main/**`, `src/preload/**`, `src/shared/**`. Path alias: `$shared/*`
- **`tsconfig.web.json`** — composite, ESNext + DOM libs, includes `src/renderer/src/**/*.ts`, `src/renderer/src/**/*.svelte`, `src/shared/**`. Path aliases: `$shared/*`, `$lib/*`

### 6. `svelte.config.js`
- `vitePreprocess()` from `@sveltejs/vite-plugin-svelte`

### 7. `src/shared/types/index.ts`
- Empty placeholder (`export {}`) — establishes path alias target for Phase 2

### 8. `src/main/index.ts`
- `app.whenReady()` -> `createWindow()`
- BrowserWindow: 1200x800, `show: false` + `ready-to-show` pattern
- Security: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`
- Preload path: `join(__dirname, '../preload/index.mjs')`
- Dev: load `process.env.ELECTRON_RENDERER_URL` via `@electron-toolkit/utils` `is.dev`
- Prod: `loadFile(join(__dirname, '../renderer/index.html'))`
- macOS `activate` + cross-platform `window-all-closed` handlers
- `setWindowOpenHandler` to open external links in system browser

### 9. `src/preload/index.ts`
- `contextBridge.exposeInMainWorld('electron', electronAPI)` from `@electron-toolkit/preload`
- `contextBridge.exposeInMainWorld('api', {})` — empty placeholder for Phase 2+ IPC methods

### 10. `src/renderer/index.html`
- Standard HTML5, CSP meta tag (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'`)
- `<div id="app"></div>`
- `<script type="module" src="./src/main.ts"></script>`

### 11. `src/renderer/src/main.ts`
- Svelte 5 `mount()` API (NOT constructor): `mount(App, { target: document.getElementById('app')! })`
- Import global.css

### 12. `src/renderer/src/App.svelte`
- Svelte 5 runes: `let greeting = $state('Store Playground')`
- Centered layout with title + subtitle "Electron + Svelte 5 scaffolding complete."

### 13. `src/renderer/src/assets/styles/global.css`
- Box-sizing reset, system font stack, background #fafafa, full-height `#app`

### 14. `resources/icon.png`
- Generate a 256x256 placeholder PNG (blue background with "SP" text, or minimal valid PNG)

### 15. `electron-builder.yml`
- appId: `com.store-playground.app`
- buildResources: `resources`, output: `dist`
- files: `out/**/*` (exclude `out/types-*`)
- asarUnpack: `node_modules/sharp/**`
- Targets: nsis (win), dmg (mac), AppImage (linux)

---

## Final Directory Structure

```
Store-Playground/
├── .gitignore
├── package.json
├── package-lock.json
├── electron.vite.config.ts
├── electron-builder.yml
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
├── svelte.config.js
├── resources/
│   └── icon.png
└── src/
    ├── main/
    │   └── index.ts
    ├── preload/
    │   └── index.ts
    ├── shared/
    │   └── types/
    │       └── index.ts
    └── renderer/
        ├── index.html
        └── src/
            ├── main.ts
            ├── App.svelte
            └── assets/
                └── styles/
                    └── global.css
```

---

## Key Technical Decisions

1. **Svelte 5 `mount()` API** — not the Svelte 4 constructor pattern
2. **Path aliases** must match between `electron.vite.config.ts` (runtime) and `tsconfig.web.json` (type-checking)
3. **`sharp` externalized** in rollup — native bindings can't be bundled; `asarUnpack` handles production
4. **electron-vite v3** auto-externalizes Electron + Node built-ins for main/preload
5. **Empty `api` preload object** establishes the pattern for Phase 2 typed IPC
6. **Preload output is `.mjs`** — electron-vite outputs ESM for preload, so main process must reference `../preload/index.mjs`

---

## Verification

1. `npm run typecheck:node` — no TypeScript errors in main/preload
2. `npm run typecheck:web` — no Svelte/TS errors in renderer
3. `npm run dev` — Electron window launches, shows "Store Playground" centered
4. `npm run build` — produces `out/main/index.js`, `out/preload/index.mjs`, `out/renderer/index.html`
