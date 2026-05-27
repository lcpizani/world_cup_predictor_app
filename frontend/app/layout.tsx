import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Oswald } from 'next/font/google'
import './globals.css'
import { Providers } from '@/lib/providers'
import { Navbar } from '@/components/Navbar'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

const oswald = Oswald({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-oswald',
})

export const metadata: Metadata = {
  title: 'World Cup Predictor',
  description: 'Predict match scores and compete with friends',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} ${oswald.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[#080c14] font-[family-name:var(--font-geist)] antialiased">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
