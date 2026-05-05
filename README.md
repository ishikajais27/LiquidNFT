
What Is This?
LiquidNFT is an NFT lending marketplace on Ethereum's Sepolia testnet. You own an NFT, you need ETH, but you don't want to sell. So you lock the NFT as collateral, borrow ETH against it, and get it back when you repay. Miss the deadline and your NFT goes to auction.
No bank. No approval process. Smart contracts handle everything automatically, and the rules are the same for everyone. Users authenticate with email and password, their wallet address is cryptographically secured in MongoDB, and their on-chain activity syncs back to the database so their history persists across sessions and devices.

The Problem It Solves
NFTs are illiquid. If you hold a valuable NFT and need cash today, your only option is to sell it, giving up ownership permanently. LiquidNFT works like a pawn shop on-chain. Lock your NFT, get ETH, pay it back, reclaim your asset. There's no middleman taking a cut and no one who can change the terms on you.

Tech Stack
Smart contracts: Solidity, deployed on Sepolia via Foundry.
Frontend: Next.js (App Router), ethers.js v6, MetaMask via window.ethereum. No extra wallet libraries.
Backend: Next.js API Routes (all under /api), MongoDB via Mongoose, JWT for session auth, bcrypt for password hashing, AES-256-GCM for wallet address encryption.
Database: MongoDB with a single User collection. All on-chain activity (offers, loans, escrows, bids, auctions won, NFT portfolio) is mirrored into the user document as embedded subdocuments.

Key Concepts
Escrow — The contract holds the NFT neutrally during a loan. Neither the borrower nor the lender can touch it until repayment or default triggers its release.
Basis Points — Interest rates are expressed in bps instead of percentages. 100 bps = 1%, so 1000 bps = 10% annual. Solidity can't handle decimals natively, so this keeps all the math in whole numbers.
Pro-rated Interest — Interest accrues every second from the moment a loan starts. Repay early and you pay less. The formula is principal × rate × seconds_elapsed / (10000 × 31536000). Nothing is fixed upfront.
Liquidation — When a loan expires unpaid, anyone can trigger a default. The NFT goes into a 24-hour auction and the winning bid goes to the lender as compensation.
ReentrancyGuard — A security pattern on every function that moves ETH. It marks the function as "in progress" so if a malicious contract tries to call back in before the first call finishes, it gets rejected. Standard practice for DeFi contracts.
JWT Auth — Sessions are managed with a signed 7-day JWT stored in an httpOnly cookie. The token carries userId and email. Every protected API route reads this cookie, verifies the token with jsonwebtoken, and extracts the user ID for database lookups.
Wallet Security Model — A wallet address is stored two ways simultaneously. The bcrypt hash (via walletAddressHash) is used for fast equality checks. The AES-256-GCM ciphertext (via walletAddressEncrypted) allows the server to decrypt and return the actual address to the frontend for auto-reconnect. The raw address is never persisted in plaintext anywhere.

The Four Smart Contracts
NFTEscrow — One job: hold NFTs safely. It doesn't know about interest or loan terms. It just stores NFTs, locks them when a loan starts, releases them on repayment, and sends them to the auction winner on default. Only the LoanManager is allowed to trigger any of these; nothing else can touch the NFTs.
LendingPool — Holds lenders' ETH and manages offers. When a borrower accepts an offer, the ETH goes straight to them. When they repay, the ETH goes straight to the lender. The pool doesn't keep anything; it's a pass-through with enforced rules. Lenders can cancel unmatched offers anytime and get their ETH back immediately.
LoanManager — The coordinator. Borrowers call this to take loans and repay them. When a loan starts, it tells the escrow to lock the NFT and tells the pool to send ETH to the borrower. On repayment, it reverses both. It also tracks every loan's status, calculates interest in real time, and handles triggering defaults when loans expire.
LiquidationAuction — Runs 24-hour English auctions when a loan defaults. Anyone can bid. When you're outbid, your ETH isn't automatically sent back; it sits in a pending balance that you withdraw yourself. This is intentional because auto-refunds can be exploited. After 24 hours, anyone can settle the auction. The highest bidder gets the NFT, the lender gets the ETH. If nobody bid, the lender gets the NFT back directly.

The Full Loan Lifecycle
Lender calls createOffer on LendingPool, sends ETH and sets interest rate and duration
Borrower calls approve on their NFT contract to allow the escrow to take it
Borrower calls depositNFT on NFTEscrow — NFT transfers in, contract returns an escrowId
Borrower calls takeLoan on LoanManager with the escrowId and chosen offerId
NFT locks, ETH lands in borrower's wallet, interest starts accruing immediately
Repayment: Borrower calls repayLoan with enough ETH — NFT returned, ETH forwarded to lender, any overpayment refunded
Default: Anyone calls triggerDefault after expiry — 24-hour auction starts, highest bidder wins NFT, lender gets ETH, outbid participants call withdrawRefund

Authentication & Session System
How Auth Works
Every user registers with email and password. Passwords are bcrypt-hashed with cost factor 12 before storage. On login, bcrypt.compare runs against the stored hash. On success, signToken creates a JWT signed with JWT_SECRET that expires in 7 days. This token is sent as an httpOnly, SameSite: lax cookie so JavaScript on the client can never read it directly.
Every subsequent request to a protected route reads req.cookies.get('token'), passes it through verifyToken, and extracts userId to query MongoDB. If the token is missing, expired, or tampered with, the route returns 401 immediately.
Logout simply overwrites the cookie with an empty value and maxAge: 0, which forces the browser to expire it immediately.
Wallet Connection Flow
Connecting a MetaMask wallet is a separate action from logging in. After the user authenticates with email/password, they click "Connect Wallet" which triggers useWallet's connect function. That calls eth_requestAccounts, gets the connected address, then POSTs it to /api/auth/wallet.
The wallet route runs two operations on that address before saving: hashWalletAddress runs bcrypt.hash on the lowercased address (used later for lookup), and encryptWalletAddress runs AES-256-GCM encryption using a key derived from JWT_SECRET via SHA-256 (used to recover the address for display). Both are stored on the user document alongside walletConnectedAt.
Disconnecting hits /api/auth/wallet/disconnect, which blanks out both fields and nulls walletConnectedAt in the database.
Auto-Reconnect on Return
When a user comes back to the app, the /api/auth/me route fires first. It reads the JWT cookie, fetches the user from MongoDB, decrypts walletAddressEncrypted using decryptWalletAddress, and returns the plaintext address in the response as walletAddress.
useWallet receives this address as savedWalletAddress. Inside tryAutoConnect, it first calls eth_accounts (a silent, no-popup check) to see if MetaMask already has that account approved in this browser. If it does, the wallet reconnects without any user interaction. If not — which happens on a new device or after MetaMask was reset — it calls eth_requestAccounts and shows the MetaMask popup to ask the user to reconnect. If the user selects the wrong account or rejects it, auto-connect silently fails and they can connect manually.

API Routes
POST /api/auth/signup — Validates email and password (minimum 6 characters), checks for duplicate email, bcrypt-hashes the password with cost 12, creates the user document, returns a JWT cookie and the user object.
POST /api/auth/login — Looks up user by email, runs bcrypt.compare, updates lastLoginAt, decrypts the stored wallet address to return it for auto-reconnect, sets the JWT cookie.
POST /api/auth/logout — No auth required. Zeroes the cookie.
GET /api/auth/me — Requires valid JWT cookie. Fetches user from MongoDB excluding password and walletAddressHash, decrypts the wallet address, returns the full user object.
POST /api/auth/wallet — Requires valid JWT. Accepts walletAddress in the request body. Hashes it with bcrypt and encrypts it with AES-256-GCM, then updates the user document with both values and sets walletConnectedAt.
POST /api/auth/wallet/disconnect — Requires valid JWT. Blanks wallet fields on the user document.
POST /api/user/save — Requires valid JWT. The main data sync endpoint. Accepts a flexible body with multiple operations in one request. Supported operations:
$set on top-level scalar fields: lastActiveTab, preferredNetwork, repaymentBufferAcknowledged, notificationPrefs, totalEthLent, offersCreated, offersMatched, offersCancelled
$push to append subdocuments: pushOffer, pushEscrow, pushLoan, pushBid, pushAuctionWon, pushNFTPortfolio
updateOfferStatus — targets a single offer by offerId using MongoDB's positional $ operator and sets its status
updateLoanStatus — targets a single loan by loanId, sets status and optionally repaidAt, repaidAmount, overpaymentRefund
updateEscrowStatus — targets a single escrow by escrowId, sets status
updateBidOutcome — targets a single bid by auctionId, sets outcome and optionally refundAmount and refundWithdrawnAt
updateBidRefundWithdrawn — marks a bid as fully refunded, records refundWithdrawnAmount and refundWithdrawnAt
updateNFTPortfolioStatus — targets a portfolio item by escrowId, sets status and optionally resolvedAt and loanId
syncBidRefunds — accepts an array of { auctionId, refundAmount, outcome } objects and bulk-updates pending bid refund amounts from the contract in one request
The route runs subdoc updates first with separate targeted updateOne calls (to use the positional operator correctly), then runs the remaining $set and $push operations in a single findByIdAndUpdate. It returns the full updated user document.

Database Schema
There is one MongoDB collection: users. Every document is a single user with all their activity embedded inside it.
Top-level user fields: email (unique, lowercased), password (bcrypt hash), walletAddressHash (bcrypt hash of wallet for comparison), walletAddressEncrypted (AES-256-GCM ciphertext for recovery), walletConnectedAt, lastLoginAt, createdAt, updatedAt, lastActiveTab, preferredNetwork, repaymentBufferAcknowledged.
Aggregates: totalEthLent (string to preserve precision), offersCreated, offersMatched, offersCancelled.
Subdocument arrays:
offers - each entry has offerId, amount, rateBps, durationDays, status (active | matched | cancelled), createdAt.
escrows - each entry has escrowId, nftContract, tokenId, depositedAt, status (locked | unlocked | liquidated).
loans - each entry has loanId, escrowId, offerId, principal, rateBps, durationDays, startTime, expiryTime, lenderAddress, status (Active | Repaid | Defaulted | Liquidated), repaidAt, repaidAmount, overpaymentRefund.
bids - each entry has auctionId, amount, placedAt, outcome (pending | won | outbid | refunded), refundAmount, refundWithdrawnAt, refundWithdrawnAmount.
auctionsWon - each entry has auctionId, nftContract, tokenId, wonAt, paidAmount.
nftPortfolio - each entry has nftContract, tokenId, escrowId, loanId, status (in_escrow | locked_in_loan | returned | liquidated), depositedAt, resolvedAt.
notificationPrefs - embedded object with loanExpiryAlert, outbidAlert, loanRepaidAlert (all booleans, default true), expiryAlertHoursBefore (number, default 24).
There is a secondary index on walletAddressHash to support potential future wallet-based user lookups without a full collection scan.

Frontend
Built with Next.js and ethers.js v6, connected directly to MetaMask via window.ethereum. No extra wallet libraries.
lib/contracts.ts holds all four contract addresses (pulled from env vars) and their ABIs written as human-readable strings. Ethers.js parses these automatically; no need for the full compiled JSON artifact.
lib/hooks.ts has four React hooks. useWallet handles connecting MetaMask, auto-connecting if the site was previously approved, detecting wrong networks, and switching to Sepolia automatically. It has a connecting guard so double-clicking the connect button doesn't open MetaMask twice, and a matching disconnecting guard on disconnect. useOffers fetches active lending offers from the LendingPool contract. useLoans fetches the connected address's loans from LoanManager with live interest calculations. useAuctions fetches all unsettled auctions from LiquidationAuction.
app/page.tsx is the entire main UI across four tabs: Lend, Borrow, My Loans, and Auctions. The borrow flow chains three transactions approve NFT, deposit to escrow, take loan waiting for each to mine before starting the next. The escrowId needed for the third step is pulled directly from the event logs of the second transaction.
app/login/page.tsx is the login and signup UI, a single glassmorphism card with a tab switcher between the two modes. On successful login, the server returns the decrypted wallet address and the page attempts a silent MetaMask check before redirecting to the main app.

Deployment
You need Foundry installed, a MetaMask wallet with Sepolia ETH, an Alchemy RPC URL, an Etherscan API key, a MongoDB Atlas connection string, and a JWT secret.
Set up your .env at the project root for Foundry:
PRIVATE_KEY=your_private_key
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_key
ETHERSCAN_API_KEY=your_key
Set up .env.local for Next.js:
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=a_long_random_secret_string
NEXT_PUBLIC_LENDING_POOL=deployed_address
NEXT_PUBLIC_LOAN_MANAGER=deployed_address
NEXT_PUBLIC_NFT_ESCROW=deployed_address
NEXT_PUBLIC_LIQUIDATION_AUCTION=deployed_address
Install dependencies and deploy:
forge install OpenZeppelin/openzeppelin-contracts
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY -vvvv
The deploy script handles the order automatically, deploys all four contracts, then wires them together by calling setLoanManager on each one. Copy the four deployed addresses into .env.local, then run npm run dev.
To test, open Remix IDE, deploy the TestNFT contract on Sepolia, and call mint() to give yourself a token to borrow against.



