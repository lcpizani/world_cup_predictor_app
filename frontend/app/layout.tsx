import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Oswald } from 'next/font/google'
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${jakartaSans.variable} ${oswald.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-[#080c14] font-[family-name:var(--font-geist)] antialiased">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
