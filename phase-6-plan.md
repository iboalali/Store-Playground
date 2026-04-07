# Phase 6: Validation Engine - Implementation Plan

## Context

Phase 6 adds a pre-publish validation engine to the Store Playground app. Currently, the app allows editing text fields, images, and screenshots with no enforcement of Google Play's constraints beyond visual char count indicators in `TextEditor.svelte`. There is no publish button yet. This phase creates the backend validation service, wires it via IPC, adds inline validation feedback in the editor, and adds a "Publish" button on version cards that is gated by validation results.

**Problem:** Users can save content that violates Google Play requirements (oversized text, wrong image dimensions, insufficient screenshots). There's no way to check readiness before publishing.

**Outcome:** A validation engine that checks all Google Play constraints (text limits, image specs, screenshot counts, video URL format), surfaces errors inline in the editor UI, and gates a Publish button on the dashboard with a tooltip showing what's failing.

---

## Google Play Validation Rules (from tech-document.md)

### Text Limits
| Field | Max Chars |
|-------|----------|
| title.txt | 30 |
| short_description.txt | 80 |
| full_description.txt | 4,000 |

### Image Specs
| Image | Dimensions | Max Size | Format |
|-------|-----------|----------|--------|
| high_res_icon.png | 512x512 | 1MB | 32-bit PNG with alpha |
| feature_graphic.png | 1024x500 | 1MB | JPEG or 24-bit PNG (no alpha) |
| tv_banner.png | 1280x720 | 1MB | JPEG or 24-bit PNG (no alpha) |

### Screenshot Specs
- Min length: 320px, Max length: 3840px
- Max aspect ratio: 2:1
- Max file size: 8MB
- Format: JPEG or 24-bit PNG (no alpha)

### Screenshot Counts (enforced on publish)
| Type | Min | Max |
|------|-----|-----|
| phone | 2 | 8 |
| tablet_7 | 4 (when provided) | 8 |
| tablet_10 | 4 (when provided) | 8 |
| tv | 1 (when provided) | 8 |
| wear | 1 (when provided) | 8 |

### Video URL
- Must be a valid URL if present and non-empty
- Empty/absent passes validation

---

## Implementation Steps

### Step 1: Create `src/main/constants.ts`

Central constants file for validation rules, imported by validation service.

```typescript
// BCP-47 locales supported by Google Play (77 locales)
export const GOOGLE_PLAY_LOCALES: string[] = [
  'af', 'am', 'ar', 'hy-AM', 'az-AZ', 'eu-ES', 'be', 'bn-BD', 'bg',
  'my-MM', 'ca', 'zh-HK', 'zh-CN', 'zh-TW', 'hr', 'cs-CZ', 'da-DK',
  'nl-NL', 'en-AU', 'en-CA', 'en-IN', 'en-SG', 'en-GB', 'en-US', 'et',
  'fil', 'fi-FI', 'fr-CA', 'fr-FR', 'gl-ES', 'ka-GE', 'de-DE', 'el-GR',
  'gu', 'iw-IL', 'hi-IN', 'hu-HU', 'is-IS', 'id', 'it-IT', 'ja-JP',
  'kn-IN', 'kk', 'km-KH', 'ko-KR', 'ky-KG', 'lo-LA', 'lv', 'lt',
  'mk-MK', 'ms', 'ms-MY', 'ml-IN', 'mr-IN', 'mn-MN', 'ne-NP', 'no-NO',
  'fa', 'pl-PL', 'pt-BR', 'pt-PT', 'pa', 'ro', 'rm', 'ru-RU', 'sr',
  'si-LK', 'sk', 'sl', 'es-419', 'es-ES', 'es-US', 'sw', 'sv-SE',
  'ta-IN', 'te-IN', 'th', 'tr-TR', 'uk', 'ur', 'vi', 'zu'
]

// Text field character limits
export const TEXT_LIMITS = {
  title: 30,
  shortDescription: 80,
  fullDescription: 4000
} as const

// Image specifications
export const IMAGE_SPECS = {
  'high_res_icon.png': {
    width: 512, height: 512,
    maxBytes: 1_048_576,
    allowAlpha: true,
    formats: ['png'] as string[]
  },
  'feature_graphic.png': {
    width: 1024, height: 500,
    maxBytes: 1_048_576,
    allowAlpha: false,
    formats: ['png', 'jpeg'] as string[]
  },
  'tv_banner.png': {
    width: 1280, height: 720,
    maxBytes: 1_048_576,
    allowAlpha: false,
    formats: ['png', 'jpeg'] as string[]
  }
} as const

// Screenshot specs (shared across all types)
export const SCREENSHOT_SPECS = {
  minDimension: 320,
  maxDimension: 3840,
  maxAspectRatio: 2,
  maxBytes: 8_388_608,
  allowAlpha: false,
  formats: ['png', 'jpeg'] as string[]
} as const

// Screenshot count limits per type
export const SCREENSHOT_LIMITS: Record<string, { min: number; max: number; requiredWhenPresent: boolean }> = {
  phone: { min: 2, max: 8, requiredWhenPresent: false },
  tablet_7: { min: 4, max: 8, requiredWhenPresent: true },
  tablet_10: { min: 4, max: 8, requiredWhenPresent: true },
  tv: { min: 1, max: 8, requiredWhenPresent: true },
  wear: { min: 1, max: 8, requiredWhenPresent: true }
}

// Directory name to API image type mapping
export const DIR_TO_API_TYPE: Record<string, string> = {
  phone: 'phoneScreenshots',
  tablet_7: 'sevenInchScreenshots',
  tablet_10: 'tenInchScreenshots',
  tv: 'tvScreenshots',
  wear: 'wearScreenshots'
}
```

### Step 2: Create `src/main/services/image-utils.ts`

Image inspection utilities using `sharp` and `image-size`. Pure functions, no Electron imports.

```typescript
import sharp from 'sharp'
import imageSize from 'image-size'
import { stat } from 'node:fs/promises'

export interface ImageInfo {
  width: number
  height: number
  format: string
  hasAlpha: boolean
  fileSizeBytes: number
}

export async function getImageInfo(filePath: string): Promise<ImageInfo> {
  const dimensions = imageSize(filePath)
  const metadata = await sharp(filePath).metadata()
  const stats = await stat(filePath)

  return {
    width: dimensions.width ?? 0,
    height: dimensions.height ?? 0,
    format: metadata.format ?? 'unknown',
    hasAlpha: metadata.hasAlpha ?? false,
    fileSizeBytes: stats.size
  }
}
```

### Step 3: Create `src/main/services/validation.ts`

Pure validation functions. Each returns arrays of `ValidationError`.

**Validation report types (add to `src/shared/types/models.ts`):**
```typescript
export interface ValidationError {
  field: string
  locale?: string
  message: string
  severity: 'error' | 'warning'
}

export interface ValidationReport {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
  checkedAt: string
}
```

**Functions in validation.ts:**
- `validateText(fieldName, content, maxLength)` — returns errors if over limit or empty title
- `validateImage(filePath, specKey)` — reads image via image-utils, checks dimensions/format/alpha/size against IMAGE_SPECS
- `validateScreenshotImage(filePath)` — checks screenshot constraints (dimension range, aspect ratio, size, format)
- `validateScreenshotCount(type, count)` — checks per-type min/max from SCREENSHOT_LIMITS
- `validateVideoUrl(url)` — URL.parse check, empty string passes
- `validateLocale(localePath, locale)` — reads all text files + images + screenshot dirs, runs individual validators
- `validateVersionForPublish(versionDir)` — scans all locale dirs, calls validateLocale for each, aggregates into ValidationReport

**Severity rules:**
- **Errors** (block publish): title empty, title/short/full over limit, icon missing/invalid, phone screenshots < 2, tablet screenshots < 4 when present, invalid screenshot dimensions
- **Warnings** (informational): feature graphic missing, TV banner missing, video URL empty

### Step 4: Add IPC Types

**`src/shared/types/ipc-channels.ts`** — add:
```typescript
export const VALIDATION_VALIDATE_VERSION = 'validation:validate-version' as const
```
Add to the `IpcChannel` union.

**`src/shared/types/ipc-payloads.ts`** — add:
```typescript
export interface ValidationValidateVersionRequest {
  versionDir: string
}
export type ValidationValidateVersionResponse = IpcResult<ValidationReport>
```

### Step 5: Create `src/main/ipc/validation-handlers.ts`

Register handler for `validation:validate-version`:
```typescript
import { ipcMain } from 'electron'
import { VALIDATION_VALIDATE_VERSION } from '$shared/types/ipc-channels'
import { validateVersionForPublish } from '../services/validation'

export function registerValidationHandlers(): void {
  ipcMain.handle(VALIDATION_VALIDATE_VERSION, async (_event, args) => {
    try {
      const report = await validateVersionForPublish(args.versionDir)
      return { success: true, data: report }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}
```

### Step 6: Wire Main Process Entry Point

**`src/main/index.ts`** — add:
```typescript
import { registerValidationHandlers } from './ipc/validation-handlers'
// In app.whenReady():
registerValidationHandlers()
```

### Step 7: Wire Preload Bridge

**`src/preload/index.ts`** — add import for `VALIDATION_VALIDATE_VERSION`, add method:
```typescript
validateVersion: (args: { versionDir: string }) =>
  ipcRenderer.invoke(VALIDATION_VALIDATE_VERSION, args),
```

### Step 8: Wire Renderer IPC Wrapper

**`src/renderer/src/lib/ipc.ts`** — add:
```typescript
async validateVersion(versionDir: string): Promise<ValidationReport> {
  return unwrap(await window.api.validateVersion({ versionDir }))
},
```

### Step 9: Enhance Editor Components with Validation Feedback

**`src/renderer/src/components/editor/TextEditor.svelte`:**
- Add optional `error?: string` prop
- Below the input/textarea, show `{#if error}<span class="validation-error">{error}</span>{/if}`
- Add `.validation-error` style (red, small font)
- If `error` is set, apply red border (similar to existing `.over-limit`)

**`src/renderer/src/components/editor/ImageSlot.svelte`:**
- Add optional `validationError?: string` prop
- Show error message below the slot
- Red border when error present

**`src/renderer/src/components/editor/ScreenshotSection.svelte`:**
- Add optional `validationError?: string` prop
- Show error text below the screenshot counter (e.g., "Minimum 2 phone screenshots required")

### Step 10: Add Validation State to Editor Store

**`src/renderer/src/stores/editor.svelte.ts`:**
```typescript
// New state fields
validationReport = $state<ValidationReport | null>(null)
validating = $state(false)

// Derived: per-field errors for active locale
localeErrors = $derived.by(() => {
  if (!this.validationReport || !this.activeLocale) return {}
  const errors: Record<string, string> = {}
  for (const err of [...this.validationReport.errors, ...this.validationReport.warnings]) {
    if (err.locale === this.activeLocale && !errors[err.field]) {
      errors[err.field] = err.message
    }
  }
  return errors
})

// New method
async validateVersion(): Promise<ValidationReport | null> {
  if (!this.versionPath) return null
  this.validating = true
  try {
    this.validationReport = await ipc.validateVersion(this.versionPath)
    return this.validationReport
  } catch (err) {
    this.error = String(err)
    return null
  } finally {
    this.validating = false
  }
}
```

### Step 11: Wire Validation into StoreListingEditor

**`src/renderer/src/screens/StoreListingEditor.svelte`:**
- Add "Validate" button next to Save button
- Pass `error` props from `editorStore.localeErrors` to TextEditor components
- Pass `validationError` props to ImageSlot and ScreenshotSection components
- Show validation summary banner when report exists (X errors, Y warnings)

### Step 12: Add Publish Button to VersionActions

**`src/renderer/src/components/dashboard/VersionActions.svelte`:**
- Add "Validate for Publish" button (between Edit and Duplicate)
- On click: call `currentAppStore.validateVersion(version.dirName)`
- Show result: green check if valid, red X with error count if not
- If invalid, show tooltip with error summary on hover (using Tooltip component)

### Step 13: Add Validation to Current App Store

**`src/renderer/src/stores/current-app.svelte.ts`:**
```typescript
validationResults = $state<Record<string, ValidationReport>>({})
validatingVersion = $state<string | null>(null)

async validateVersion(dirName: string): Promise<ValidationReport | null> {
  const version = this.versions.find(v => v.dirName === dirName)
  if (!version) return null
  this.validatingVersion = dirName
  try {
    const report = await ipc.validateVersion(version.dirPath)
    this.validationResults[dirName] = report
    return report
  } catch (err) {
    this.error = String(err)
    return null
  } finally {
    this.validatingVersion = null
  }
}
```

### Step 14: Create Tooltip Component

**`src/renderer/src/components/shared/Tooltip.svelte`:**
- Simple CSS-only tooltip shown on hover
- Props: `text: string`
- Wraps slotted content, shows tooltip on hover via CSS `::after` or positioned div

### Step 15: Show Validation Badge on VersionCard

**`src/renderer/src/components/dashboard/VersionCard.svelte`:**
- Read validation result from `currentAppStore.validationResults[version.dirName]`
- Show small colored badge: green checkmark (valid), red circle with error count (invalid), gray (not validated)

---

## Files Summary

### New Files (6)
| File | Purpose |
|------|---------|
| `src/main/constants.ts` | Centralized validation rules, locale list, image specs |
| `src/main/services/image-utils.ts` | Image dimension/format/alpha inspection via sharp + image-size |
| `src/main/services/validation.ts` | Pure validation functions for text, images, screenshots, video URL, full version |
| `src/main/ipc/validation-handlers.ts` | IPC handler for `validation:validate-version` |
| `src/renderer/src/components/shared/Tooltip.svelte` | Reusable hover tooltip component |
| `phase-6-plan.md` | This plan file (repo root) |

### Modified Files (14)
| File | Changes |
|------|---------|
| `src/shared/types/models.ts` | Add `ValidationError`, `ValidationReport` interfaces |
| `src/shared/types/ipc-channels.ts` | Add `VALIDATION_VALIDATE_VERSION` channel + union |
| `src/shared/types/ipc-payloads.ts` | Add validation request/response types |
| `src/main/index.ts` | Import + register validation handlers |
| `src/preload/index.ts` | Expose `validateVersion` method |
| `src/renderer/src/lib/ipc.ts` | Add `validateVersion()` wrapper |
| `src/renderer/src/stores/editor.svelte.ts` | Add validation state, `validateVersion()`, derived locale errors |
| `src/renderer/src/stores/current-app.svelte.ts` | Add per-version validation results, `validateVersion()` |
| `src/renderer/src/screens/StoreListingEditor.svelte` | Wire inline validation errors, add Validate button |
| `src/renderer/src/components/dashboard/VersionActions.svelte` | Add Validate for Publish button |
| `src/renderer/src/components/dashboard/VersionCard.svelte` | Show validation status badge |
| `src/renderer/src/components/editor/TextEditor.svelte` | Add optional `error` prop for inline errors |
| `src/renderer/src/components/editor/ImageSlot.svelte` | Add optional `validationError` prop |
| `src/renderer/src/components/editor/ScreenshotSection.svelte` | Add optional `validationError` prop |

---

## Key Design Decisions

1. **Validation runs on-demand, not live** — Running sharp on every image change would be expensive. Validation is triggered explicitly via Validate button or Publish button click.

2. **Backend-only validation** — All validation logic lives in the main process where `sharp` and `image-size` are available. The renderer only displays results received via IPC.

3. **Single IPC call for full version** — `validateVersionForPublish` scans the entire version directory in one call rather than per-field, avoiding IPC chattiness.

4. **Error vs Warning severity** — Errors block publishing, warnings are informational. This avoids false-blocking on optional assets like TV banners.

5. **Publish button is validation-only in Phase 6** — The actual publish API call is Phase 7. Phase 6 adds a "Validate for Publish" button that runs validation and shows results.

6. **Existing char count UI preserved** — TextEditor already shows live char counts with color changes. Validation errors add a separate error message layer for post-validation feedback.

---

## Verification

1. `npm run dev` — app launches without errors
2. `npx svelte-check` — no type errors in renderer
3. `npx tsc --noEmit -p tsconfig.node.json` — no type errors in main/preload
4. **Text validation**: Type >30 chars in title, run validate, see error on title field
5. **Image validation**: Add a wrong-dimension image as icon, validate, see error on icon slot
6. **Screenshot count**: Have 0-1 phone screenshots, validate, see "Minimum 2 required" error
7. **Video URL**: Enter invalid URL, validate, see error
8. **Full version validate**: Click "Validate for Publish" on dashboard, see report summary
9. **Clean version**: Fix all errors, re-validate, see green/passing status
10. **Warning display**: Missing feature graphic shows as warning (yellow), not error (red)
