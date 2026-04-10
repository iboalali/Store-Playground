# Phase 10: Release Notes Manager

## Goal
A dedicated release notes management page with version/language CRUD, text editing with character limits, and a generate feature that combines release notes across versions into the Play Console's tag format.

## Data Model — File System Structure

```
/{app_root}/release_notes/
├── release_notes_config.json             # Version order + per-version metadata
└── /versions/
    └── /{version_name}/                  # e.g., "v2.0_Holiday"
        ├── en-US.txt                     # Release note text per locale
        ├── ar.txt
        └── de-DE.txt
```

Release note versions are **independent** of store listing versions — they have their own naming and lifecycle, similar to how the Screenshot Manager works.

## Config Schema

**`release_notes_config.json`:**
```json
{
  "versionOrder": ["v2.0_Holiday", "v1.0_Launch"],
  "versions": {
    "v1.0_Launch": { "createdAt": "2026-04-01T10:00:00Z" },
    "v2.0_Holiday": { "createdAt": "2026-04-05T14:00:00Z" }
  }
}
```

- `versionOrder` is ordered newest-first (index 0 = latest)
- Each version contains one `.txt` file per BCP-47 locale

## Shared Types

Added to `src/shared/types/models.ts`:

```typescript
export interface ReleaseNotesConfig {
  versionOrder: string[]
  versions: Record<string, { createdAt: string }>
}

export interface ReleaseNoteEntry {
  locale: string
  text: string
  charCount: number
}

export interface PreflightWarning {
  locale: string
  versionName: string
  severity: 'warning' | 'error'
  message: string
}
```

## IPC Channels

No new IPC channels needed. All operations use existing `fs:*` handlers:
- `ipc.readJsonFile` / `ipc.writeJsonFile` — config persistence
- `ipc.readTextFile` / `ipc.writeTextFile` — language text files
- `ipc.createDirectory` / `ipc.copyDirectory` — version creation/duplication
- `ipc.renameItem` — version renaming
- `ipc.deleteToTrash` — version/language deletion
- `ipc.listDirectory` — listing locale files in a version

## Route

Added to `router.svelte.ts`:
```typescript
| { screen: 'release-notes'; appPath: string }
```

Navigation function: `goToReleaseNotes(appPath: string)`

Breadcrumb: Home > App Name > Release Notes Manager

## Store — `release-notes.svelte.ts`

Class-based singleton following the `screenshot-manager.svelte.ts` pattern.

### State
- `appPath`, `config`, `activeVersionName`, `entries` (loaded locale entries), `loading`, `error`

### Derived
- `releaseNotesRoot` — `{appPath}/release_notes`
- `versionsDir` — `{releaseNotesRoot}/versions`
- `activeVersionDir` — `{versionsDir}/{activeVersionName}`

### Version CRUD
| Action | Behavior |
|--------|----------|
| **Add** | Creates empty version directory. Inserts at front of `versionOrder`. |
| **Duplicate** | Deep-copies active version directory (all `.txt` files). Inserts after source. |
| **Rename** | Renames directory. Updates config keys. |
| **Delete** | Moves to trash. Removes from config. Switches to next version. |

### Language CRUD
| Action | Behavior |
|--------|----------|
| **Add** | Opens LocaleSelector. Creates empty `{locale}.txt`. |
| **Duplicate** | Opens LocaleSelector for target. Copies source text to new file. |
| **Delete** | Confirmation dialog. Deletes `{locale}.txt`. |
| **Edit** | Textarea with live char count. Auto-saves on blur / 500ms debounce. |

### Generate Output
1. Scans all versions to collect all unique locales
2. For each locale (sorted), iterates versions newest → oldest
3. Appends text (separated by `\n\n`) until 500-char limit is reached
4. Formats as Play Console tag format:
   ```
   <en-US>
   Combined release notes
   </en-US>
   <ar>
   Combined release notes
   </ar>
   ```
5. Returns output string + preflight warnings

## Components

### `VersionSelector.svelte`
Tab bar with version tabs + action buttons (add, duplicate, rename, delete). Same pattern as Screenshot Manager's VersionSelector.

### `LanguageEntry.svelte`
Single language row: locale name/tag header, textarea, character count (gray/yellow at 90%/red over limit), duplicate and delete buttons.

### `LanguageList.svelte`
Vertical scrollable list of LanguageEntry components. Shows empty state when no languages added.

### `GenerateDialog.svelte`
Modal dialog with:
- Preflight panel: warnings list (collapsible) or "All checks passed" banner
- Output textarea: readonly, monospaced, formatted Play Console tags
- Actions: "Copy to Clipboard" (with visual confirmation) + "Close"

## Screen — `ReleaseNotesManager.svelte`

Top-level screen wiring store + components + dialogs:
- VersionSelector at top
- Toolbar with "Add Language" and "Generate Output" buttons
- LanguageList below
- Reuses existing `LocaleSelector.svelte` for language add/duplicate
- Reuses existing `ConfirmDialog.svelte` for deletion confirmations
- Inline prompt dialogs for version add/duplicate/rename

## Navigation

- "Release Notes" button on AppDashboard alongside Screenshot Manager and Financial Reports
- App.svelte renders ReleaseNotesManager when route is `release-notes`
- Watcher auto-refreshes store when files change externally

## Implementation Steps

1. Add `ReleaseNotesConfig`, `ReleaseNoteEntry`, `PreflightWarning` types to `models.ts`
2. Add `release-notes` route to `router.svelte.ts`
3. Create `release-notes.svelte.ts` store
4. Create components: `VersionSelector`, `LanguageEntry`, `LanguageList`, `GenerateDialog`
5. Create `ReleaseNotesManager.svelte` screen
6. Wire into `App.svelte` (import, route case, watcher refresh)
7. Add navigation button to `AppDashboard.svelte`

## Verification

1. `npm run dev` — app launches without errors
2. Dashboard → "Release Notes" → page loads
3. Create version → add languages → edit text → auto-saves
4. Duplicate/rename/delete versions and languages
5. Generate → preflight checks → formatted output → copy works
6. `npx svelte-check` — no type errors
7. `npx tsc --noEmit -p tsconfig.node.json` — no type errors
