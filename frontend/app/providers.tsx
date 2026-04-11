'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider } from '@rainbow-me/rainbowkit'
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { hardhat, sepolia } from 'wagmi/chains'
import '@rainbow-me/rainbowkit/styles.css'

const config = getDefaultConfig({
  appName: 'NFT Lending',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_ID || 'YOUR_PROJECT_ID',
  chains: [hardhat, sepolia],
  ssr: true,
})

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
