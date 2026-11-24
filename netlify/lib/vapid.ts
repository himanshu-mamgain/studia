import webpush from 'web-push'

/**
 * The site's VAPID keys (the key pair that signs its pushes), from Netlify environment variables
 * VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT. Without them, push is simply off.
 */
export function vapid(): { publicKey: string; privateKey: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return null
  // Push services contact this address if the site's pushes misbehave.
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:noreply@studia-hub.netlify.app', publicKey, privateKey)
  return { publicKey, privateKey }
}
