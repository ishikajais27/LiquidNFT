'use client'
import { useDepositNFT } from '@/hooks/useNFTEscrow'

interface Props {
  nftContract: `0x${string}`
  tokenId: bigint
  name?: string
  image?: string
}

export default function NFTCard({ nftContract, tokenId, name, image }: Props) {
  const { deposit, isPending, isSuccess } = useDepositNFT()

  return (
    <div className="border rounded-xl p-4 bg-white shadow-sm">
      {image && (
        <img
          src={image}
          alt={name}
          className="w-full h-48 object-cover rounded-lg mb-3"
        />
      )}
      <h3 className="font-semibold text-gray-800">
        {name || `Token #${tokenId.toString()}`}
      </h3>
      <p className="text-xs text-gray-500 truncate mb-3">{nftContract}</p>
      {isSuccess ? (
        <p className="text-green-600 text-sm font-medium">
          ✓ Deposited to Escrow
        </p>
      ) : (
        <button
          onClick={() => deposit(nftContract, tokenId)}
          disabled={isPending}
          className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {isPending ? 'Depositing...' : 'Deposit as Collateral'}
        </button>
      )}
    </div>
  )
}
