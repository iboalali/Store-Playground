import { readdir, readFile, access } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { getImageInfo } from './image-utils'
import { TEXT_LIMITS, IMAGE_SPECS, SCREENSHOT_SPECS, SCREENSHOT_LIMITS } from '../constants'
import type { ValidationError, ValidationReport } from '$shared/types/models'

const KNOWN_NON_LOCALE = new Set(['version_metadata.json', 'screenshots', '.DS_Store', 'Thumbs.db'])

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export function validateText(
  fieldName: string,
  content: string,
  locale: string
): ValidationError[] {
  const errors: ValidationError[] = []
  const limit = TEXT_LIMITS[fieldName as keyof typeof TEXT_LIMITS]

  if (fieldName === 'title' && content.trim().length === 0) {
    errors.push({
      field: 'title',
      locale,
      message: 'Title is required',
      severity: 'error'
    })
  }

  if (limit && content.length > limit) {
    errors.push({
      field: fieldName,
      locale,
      message: `${fieldName} exceeds ${limit} character limit (${content.length}/${limit})`,
      severity: 'error'
    })
  }

  return errors
}

export async function validateImage(
  filePath: string,
  specKey: string,
  locale: string
): Promise<ValidationError[]> {
  const errors: ValidationError[] = []
  const spec = IMAGE_SPECS[specKey]
  if (!spec) return errors

  const exists = await fileExists(filePath)

  if (!exists) {
    // Icon is required, others are warnings
    if (specKey === 'high_res_icon.png') {
      errors.push({
        field: specKey,
        locale,
        message: 'High resolution icon is required',
        severity: 'error'
      })
    } else {
      errors.push({
        field: specKey,
        locale,
        message: `${specKey} is missing (recommended)`,
        severity: 'warning'
      })
    }
    return errors
  }

  try {
    const info = await getImageInfo(filePath)

    if (info.width !== spec.width || info.height !== spec.height) {
      errors.push({
        field: specKey,
        locale,
        message: `${specKey} must be ${spec.width}x${spec.height}px (got ${info.width}x${info.height})`,
        severity: 'error'
      })
    }

    if (!spec.formats.includes(info.format)) {
      errors.push({
        field: specKey,
        locale,
        message: `${specKey} must be ${spec.formats.join(' or ')} format (got ${info.format})`,
        severity: 'error'
      })
    }

    if (!spec.allowAlpha && info.hasAlpha) {
      errors.push({
        field: specKey,
        locale,
        message: `${specKey} must not have alpha channel`,
        severity: 'error'
      })
    }

    if (info.fileSizeBytes > spec.maxBytes) {
      const sizeMB = (info.fileSizeBytes / 1_048_576).toFixed(1)
      const maxMB = (spec.maxBytes / 1_048_576).toFixed(0)
      errors.push({
        field: specKey,
        locale,
        message: `${specKey} exceeds ${maxMB}MB limit (${sizeMB}MB)`,
        severity: 'error'
      })
    }
  } catch (err) {
    errors.push({
      field: specKey,
      locale,
      message: `${specKey}: failed to read image — ${String(err)}`,
      severity: 'error'
    })
  }

  return errors
}

export async function validateScreenshotImage(
  filePath: string,
  screenshotType: string,
  locale: string
): Promise<ValidationError[]> {
  const errors: ValidationError[] = []
  const fileName = basename(filePath)
  const field = `${screenshotType}/${fileName}`

  try {
    const info = await getImageInfo(filePath)

    const minDim = Math.min(info.width, info.height)
    const maxDim = Math.max(info.width, info.height)

    if (minDim < SCREENSHOT_SPECS.minDimension) {
      errors.push({
        field,
        locale,
        message: `Screenshot ${fileName} shortest side must be at least ${SCREENSHOT_SPECS.minDimension}px (got ${minDim}px)`,
        severity: 'error'
      })
    }

    if (maxDim > SCREENSHOT_SPECS.maxDimension) {
      errors.push({
        field,
        locale,
        message: `Screenshot ${fileName} longest side must not exceed ${SCREENSHOT_SPECS.maxDimension}px (got ${maxDim}px)`,
        severity: 'error'
      })
    }

    if (info.width > 0 && info.height > 0) {
      const aspectRatio = maxDim / minDim
      if (aspectRatio > SCREENSHOT_SPECS.maxAspectRatio) {
        errors.push({
          field,
          locale,
          message: `Screenshot ${fileName} aspect ratio exceeds 2:1 (${aspectRatio.toFixed(2)}:1)`,
          severity: 'error'
        })
      }
    }

    if (!(SCREENSHOT_SPECS.formats as readonly string[]).includes(info.format)) {
      errors.push({
        field,
        locale,
        message: `Screenshot ${fileName} must be PNG or JPEG (got ${info.format})`,
        severity: 'error'
      })
    }

    if (!SCREENSHOT_SPECS.allowAlpha && info.hasAlpha) {
      errors.push({
        field,
        locale,
        message: `Screenshot ${fileName} must not have alpha channel`,
        severity: 'error'
      })
    }

    if (info.fileSizeBytes > SCREENSHOT_SPECS.maxBytes) {
      const sizeMB = (info.fileSizeBytes / 1_048_576).toFixed(1)
      errors.push({
        field,
        locale,
        message: `Screenshot ${fileName} exceeds 8MB limit (${sizeMB}MB)`,
        severity: 'error'
      })
    }
  } catch (err) {
    errors.push({
      field,
      locale,
      message: `Screenshot ${fileName}: failed to read — ${String(err)}`,
      severity: 'error'
    })
  }

  return errors
}

export function validateScreenshotCount(
  type: string,
  count: number,
  locale: string
): ValidationError[] {
  const errors: ValidationError[] = []
  const limits = SCREENSHOT_LIMITS[type]
  if (!limits) return errors

  if (limits.requiredWhenPresent) {
    // Only validate min if there are some screenshots
    if (count > 0 && count < limits.min) {
      errors.push({
        field: `${type} screenshots`,
        locale,
        message: `${type} screenshots: minimum ${limits.min} required when provided (got ${count})`,
        severity: 'error'
      })
    }
  } else {
    // Phone is always required
    if (count < limits.min) {
      errors.push({
        field: `${type} screenshots`,
        locale,
        message: `${type} screenshots: minimum ${limits.min} required (got ${count})`,
        severity: 'error'
      })
    }
  }

  if (count > limits.max) {
    errors.push({
      field: `${type} screenshots`,
      locale,
      message: `${type} screenshots: maximum ${limits.max} allowed (got ${count})`,
      severity: 'error'
    })
  }

  return errors
}

export function validateVideoUrl(url: string, locale: string): ValidationError[] {
  const errors: ValidationError[] = []
  const trimmed = url.trim()

  if (!trimmed) return errors

  try {
    new URL(trimmed)
  } catch {
    errors.push({
      field: 'videoUrl',
      locale,
      message: 'Video URL is not a valid URL',
      severity: 'error'
    })
  }

  return errors
}

async function validateLocale(
  localePath: string,
  locale: string
): Promise<ValidationError[]> {
  const allErrors: ValidationError[] = []

  // Validate text files
  const textFields: { key: string; fileName: string }[] = [
    { key: 'title', fileName: 'title.txt' },
    { key: 'shortDescription', fileName: 'short_description.txt' },
    { key: 'fullDescription', fileName: 'full_description.txt' }
  ]

  for (const field of textFields) {
    try {
      const content = await readFile(join(localePath, field.fileName), 'utf-8')
      allErrors.push(...validateText(field.key, content, locale))
    } catch {
      if (field.key === 'title') {
        allErrors.push({
          field: 'title',
          locale,
          message: 'Title file is missing',
          severity: 'error'
        })
      }
    }
  }

  // Validate video URL
  try {
    const videoUrl = await readFile(join(localePath, 'video_url.txt'), 'utf-8')
    allErrors.push(...validateVideoUrl(videoUrl, locale))
  } catch {
    // video_url.txt missing is fine
  }

  // Validate images
  for (const specKey of Object.keys(IMAGE_SPECS)) {
    const imgErrors = await validateImage(join(localePath, specKey), specKey, locale)
    allErrors.push(...imgErrors)
  }

  // Validate screenshots
  const screenshotsDir = join(localePath, 'screenshots')
  const screenshotTypes = Object.keys(SCREENSHOT_LIMITS)

  for (const type of screenshotTypes) {
    const typeDir = join(screenshotsDir, type)
    let files: string[] = []

    try {
      const entries = await readdir(typeDir, { withFileTypes: true })
      files = entries
        .filter((e) => !e.isDirectory() && /\.(png|jpg|jpeg)$/i.test(e.name))
        .map((e) => e.name)
        .sort()
    } catch {
      // Directory doesn't exist — count is 0
    }

    // Count validation
    allErrors.push(...validateScreenshotCount(type, files.length, locale))

    // Per-file validation
    for (const file of files) {
      const imgErrors = await validateScreenshotImage(join(typeDir, file), type, locale)
      allErrors.push(...imgErrors)
    }
  }

  return allErrors
}

export async function validateVersionForPublish(versionDir: string): Promise<ValidationReport> {
  const allErrors: ValidationError[] = []

  // Scan for locale directories
  let entries: { name: string; isDirectory: boolean }[] = []
  try {
    const dirEntries = await readdir(versionDir, { withFileTypes: true })
    entries = dirEntries.map((e) => ({ name: e.name, isDirectory: e.isDirectory() }))
  } catch (err) {
    return {
      valid: false,
      errors: [{
        field: 'version',
        message: `Cannot read version directory: ${String(err)}`,
        severity: 'error'
      }],
      warnings: [],
      checkedAt: new Date().toISOString()
    }
  }

  const locales = entries
    .filter((e) => e.isDirectory && !KNOWN_NON_LOCALE.has(e.name))
    .map((e) => e.name)

  if (locales.length === 0) {
    return {
      valid: false,
      errors: [{
        field: 'version',
        message: 'No localizations found — at least one locale is required',
        severity: 'error'
      }],
      warnings: [],
      checkedAt: new Date().toISOString()
    }
  }

  // Validate each locale
  for (const locale of locales) {
    const localeErrors = await validateLocale(join(versionDir, locale), locale)
    allErrors.push(...localeErrors)
  }

  const errors = allErrors.filter((e) => e.severity === 'error')
  const warnings = allErrors.filter((e) => e.severity === 'warning')

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checkedAt: new Date().toISOString()
  }
}
