import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'H4KS Radio REPL',
  description: 'H4KS Radio REPL - Live code music with Strudel',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" translate="no">
      <head>
        <meta name="google" content="notranslate" />
        <meta httpEquiv="Content-Language" content="en" />
        <link rel="icon" type="image/svg+xml" href="/assets/dj-icon.svg" />

        {/* Strudel Web API */}
        <Script
          src="/vendor/strudel-web.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
