import { ipc } from '$lib/ipc'
import type { AppEntry } from '$shared/types/models'

class AppStateStore {
  apps = $state<AppEntry[]>([])
  loading = $state(false)
  error = $state<string | null>(null)

  sortedApps = $derived(
    [...this.apps].sort((a, b) => a.config.appName.localeCompare(b.config.appName))
  )
  appCount = $derived(this.apps.length)

  async loadWorkspace(workspacePath: string): Promise<void> {
    this.loading = true
    this.error = null
    try {
      this.apps = await ipc.readWorkspace(workspacePath)
    } catch (err) {
      this.error = String(err)
      this.apps = []
    } finally {
      this.loading = false
    }
  }

  async refresh(workspacePath: string): Promise<void> {
    await this.loadWorkspace(workspacePath)
  }
}

export const appStateStore = new AppStateStore()
