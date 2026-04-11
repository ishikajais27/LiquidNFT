export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="text-center py-16">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          NFT Lending Marketplace
        </h1>
        <p className="text-xl text-gray-500 max-w-xl mx-auto">
          Borrow ETH using your NFTs as collateral. Earn yield by funding loans.
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <a
            href="/lend"
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700"
          >
            Create Lending Offer
          </a>
          <a
            href="/loans"
            className="px-6 py-3 border-2 border-indigo-600 text-indigo-600 rounded-xl font-medium hover:bg-indigo-50"
          >
            My Loans
          </a>
        </div>
      </section>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 border shadow-sm">
          <div className="text-3xl mb-3">🖼️</div>
          <h3 className="font-semibold text-gray-800 mb-2">NFT Collateral</h3>
          <p className="text-sm text-gray-500">
            Deposit your NFT into escrow and borrow against it instantly.
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 border shadow-sm">
          <div className="text-3xl mb-3">💰</div>
          <h3 className="font-semibold text-gray-800 mb-2">Flexible Offers</h3>
          <p className="text-sm text-gray-500">
            Lenders set their own rates, amounts, and durations.
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 border shadow-sm">
          <div className="text-3xl mb-3">🔨</div>
          <h3 className="font-semibold text-gray-800 mb-2">
            Liquidation Auctions
          </h3>
          <p className="text-sm text-gray-500">
            Defaulted loans trigger 24-hour auctions for fair price discovery.
          </p>
        </div>
      </section>
    </div>
  )
}
