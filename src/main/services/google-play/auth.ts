import { google } from 'googleapis'
import type { androidpublisher_v3 } from 'googleapis'

let cachedKeyPath: string | null = null
let cachedPublisher: androidpublisher_v3.Androidpublisher | null = null

export async function getAndroidPublisher(
  keyPath: string
): Promise<androidpublisher_v3.Androidpublisher> {
  if (cachedPublisher && cachedKeyPath === keyPath) return cachedPublisher

  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/androidpublisher']
  })
  const client = await auth.getClient()
  cachedPublisher = google.androidpublisher({
    version: 'v3',
    auth: client as Parameters<typeof google.androidpublisher>[0]['auth']
  })
  cachedKeyPath = keyPath
  return cachedPublisher
}
