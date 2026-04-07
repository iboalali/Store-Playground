import sharp from 'sharp'
import imageSize from 'image-size'
import { readFile, stat } from 'node:fs/promises'

export interface ImageInfo {
  width: number
  height: number
  format: string
  hasAlpha: boolean
  fileSizeBytes: number
}

export async function getImageInfo(filePath: string): Promise<ImageInfo> {
  const buffer = await readFile(filePath)
  const dimensions = imageSize(new Uint8Array(buffer))
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
