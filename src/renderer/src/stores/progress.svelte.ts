import { ipc } from '$lib/ipc'
import type { ProgressEvent } from '$shared/types/models'

class ProgressStore {
  event = $state<ProgressEvent | null>(null)
  active = $derived(this.event !== null && !this.event.finished)
  steps = $derived(this.event?.steps ?? [])
  errors = $derived(this.steps.filter((s) => s.status === 'error'))
  hasErrors = $derived(this.errors.length > 0 || !!this.event?.abortError)
  abortError = $derived(this.event?.abortError ?? null)
  finished = $derived(this.event?.finished ?? false)
  operationType = $derived(this.event?.operationType ?? null)

  private unsubscribe: (() => void) | null = null

  subscribe(): void {
    // Clean up any existing subscription
    if (this.unsubscribe) {
      this.unsubscribe()
    }
    this.event = null
    this.unsubscribe = ipc.onApiProgress((ev) => {
      this.event = ev
    })
  }

  dismiss(): void {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }
    this.event = null
  }
}

export const progressStore = new ProgressStore()
