import { readdir, readFile, mkdir, writeFile, copyFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import type { AppConfig, AppEntry } from '$shared/types/models'

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

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}
