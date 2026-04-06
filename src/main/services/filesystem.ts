import { readdir, readFile, mkdir, writeFile, copyFile, access, rename, cp } from 'node:fs/promises'
import { join } from 'node:path'
import type { AppConfig, AppDetails, AppEntry, VersionMetadata } from '$shared/types/models'

export async function readWorkspace(workspacePath: string): Promise<AppEntry[]> {
  const entries = await readdir(workspacePath, { withFileTypes: true })
  const apps: AppEntry[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const appPath = join(workspacePath, entry.name)
    const configPath = join(appPath, 'app_config.json')

    try {
      const raw = await readFile(configPath, 'utf-8')
      const config = JSON.parse(raw) as AppConfig
      const hasIcon = await fileExists(join(appPath, 'icon.png'))
      apps.push({ appPath, config, hasIcon })
    } catch {
      // Not an app directory — skip silently
    }
  }

  return apps.sort((a, b) => a.config.appName.localeCompare(b.config.appName))
}

export async function readAppConfig(appPath: string): Promise<AppConfig> {
  const raw = await readFile(join(appPath, 'app_config.json'), 'utf-8')
  return JSON.parse(raw) as AppConfig
}

export async function createDirectory(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true })
}

export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

export async function copyImage(src: string, dest: string): Promise<void> {
  await copyFile(src, dest)
}

export async function readAppDetails(appPath: string): Promise<AppDetails> {
  const raw = await readFile(join(appPath, 'app_details.json'), 'utf-8')
  return JSON.parse(raw) as AppDetails
}

export async function listVersions(
  appPath: string
): Promise<{ dirName: string; dirPath: string; metadata: VersionMetadata }[]> {
  const entries = await readdir(appPath, { withFileTypes: true })
  const versions: { dirName: string; dirPath: string; metadata: VersionMetadata }[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const dirPath = join(appPath, entry.name)
    const metaPath = join(dirPath, 'version_metadata.json')
    try {
      const raw = await readFile(metaPath, 'utf-8')
      const metadata = JSON.parse(raw) as VersionMetadata
      versions.push({ dirName: entry.name, dirPath, metadata })
    } catch {
      // Not a version directory — skip
    }
  }

  return versions.sort(
    (a, b) => new Date(b.metadata.createdAt).getTime() - new Date(a.metadata.createdAt).getTime()
  )
}

export async function copyDirectory(src: string, dest: string): Promise<void> {
  await cp(src, dest, { recursive: true })
}

export async function renameItem(oldPath: string, newPath: string): Promise<void> {
  await rename(oldPath, newPath)
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await writeFile(filePath, content, 'utf-8')
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
