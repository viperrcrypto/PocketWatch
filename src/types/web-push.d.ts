declare module "web-push" {
  interface PushSubscription {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }

  interface VapidKeys {
    publicKey: string
    privateKey: string
  }

  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void
  export function sendNotification(subscription: PushSubscription, payload: string): Promise<unknown>
  export function generateVAPIDKeys(): VapidKeys
}
