'use client'

import { useServiceWorker } from '@/hooks/useServiceWorker'

export default function ServiceWorkerRegistrar() {
  useServiceWorker()
  return null
}
