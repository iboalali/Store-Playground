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
