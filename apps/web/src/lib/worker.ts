const BASE_URL = (import.meta.env.VITE_WORKER_URL as string | undefined) ?? ''

export const workerClient = {
  async getVapidPublicKey(): Promise<string> {
    const res = await fetch(`${BASE_URL}/api/push/vapid-public-key`)
    if (!res.ok) throw new Error('Impossible de récupérer la clé VAPID')
    const data = (await res.json()) as { publicKey: string }
    return data.publicKey
  },

  async subscribe(subscription: PushSubscriptionJSON): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription),
    })
    if (!res.ok) throw new Error('Échec de l\'abonnement push')
  },

  async unsubscribe(endpoint: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/push/subscribe`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    })
    if (!res.ok) throw new Error('Échec de la désactivation push')
  },

  async testPush(endpoint: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/push/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    })
    if (!res.ok) throw new Error('Échec de l\'envoi de la notification test')
  },
}
