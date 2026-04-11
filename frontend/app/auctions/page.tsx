'use client'
import { useAuctionCount } from '@/hooks/useLiquidationAuction'
import AuctionCard from '@/components/AuctionCard'

export default function AuctionsPage() {
  const { data: count } = useAuctionCount()
  const ids = count
    ? Array.from({ length: Number(count) }, (_, i) => BigInt(i))
    : []

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">Liquidation Auctions</h1>
      <p className="text-gray-500">
        Bid on NFTs from defaulted loans. Auctions run for 24 hours.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ids.length ? (
          ids
            .reverse()
            .map((id) => <AuctionCard key={id.toString()} auctionId={id} />)
        ) : (
          <p className="text-gray-400 col-span-3">No auctions yet.</p>
        )}
      </div>
    </div>
  )
}
