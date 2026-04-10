# Store Playground

A desktop application for managing Google Play Store listing assets. It provides tools to manage, edit, and publish app listings across multiple languages and regions — all from a local workspace on disk.

## Features

- **Workspace-based management** -- Configure a local directory as your workspace; apps are stored as structured folders and JSON files
- **Multi-app support** -- Manage multiple apps from a single workspace with a home grid view
- **Store listing editor** -- Edit title, description, and short description for all supported languages
- **Screenshot manager** -- Organize screenshots and promotional graphics by device type and language
- **Release notes** -- Create and manage release notes across languages
- **Financial reports** -- View revenue, downloads, and other metrics with interactive charts
- **Google Play API integration** -- Connect with a service account to sync listings
- **Live reload** -- Workspace changes made outside the app are picked up automatically via file watching

## Tech Stack

- [Electron](https://www.electronjs.org/) 33 -- desktop shell
- [Svelte](https://svelte.dev/) 5 -- UI framework (runes)
- [electron-vite](https://electron-vite.org/) -- build tooling (Vite for main, preload, and renderer)
- [TypeScript](https://www.typescriptlang.org/) 5.7
- [electron-builder](https://www.electron.build/) -- packaging and distribution

## Prerequisites

- **Node.js** 18 or later (20 LTS recommended)
- **npm** 10 or later
- **git**

### Linux-specific

On Debian/Ubuntu you may also need native build dependencies for `sharp`:

```bash
sudo apt install build-essential libvips-dev
```

### macOS-specific

Xcode Command Line Tools are required for native modules:

```bash
xcode-select --install
```

## Getting Started

```bash
# Clone the repository
git clone https://github.com/iboalali/Store-Playground.git
cd Store-Playground

# Install dependencies
npm install

# Start the development server (opens an Electron window with hot reload)
npm run dev
```

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the app in development mode with hot reload |
| `npm run build` | Create a production build (output in `out/`) |
| `npm run start` | Preview the production build locally |
| `npm run typecheck` | Run TypeScript and Svelte type checks |
| `npm run typecheck:node` | Type-check main process code only |
| `npm run typecheck:web` | Type-check renderer code only |

## Building for Distribution

First, create the production bundles:

```bash
npm run build
```

Then package for your platform using electron-builder:

```bash
# macOS -- produces a .dmg in dist/
npx electron-builder --mac

# Linux -- produces an .AppImage in dist/
npx electron-builder --linux
```

Built artifacts are written to the `dist/` directory.

## Project Structure

```
src/
  main/            # Electron main process
    services/      # Business logic (filesystem, settings, file watching)
    ipc/           # IPC handler registrations
    index.ts       # App entry point
  preload/         # Context bridge (sandboxed)
  renderer/src/    # Svelte UI
    screens/       # Full-page views
    components/    # Reusable UI components
    stores/        # Svelte 5 state stores ($state, $derived)
    lib/           # Utilities (typed IPC wrapper, etc.)
  shared/          # Types and constants shared between processes
resources/         # App icons and build resources
```

## License

This project is not currently published under an open-source license.
