import type { Metadata, Viewport } from 'next'
import { ThemeProvider } from '@/components/theme-provider'
import { AppShell } from '@/components/refx/app-shell'
import { AppProvider } from '@/components/refx/app-provider'
import './globals.css'

const BOOT_MONITOR_SCRIPT = `
(() => {
  const platform = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || ''
  if (!/mac/i.test(platform)) return

  const overlay = document.getElementById('refx-boot-overlay')
  const lines = overlay?.querySelector('[data-refx-boot-lines]')
  if (!overlay || !lines) return

  const state = {
    mounted: false,
    entries: ['inline bootstrap ready'],
  }

  const render = (forceShow) => {
    lines.textContent = state.entries.join('\\n')
    overlay.hidden = !(forceShow || !state.mounted)
  }

  const push = (message) => {
    state.entries.push(message)
    if (state.entries.length > 8) {
      state.entries.splice(0, state.entries.length - 8)
    }
    render(false)
  }

  window.__REFX_BOOTSTRAP__ = { push }
  window.__REFX_APP_PROVIDER_MOUNTED__ = false

  document.addEventListener('readystatechange', () => {
    push('document state: ' + document.readyState)
  })

  window.addEventListener('error', (event) => {
    const target = event.target
    if (target && target.tagName === 'SCRIPT') {
      push('script load failed: ' + (target.src || '[inline script]'))
    } else {
      const message = event.message || (event.error && event.error.message) || 'unknown error'
      push('window error: ' + message)
    }
    render(true)
  }, true)

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    const message = typeof reason === 'string'
      ? reason
      : (reason && reason.message) || 'unknown rejection'
    push('unhandled rejection: ' + message)
    render(true)
  })

  window.addEventListener('refx:app-provider-mounted', () => {
    state.mounted = true
    window.__REFX_APP_PROVIDER_MOUNTED__ = true
    push('app provider mounted')
    overlay.hidden = true
  })

  window.setTimeout(() => {
    if (state.mounted) return
    push('app provider mount not detected after 8s')
    render(true)
  }, 8000)

  render(false)
})()
`

export const metadata: Metadata = {
  title: 'Refx - Research Management',
  description: 'Advanced personal and team research manager for PDFs, references, comments, and knowledge synthesis',
  generator: 'v0.app',
  keywords: ['research', 'pdf', 'references', 'citations', 'comments', 'academic'],
  authors: [{ name: 'Refx Team' }],
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3ede2' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a1f' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <div
          id="refx-boot-overlay"
          hidden
          className="fixed bottom-4 left-4 z-[9999] max-w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-amber-300/60 bg-slate-950/92 px-4 py-3 text-left text-xs text-amber-100 shadow-2xl backdrop-blur"
        >
          <p className="font-semibold uppercase tracking-[0.18em] text-amber-200">
            Startup Fallback
          </p>
          <pre
            data-refx-boot-lines
            className="mt-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-amber-50"
          />
        </div>
        <script dangerouslySetInnerHTML={{ __html: BOOT_MONITOR_SCRIPT }} />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          enableColorScheme={false}
          disableTransitionOnChange
        >
          <AppProvider>
            <AppShell>
              {children}
            </AppShell>
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
