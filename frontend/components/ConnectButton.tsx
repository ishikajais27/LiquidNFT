'use client'
import { ConnectButton as RainbowConnect } from '@rainbow-me/rainbowkit'

export default function ConnectButton() {
  return (
    <RainbowConnect
      showBalance={true}
      chainStatus="icon"
      accountStatus="address"
    />
  )
}
