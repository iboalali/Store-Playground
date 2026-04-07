// Application settings persisted in userData/settings.json
export interface Settings {
  workspacePath: string | null
  serviceAccountKeyPath: string | null
}

// Per-app config stored in {appRoot}/app_config.json
export interface AppConfig {
  appName: string
  packageName: string
  liveVersionDir: string | null
}

// Per-app global details stored in {appRoot}/app_details.json
export interface AppDetails {
  defaultLanguage: string
  contactEmail: string
  contactWebsite: string
  contactPhone: string
  privacyPolicyUrl: string
}

export type VersionStatus = 'draft' | 'published' | 'archived'

// Per-version metadata stored in {versionDir}/version_metadata.json
export interface VersionMetadata {
  createdAt: string
  status: VersionStatus
  customNotes: string
}

// Returned by readWorkspace — combines config with its filesystem location
export interface AppEntry {
  appPath: string
  config: AppConfig
  hasIcon: boolean
}

// Returned by listVersions — a version directory with its metadata
export interface VersionEntry {
  dirName: string
  dirPath: string
  metadata: VersionMetadata
  isLive: boolean
}

// --- Phase 5: Store Listing Editor types ---

export type ScreenshotType = 'phone' | 'tablet_7' | 'tablet_10' | 'tv' | 'wear'

export interface LocaleTextFields {
  title: string
  shortDescription: string
  fullDescription: string
  videoUrl: string
}

export interface ScreenshotEntry {
  fileName: string
  filePath: string
}

export interface ScreenshotGroup {
  type: ScreenshotType
  dirPath: string
  screenshots: ScreenshotEntry[]
}

export interface DirectoryEntry {
  name: string
  isDirectory: boolean
}

// --- Phase 5.5: Screenshot Manager types ---

export interface ScreenshotConfig {
  versionOrder: string[]
  versions: Record<string, { createdAt: string; screenOrder: string[] }>
}

export interface ScreenMeta {
  displayName: string
  variantOrder: string[]
  variantNames: Record<string, string>
}

export interface VariantData {
  slug: string
  displayName: string
  filePath: string
  hasImage: boolean
}

export interface ScreenData {
  slug: string
  displayName: string
  dirPath: string
  variants: VariantData[]
}

export interface VersionData {
  name: string
  createdAt: string
  screens: ScreenData[]
}

// --- Phase 6: Validation Engine types ---

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

// --- Phase 7: Google Play API Integration types ---

export interface ProgressStep {
  id: string
  label: string
  status: 'pending' | 'active' | 'done' | 'error'
  error?: string
}

export interface ProgressEvent {
  operationType: 'publish' | 'import'
  steps: ProgressStep[]
  finished: boolean
  abortError?: string
}
