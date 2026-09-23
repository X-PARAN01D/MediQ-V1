import { isDemo } from './config'

/**
 * Doctor verification uploads (licence / selfie).
 *
 * Demo mode: returns a downscaled data URL stored on the user document, same
 * as before.
 *
 * Firebase mode: uploads to `verification/{userId}/…` in Firebase Storage and
 * returns the download URL, which is stored on the user document. Storage
 * rules restrict these paths to the owning user, images only, max 5 MB.
 */
/** Downscale an image to a compact JPEG data URL (demo previews / email-link carry). */
export function downscaleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const max = 800
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.7))
    }
    img.onerror = reject
    img.src = url
  })
}

export async function uploadVerificationFile(file: File, userId: string, kind: 'license' | 'selfie'): Promise<string> {
  if (isDemo) return downscaleImage(file)
  const { firebaseApp } = await import('./storeFirebase')
  const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage')
  const storage = getStorage(firebaseApp)
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `verification/${userId}/${kind}-${Date.now()}.${ext || 'jpg'}`
  const snap = await uploadBytes(ref(storage, path), file, {
    contentType: file.type || 'image/jpeg',
  })
  return getDownloadURL(snap.ref)
}

/**
 * Variant for data URLs (e.g. the email-link registration flow, where the
 * picked files are carried through localStorage as downscaled data URLs).
 */
export async function uploadDataUrlFile(dataUrl: string, userId: string, kind: 'license' | 'selfie'): Promise<string> {
  if (isDemo) return dataUrl
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  const file = new File([blob], `${kind}.jpg`, { type: blob.type || 'image/jpeg' })
  return uploadVerificationFile(file, userId, kind)
}
