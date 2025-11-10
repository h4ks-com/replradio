import type { Metadata } from 'next'
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
      </head>
      <body>{children}</body>
    </html>
  )
}
