import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/toast'
import { ServiceWorker } from '@/components/service-worker'
import { QueryProvider } from '@/components/query-provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
export const metadata: Metadata = { title: 'NoRegret', description: 'Run your day, track your prep, sleep without regret.', manifest: '/manifest.webmanifest' }
export const viewport: Viewport = { themeColor: '#6366f1', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>
            {children}
            <Toaster />
            <ServiceWorker />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
