import type { Metadata, Viewport } from 'next'
import {
  Fraunces,
  Geist,
  JetBrains_Mono,
  Noto_Sans_Telugu,
} from 'next/font/google'
import './globals.css'
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  weight: 'variable',
  axes: ['opsz'],
})

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500'],
})

// Loaded for correct Telugu Unicode rendering in transcript segments.
// Used as a CSS fallback via font-family in SegmentList, not a Next.js variable.
const notoSansTelugu = Noto_Sans_Telugu({
  subsets: ['telugu'],
  display: 'swap',
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: 'Saaranshi',
  description: 'Research companion for Sravya\'s breast-cancer study',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Saaranshi',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  themeColor: '#0E5C5C',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${geist.variable} ${jetbrainsMono.variable} ${notoSansTelugu.className}`}
    >
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.svg" />
      </head>
      <body suppressHydrationWarning>
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  )
}
