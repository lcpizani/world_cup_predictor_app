import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Oswald } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale } from 'next-intl/server'
import Script from 'next/script'
import './globals.css'
import { Providers } from '@/lib/providers'
import { Navbar } from '@/components/Navbar'

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-geist',
})

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-oswald',
})

export const metadata: Metadata = {
  title: 'WC Football Predictions',
  description: 'Predict match scores and compete with friends',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} className={`${jakartaSans.variable} ${oswald.variable} h-full`}>
      <head>
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-JBBWQKBR87" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-JBBWQKBR87');
        `}</Script>
      </head>
      <body className="min-h-full flex flex-col bg-[#080c14] font-[family-name:var(--font-geist)] antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <Navbar />
            <main className="flex-1">{children}</main>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
