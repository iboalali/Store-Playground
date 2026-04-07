import { ipc } from '$lib/ipc'
import type { ScreenshotConfig, ScreenMeta, ScreenData, VariantData } from '$shared/types/models'

function joinPath(base: string, ...rest: string[]): string {
  const sep = base.includes('\\') ? '\\' : '/'
  return [base, ...rest].join(sep)
}

export function toSlug(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'untitled'
}

function emptyConfig(): ScreenshotConfig {
  return { versionOrder: [], versions: {} }
}

class ScreenshotManagerStore {
  appPath = $state<string | null>(null)
  config = $state<ScreenshotConfig | null>(null)
  activeVersionName = $state<string | null>(null)
  screens = $state<ScreenData[]>([])
  loading = $state(false)
  error = $state<string | null>(null)
  imageTimestamp = $state(Date.now())
  undoAction = $state<{ label: string; backupPath: string; restoreTo: string } | null>(null)

  screenshotsRoot = $derived(
    this.appPath ? joinPath(this.appPath, 'screenshots') : null
  )

  versionsDir = $derived(
    this.screenshotsRoot ? joinPath(this.screenshotsRoot, 'versions') : null
  )

  undoDir = $derived(
    this.screenshotsRoot ? joinPath(this.screenshotsRoot, '.undo') : null
  )

  activeVersionDir = $derived(
    this.versionsDir && this.activeVersionName
      ? joinPath(this.versionsDir, this.activeVersionName)
      : null
  )

  // --- Initialization ---

  async load(appPath: string): Promise<void> {
    this.appPath = appPath
    this.loading = true
    this.error = null
    this.undoAction = null

    try {
      await this.ensureScreenshotsDir()
      await this.loadConfig()

      if (this.config && this.config.versionOrder.length > 0) {
        await this.loadVersionScreens(this.config.versionOrder[0])
      } else {
        this.activeVersionName = null
        this.screens = []
      }
    } catch (err) {
      this.error = String(err)
    } finally {
      this.loading = false
    }
  }

  private async ensureScreenshotsDir(): Promise<void> {
    if (!this.screenshotsRoot) return
    await ipc.createDirectory(joinPath(this.screenshotsRoot, 'versions'))
    await ipc.createDirectory(joinPath(this.screenshotsRoot, '.undo'))
  }

  private async loadConfig(): Promise<void> {
    if (!this.screenshotsRoot) return
    const configPath = joinPath(this.screenshotsRoot, 'screenshot_config.json')

    try {
      this.config = (await ipc.readJsonFile(configPath)) as ScreenshotConfig
    } catch {
      this.config = emptyConfig()
      await this.saveConfig()
    }
  }

  async loadVersionScreens(versionName: string): Promise<void> {
    if (!this.versionsDir || !this.config) return

    this.activeVersionName = versionName
    const versionDir = joinPath(this.versionsDir, versionName)
    const versionMeta = this.config.versions[versionName]
    if (!versionMeta) {
      this.screens = []
      return
    }

    const screens: ScreenData[] = []
    for (const screenSlug of versionMeta.screenOrder) {
      const screenDir = joinPath(versionDir, screenSlug)
      try {
        const meta = (await ipc.readJsonFile(
          joinPath(screenDir, '_screen.json')
        )) as ScreenMeta

        const variants: VariantData[] = []
        let dirFiles: string[] = []
        try {
          const entries = await ipc.listDirectory(screenDir)
          dirFiles = entries.filter((e) => !e.isDirectory).map((e) => e.name)
        } catch {
          dirFiles = []
        }

        for (const variantSlug of meta.variantOrder) {
          const imageFile = dirFiles.find(
            (f) => f.startsWith(variantSlug + '.') && /\.(png|jpg|jpeg)$/i.test(f)
          )
          const ext = imageFile ? imageFile.split('.').pop()! : 'png'
          variants.push({
            slug: variantSlug,
            displayName: meta.variantNames[variantSlug] || variantSlug,
            filePath: joinPath(screenDir, `${variantSlug}.${ext}`),
            hasImage: !!imageFile
          })
        }

        screens.push({
          slug: screenSlug,
          displayName: meta.displayName,
          dirPath: screenDir,
          variants
        })
      } catch {
        // Skip screens with broken metadata
      }
    }
    this.screens = screens
  }

  // --- Config persistence ---

  private async saveConfig(): Promise<void> {
    if (!this.screenshotsRoot || !this.config) return
    await ipc.writeJsonFile(
      joinPath(this.screenshotsRoot, 'screenshot_config.json'),
      this.config
    )
  }

  private async saveScreenMeta(screenDir: string, meta: ScreenMeta): Promise<void> {
    await ipc.writeJsonFile(joinPath(screenDir, '_screen.json'), meta)
  }

  private getScreenMeta(screen: ScreenData): ScreenMeta {
    const variantNames: Record<string, string> = {}
    for (const v of screen.variants) {
      variantNames[v.slug] = v.displayName
    }
    return {
      displayName: screen.displayName,
      variantOrder: screen.variants.map((v) => v.slug),
      variantNames
    }
  }

  // --- Version CRUD ---

  async addVersion(name: string): Promise<void> {
    if (!this.versionsDir || !this.config) return

    try {
      const newDir = joinPath(this.versionsDir, name)

      if (this.config.versionOrder.length > 0) {
        const latestName = this.config.versionOrder[0]
        const latestDir = joinPath(this.versionsDir, latestName)
        await ipc.copyDirectory(latestDir, newDir)
      } else {
        await ipc.createDirectory(newDir)
      }

      this.config.versionOrder.unshift(name)
      this.config.versions[name] = {
        createdAt: new Date().toISOString(),
        screenOrder: this.config.versionOrder.length > 1
          ? [...(this.config.versions[this.config.versionOrder[1]]?.screenOrder || [])]
          : []
      }
      await this.saveConfig()
      await this.loadVersionScreens(name)
    } catch (err) {
      this.error = String(err)
    }
  }

  async duplicateVersion(sourceName: string, newName: string): Promise<void> {
    if (!this.versionsDir || !this.config) return

    try {
      await ipc.copyDirectory(
        joinPath(this.versionsDir, sourceName),
        joinPath(this.versionsDir, newName)
      )

      const sourceVersion = this.config.versions[sourceName]
      const insertIdx = this.config.versionOrder.indexOf(sourceName)
      this.config.versionOrder.splice(insertIdx + 1, 0, newName)
      this.config.versions[newName] = {
        createdAt: new Date().toISOString(),
        screenOrder: [...(sourceVersion?.screenOrder || [])]
      }
      await this.saveConfig()
      await this.loadVersionScreens(newName)
    } catch (err) {
      this.error = String(err)
    }
  }

  async deleteVersion(name: string): Promise<void> {
    if (!this.versionsDir || !this.config) return

    try {
      await ipc.deleteToTrash(joinPath(this.versionsDir, name))

      const idx = this.config.versionOrder.indexOf(name)
      this.config.versionOrder.splice(idx, 1)
      delete this.config.versions[name]
      await this.saveConfig()

      if (this.config.versionOrder.length > 0) {
        const nextIdx = Math.min(idx, this.config.versionOrder.length - 1)
        await this.loadVersionScreens(this.config.versionOrder[nextIdx])
      } else {
        this.activeVersionName = null
        this.screens = []
      }
    } catch (err) {
      this.error = String(err)
    }
  }

  async renameVersion(oldName: string, newName: string): Promise<void> {
    if (!this.versionsDir || !this.config) return

    try {
      await ipc.renameItem(
        joinPath(this.versionsDir, oldName),
        joinPath(this.versionsDir, newName)
      )

      const idx = this.config.versionOrder.indexOf(oldName)
      this.config.versionOrder[idx] = newName
      this.config.versions[newName] = this.config.versions[oldName]
      delete this.config.versions[oldName]
      await this.saveConfig()

      if (this.activeVersionName === oldName) {
        await this.loadVersionScreens(newName)
      }
    } catch (err) {
      this.error = String(err)
    }
  }

  // --- Screen CRUD ---

  async addScreen(displayName: string): Promise<void> {
    if (!this.activeVersionDir || !this.config || !this.activeVersionName) return

    try {
      const slug = toSlug(displayName)
      const screenDir = joinPath(this.activeVersionDir, slug)
      await ipc.createDirectory(screenDir)

      const meta: ScreenMeta = {
        displayName,
        variantOrder: [],
        variantNames: {}
      }
      await this.saveScreenMeta(screenDir, meta)

      this.config.versions[this.activeVersionName].screenOrder.push(slug)
      await this.saveConfig()
      await this.loadVersionScreens(this.activeVersionName)
    } catch (err) {
      this.error = String(err)
    }
  }

  async deleteScreen(screenSlug: string): Promise<void> {
    if (!this.activeVersionDir || !this.config || !this.activeVersionName) return

    try {
      await ipc.deleteToTrash(joinPath(this.activeVersionDir, screenSlug))

      const order = this.config.versions[this.activeVersionName].screenOrder
      const idx = order.indexOf(screenSlug)
      if (idx !== -1) order.splice(idx, 1)
      await this.saveConfig()
      await this.loadVersionScreens(this.activeVersionName)
    } catch (err) {
      this.error = String(err)
    }
  }

  async renameScreen(screenSlug: string, newDisplayName: string): Promise<void> {
    if (!this.activeVersionDir) return

    try {
      const screenDir = joinPath(this.activeVersionDir, screenSlug)
      const screen = this.screens.find((s) => s.slug === screenSlug)
      if (!screen) return

      const meta = this.getScreenMeta(screen)
      meta.displayName = newDisplayName
      await this.saveScreenMeta(screenDir, meta)

      if (this.activeVersionName) {
        await this.loadVersionScreens(this.activeVersionName)
      }
    } catch (err) {
      this.error = String(err)
    }
  }

  async reorderScreens(newOrder: string[]): Promise<void> {
    if (!this.config || !this.activeVersionName) return

    try {
      this.config.versions[this.activeVersionName].screenOrder = newOrder
      await this.saveConfig()
      await this.loadVersionScreens(this.activeVersionName)
    } catch (err) {
      this.error = String(err)
    }
  }

  // --- Variant CRUD ---

  async addVariant(screenSlug: string, displayName: string): Promise<void> {
    if (!this.activeVersionDir) return

    try {
      const screen = this.screens.find((s) => s.slug === screenSlug)
      if (!screen) return

      const variantSlug = toSlug(displayName)
      const meta = this.getScreenMeta(screen)
      meta.variantOrder.push(variantSlug)
      meta.variantNames[variantSlug] = displayName
      await this.saveScreenMeta(screen.dirPath, meta)

      if (this.activeVersionName) {
        await this.loadVersionScreens(this.activeVersionName)
      }
    } catch (err) {
      this.error = String(err)
    }
  }

  async deleteVariant(screenSlug: string, variantSlug: string): Promise<void> {
    if (!this.activeVersionDir) return

    try {
      const screen = this.screens.find((s) => s.slug === screenSlug)
      if (!screen) return

      const variant = screen.variants.find((v) => v.slug === variantSlug)
      if (variant?.hasImage) {
        await ipc.deleteToTrash(variant.filePath)
      }

      const meta = this.getScreenMeta(screen)
      meta.variantOrder = meta.variantOrder.filter((s) => s !== variantSlug)
      delete meta.variantNames[variantSlug]
      await this.saveScreenMeta(screen.dirPath, meta)

      if (this.activeVersionName) {
        await this.loadVersionScreens(this.activeVersionName)
      }
    } catch (err) {
      this.error = String(err)
    }
  }

  async renameVariant(
    screenSlug: string,
    oldSlug: string,
    newDisplayName: string
  ): Promise<void> {
    if (!this.activeVersionDir) return

    try {
      const screen = this.screens.find((s) => s.slug === screenSlug)
      if (!screen) return

      const newSlug = toSlug(newDisplayName)
      const variant = screen.variants.find((v) => v.slug === oldSlug)
      const meta = this.getScreenMeta(screen)

      if (newSlug !== oldSlug) {
        // Slug changed — rename image file if it exists
        if (variant?.hasImage) {
          const ext = variant.filePath.split('.').pop() || 'png'
          const newPath = joinPath(screen.dirPath, `${newSlug}.${ext}`)
          await ipc.renameItem(variant.filePath, newPath)
        }

        meta.variantOrder = meta.variantOrder.map((s) => (s === oldSlug ? newSlug : s))
        delete meta.variantNames[oldSlug]
        meta.variantNames[newSlug] = newDisplayName
      } else {
        meta.variantNames[oldSlug] = newDisplayName
      }

      await this.saveScreenMeta(screen.dirPath, meta)

      if (this.activeVersionName) {
        await this.loadVersionScreens(this.activeVersionName)
      }
    } catch (err) {
      this.error = String(err)
    }
  }

  async reorderVariants(screenSlug: string, newOrder: string[]): Promise<void> {
    if (!this.activeVersionDir) return

    try {
      const screen = this.screens.find((s) => s.slug === screenSlug)
      if (!screen) return

      const meta = this.getScreenMeta(screen)
      meta.variantOrder = newOrder
      await this.saveScreenMeta(screen.dirPath, meta)

      if (this.activeVersionName) {
        await this.loadVersionScreens(this.activeVersionName)
      }
    } catch (err) {
      this.error = String(err)
    }
  }

  // --- Image operations ---

  private async backupForUndo(filePath: string, label: string): Promise<void> {
    if (!this.undoDir) return

    // Clear .undo/ contents
    try {
      const entries = await ipc.listDirectory(this.undoDir)
      for (const entry of entries) {
        if (!entry.isDirectory) {
          await ipc.deleteToTrash(joinPath(this.undoDir, entry.name))
        }
      }
    } catch {
      // .undo/ may be empty, that's fine
    }

    const fileName = filePath.split(/[/\\]/).pop() || 'backup.png'
    const backupPath = joinPath(this.undoDir, fileName)
    await ipc.copyImage(filePath, backupPath)

    this.undoAction = { label, backupPath, restoreTo: filePath }
  }

  async setVariantImage(
    screenSlug: string,
    variantSlug: string,
    sourcePath: string
  ): Promise<void> {
    if (!this.activeVersionDir) return

    try {
      const screen = this.screens.find((s) => s.slug === screenSlug)
      if (!screen) return
      const variant = screen.variants.find((v) => v.slug === variantSlug)
      if (!variant) return

      const ext = sourcePath.split('.').pop()?.toLowerCase() || 'png'
      const destPath = joinPath(screen.dirPath, `${variantSlug}.${ext}`)

      if (variant.hasImage) {
        await this.backupForUndo(variant.filePath, `Replace ${variant.displayName}`)
      }

      await ipc.copyImage(sourcePath, destPath)
      this.imageTimestamp = Date.now()

      if (this.activeVersionName) {
        await this.loadVersionScreens(this.activeVersionName)
      }
    } catch (err) {
      this.error = String(err)
    }
  }

  async setVariantImageFromData(
    screenSlug: string,
    variantSlug: string,
    base64Data: string
  ): Promise<void> {
    if (!this.activeVersionDir) return

    try {
      const screen = this.screens.find((s) => s.slug === screenSlug)
      if (!screen) return
      const variant = screen.variants.find((v) => v.slug === variantSlug)
      if (!variant) return

      const destPath = joinPath(screen.dirPath, `${variantSlug}.png`)

      if (variant.hasImage) {
        await this.backupForUndo(variant.filePath, `Replace ${variant.displayName}`)
      }

      await ipc.writeImageData(destPath, base64Data)
      this.imageTimestamp = Date.now()

      if (this.activeVersionName) {
        await this.loadVersionScreens(this.activeVersionName)
      }
    } catch (err) {
      this.error = String(err)
    }
  }

  async clearVariantImage(screenSlug: string, variantSlug: string): Promise<void> {
    if (!this.activeVersionDir) return

    try {
      const screen = this.screens.find((s) => s.slug === screenSlug)
      if (!screen) return
      const variant = screen.variants.find((v) => v.slug === variantSlug)
      if (!variant?.hasImage) return

      await this.backupForUndo(variant.filePath, `Delete ${variant.displayName}`)
      await ipc.deleteToTrash(variant.filePath)
      this.imageTimestamp = Date.now()

      if (this.activeVersionName) {
        await this.loadVersionScreens(this.activeVersionName)
      }
    } catch (err) {
      this.error = String(err)
    }
  }

  async moveVariantImage(
    fromScreenSlug: string,
    fromVariantSlug: string,
    toScreenSlug: string,
    toVariantSlug: string
  ): Promise<void> {
    if (!this.activeVersionDir) return

    try {
      const fromScreen = this.screens.find((s) => s.slug === fromScreenSlug)
      const toScreen = this.screens.find((s) => s.slug === toScreenSlug)
      if (!fromScreen || !toScreen) return

      const fromVariant = fromScreen.variants.find((v) => v.slug === fromVariantSlug)
      const toVariant = toScreen.variants.find((v) => v.slug === toVariantSlug)
      if (!fromVariant?.hasImage || !toVariant) return

      const ext = fromVariant.filePath.split('.').pop() || 'png'
      const destPath = joinPath(toScreen.dirPath, `${toVariantSlug}.${ext}`)

      if (toVariant.hasImage) {
        // Swap: use temp file
        const tmpPath = joinPath(toScreen.dirPath, `_swap_tmp.${ext}`)
        await ipc.renameItem(toVariant.filePath, tmpPath)
        await ipc.renameItem(fromVariant.filePath, destPath)
        const fromExt = toVariant.filePath.split('.').pop() || 'png'
        await ipc.renameItem(
          tmpPath,
          joinPath(fromScreen.dirPath, `${fromVariantSlug}.${fromExt}`)
        )
      } else {
        // Move
        await this.backupForUndo(fromVariant.filePath, `Move ${fromVariant.displayName}`)
        await ipc.renameItem(fromVariant.filePath, destPath)
      }

      this.imageTimestamp = Date.now()

      if (this.activeVersionName) {
        await this.loadVersionScreens(this.activeVersionName)
      }
    } catch (err) {
      this.error = String(err)
    }
  }

  // --- Undo ---

  async undo(): Promise<void> {
    if (!this.undoAction) return

    try {
      await ipc.copyImage(this.undoAction.backupPath, this.undoAction.restoreTo)
      this.undoAction = null
      this.imageTimestamp = Date.now()

      if (this.activeVersionName) {
        await this.loadVersionScreens(this.activeVersionName)
      }
    } catch (err) {
      this.error = String(err)
    }
  }
}

export const screenshotManagerStore = new ScreenshotManagerStore()
