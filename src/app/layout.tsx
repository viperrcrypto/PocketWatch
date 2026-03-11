import type { Metadata, Viewport } from "next"
import { Inter, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { QueryProvider } from "@/components/providers/query-provider"
import { ErrorBoundary } from "@/components/error-boundary"
import { SkipToContent } from "@/components/skip-to-content"
import { ClientShell } from "@/components/layout/client-shell"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
})

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: "PocketWatch — Personal Wealth Tracker",
  description: "See everything you own. In one place.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/img/favicon.svg", type: "image/svg+xml" },
      { url: "/img/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/img/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PocketWatch",
  },
  openGraph: {
    title: "PocketWatch — Personal Wealth Tracker",
    description: "See everything you own. In one place.",
    type: "website",
    images: [
      {
        url: "/img/og-banner.jpg",
        width: 1200,
        height: 630,
        alt: "PocketWatch — Personal Wealth Tracker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PocketWatch — Personal Wealth Tracker",
    description: "See everything you own. In one place.",
    images: ["/img/og-banner.jpg"],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        {/* Prevent flash — match default theme background */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||((!t)&&matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.setAttribute('data-theme','dark');document.documentElement.style.background='#000';}else{document.documentElement.style.background='#fff';}}catch(e){}})()` }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,0..1,0&display=block"
        />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <SkipToContent />
        <QueryProvider>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <ClientShell />
        </QueryProvider>
      </body>
    </html>
  )
}
