import { google } from 'googleapis'
import type { androidpublisher_v3, storage_v1 } from 'googleapis'

let cachedKeyPath: string | null = null
let cachedPublisher: androidpublisher_v3.Androidpublisher | null = null

let cachedStorageKeyPath: string | null = null
let cachedStorage: storage_v1.Storage | null = null

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

export async function getStorageClient(
  keyPath: string
): Promise<storage_v1.Storage> {
  if (cachedStorage && cachedStorageKeyPath === keyPath) return cachedStorage

  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/devstorage.read_only']
  })
  const client = await auth.getClient()
  cachedStorage = google.storage({
    version: 'v1',
    auth: client as Parameters<typeof google.storage>[0]['auth']
  })
  cachedStorageKeyPath = keyPath
  return cachedStorage
}
