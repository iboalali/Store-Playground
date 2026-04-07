import { createHash } from 'crypto'
import { readFile } from 'fs/promises'

export interface LocalImageEntry {
  filePath: string
  sha256: string
}

export interface ApiImageEntry {
  id: string
  sha256: string
}

export interface ImageDiffResult {
  toUpload: string[]
  toDelete: string[]
}

export async function computeLocalHash(filePath: string): Promise<string> {
  const buffer = await readFile(filePath)
  return createHash('sha256').update(buffer).digest('hex')
}

export function computeImageDiff(
  localFiles: LocalImageEntry[],
  apiImages: ApiImageEntry[]
): ImageDiffResult {
  const apiHashSet = new Set(apiImages.map((img) => img.sha256))
  const localHashSet = new Set(localFiles.map((f) => f.sha256))

  const toUpload = localFiles
    .filter((f) => !apiHashSet.has(f.sha256))
    .map((f) => f.filePath)

  const toDelete = apiImages
    .filter((img) => !localHashSet.has(img.sha256))
    .map((img) => img.id)

  return { toUpload, toDelete }
}
