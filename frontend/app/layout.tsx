import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import Link from 'next/link'

export const metadata: Metadata = { title: 'NFT Lending' }

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <Providers>
          <nav className="border-b bg-white px-6 py-3 flex items-center justify-between sticky top-0 z-10">
            <div className="flex items-center gap-5">
              <Link href="/" className="font-bold text-indigo-700 text-lg">
                NFT Lend
              </Link>
              {[
                ['Lend', '/lend'],
                ['Borrow', '/borrow'],
                ['Loans', '/loans'],
                ['Auctions', '/auctions'],
              ].map(([l, h]) => (
                <Link
                  key={h}
                  href={h}
                  className="text-sm text-gray-500 hover:text-indigo-700"
                >
                  {l}
                </Link>
              ))}
            </div>
            <ConnectButton
              showBalance
              chainStatus="icon"
              accountStatus="address"
            />
          </nav>
          <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
