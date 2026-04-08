// BCP-47 locales supported by Google Play (77 locales)
export const GOOGLE_PLAY_LOCALES: string[] = [
  'af', 'am', 'ar', 'hy-AM', 'az-AZ', 'eu-ES', 'be', 'bn-BD', 'bg',
  'my-MM', 'ca', 'zh-HK', 'zh-CN', 'zh-TW', 'hr', 'cs-CZ', 'da-DK',
  'nl-NL', 'en-AU', 'en-CA', 'en-IN', 'en-SG', 'en-GB', 'en-US', 'et',
  'fil', 'fi-FI', 'fr-CA', 'fr-FR', 'gl-ES', 'ka-GE', 'de-DE', 'el-GR',
  'gu', 'iw-IL', 'hi-IN', 'hu-HU', 'is-IS', 'id', 'it-IT', 'ja-JP',
  'kn-IN', 'kk', 'km-KH', 'ko-KR', 'ky-KG', 'lo-LA', 'lv', 'lt',
  'mk-MK', 'ms', 'ms-MY', 'ml-IN', 'mr-IN', 'mn-MN', 'ne-NP', 'no-NO',
  'fa', 'pl-PL', 'pt-BR', 'pt-PT', 'pa', 'ro', 'rm', 'ru-RU', 'sr',
  'si-LK', 'sk', 'sl', 'es-419', 'es-ES', 'es-US', 'sw', 'sv-SE',
  'ta-IN', 'te-IN', 'th', 'tr-TR', 'uk', 'ur', 'vi', 'zu'
]

// Text field character limits
export const TEXT_LIMITS = {
  title: 30,
  shortDescription: 80,
  fullDescription: 4000
} as const

// Image specifications
export const IMAGE_SPECS: Record<string, {
  width: number
  height: number
  maxBytes: number
  allowAlpha: boolean
  formats: string[]
}> = {
  'high_res_icon.png': {
    width: 512,
    height: 512,
    maxBytes: 1_048_576,
    allowAlpha: true,
    formats: ['png']
  },
  'feature_graphic.png': {
    width: 1024,
    height: 500,
    maxBytes: 1_048_576,
    allowAlpha: false,
    formats: ['png', 'jpeg']
  },
  'tv_banner.png': {
    width: 1280,
    height: 720,
    maxBytes: 1_048_576,
    allowAlpha: false,
    formats: ['png', 'jpeg']
  }
}

// Screenshot specs (shared across all types)
export const SCREENSHOT_SPECS = {
  minDimension: 320,
  maxDimension: 3840,
  maxAspectRatio: 2,
  maxBytes: 8_388_608,
  allowAlpha: false,
  formats: ['png', 'jpeg']
} as const

// Screenshot count limits per type
export const SCREENSHOT_LIMITS: Record<string, { min: number; max: number; requiredWhenPresent: boolean }> = {
  phone: { min: 2, max: 8, requiredWhenPresent: false },
  tablet_7: { min: 4, max: 8, requiredWhenPresent: true },
  tablet_10: { min: 4, max: 8, requiredWhenPresent: true },
  chromebook: { min: 4, max: 8, requiredWhenPresent: true },
  tv: { min: 1, max: 8, requiredWhenPresent: true },
  wear: { min: 1, max: 8, requiredWhenPresent: true },
  android_xr: { min: 4, max: 8, requiredWhenPresent: true }
}

// Non-screenshot image file to API image type mapping
export const IMAGE_FILE_TO_API_TYPE: Record<string, string> = {
  'high_res_icon.png': 'icon',
  'feature_graphic.png': 'featureGraphic',
  'tv_banner.png': 'tvBanner'
}

// Directory name to API image type mapping
export const DIR_TO_API_TYPE: Record<string, string> = {
  phone: 'phoneScreenshots',
  tablet_7: 'sevenInchScreenshots',
  tablet_10: 'tenInchScreenshots',
  tv: 'tvScreenshots',
  wear: 'wearScreenshots'
}
