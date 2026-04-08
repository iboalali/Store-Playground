import { ipc } from '$lib/ipc'
import type { Settings } from '$shared/types/models'

class SettingsStore {
  workspacePath = $state<string | null>(null)
  serviceAccountKeyPath = $state<string | null>(null)
  loaded = $state(false)
  error = $state<string | null>(null)

  isConfigured = $derived(this.workspacePath !== null)

  async load(): Promise<void> {
    try {
      const settings = await ipc.getSettings()
      this.workspacePath = settings.workspacePath
      this.serviceAccountKeyPath = settings.serviceAccountKeyPath
      this.loaded = true
      this.error = null
    } catch (err) {
      this.error = String(err)
      this.loaded = true
    }
  }

  async setWorkspacePath(path: string): Promise<void> {
    try {
      const updated = await ipc.setSettings({ workspacePath: path })
      this.workspacePath = updated.workspacePath
      this.error = null
    } catch (err) {
      this.error = String(err)
    }
  }

  async setServiceAccountKeyPath(path: string): Promise<void> {
    try {
      const updated = await ipc.setSettings({ serviceAccountKeyPath: path })
      this.serviceAccountKeyPath = updated.serviceAccountKeyPath
      this.error = null
    } catch (err) {
      this.error = String(err)
    }
  }

  async pickWorkspaceDirectory(): Promise<void> {
    const path = await ipc.openDirectoryDialog({
      title: 'Select Workspace Directory'
    })
    if (path) {
      await this.setWorkspacePath(path)
    }
  }

  async pickServiceAccountKey(): Promise<void> {
    const path = await ipc.openFileDialog({
      title: 'Select Service Account Key',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (path) {
      await this.setServiceAccountKeyPath(path)
    }
  }

  async resetAll(): Promise<void> {
    try {
      await ipc.resetAll()
      this.workspacePath = null
      this.serviceAccountKeyPath = null
      this.error = null
    } catch (err) {
      this.error = String(err)
    }
  }
}

export const settingsStore = new SettingsStore()
