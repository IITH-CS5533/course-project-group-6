// Mock data for development / demo when wallet is not connected
// Replace with live Aptos RPC calls in production

import type { NFTMetadata, Auction, BidRecord } from "../types";

export const MOCK_NFTS: NFTMetadata[] = [
  {
    id: 0,
    name: "Cosmic Genesis #001",
    description: "The first entity in the cosmos, rendered on-chain.",
    imageUrl: "https://picsum.photos/seed/nft0/400/400",
    creator: "0xabcd1234",
    owner: "0xabcd1234",
    createdAt: Date.now() / 1000 - 86400 * 5,
    inAuction: true,
  },
  {
    id: 1,
    name: "Digital Samurai",
    description: "A warrior of the digital age, forged in binary code.",
    imageUrl: "https://picsum.photos/seed/nft1/400/400",
    creator: "0xdeadbeef",
    owner: "0xdeadbeef",
    createdAt: Date.now() / 1000 - 86400 * 3,
    inAuction: false,
  },
  {
    id: 2,
    name: "Neon Phoenix",
    description: "Reborn in neon light, eternally rising from digital ashes.",
    imageUrl: "https://picsum.photos/seed/nft2/400/400",
    creator: "0xcafebabe",
    owner: "0xcafebabe",
    createdAt: Date.now() / 1000 - 86400 * 1,
    inAuction: true,
  },
  {
    id: 3,
    name: "Quantum Drift",
    description: "Existing simultaneously in all blockchain states.",
    imageUrl: "https://picsum.photos/seed/nft3/400/400",
    creator: "0x1234abcd",
    owner: "0x1234abcd",
    createdAt: Date.now() / 1000 - 3600 * 12,
    inAuction: false,
  },
  {
    id: 4,
    name: "Void Walker",
    description: "Traversing the empty spaces between blocks.",
    imageUrl: "https://picsum.photos/seed/nft4/400/400",
    creator: "0xfeedface",
    owner: "0xfeedface",
    createdAt: Date.now() / 1000 - 3600 * 6,
    inAuction: true,
  },
  {
    id: 5,
    name: "Crystal Mind",
    description: "A lattice of pure thought crystallised on-chain.",
    imageUrl: "https://picsum.photos/seed/nft5/400/400",
    creator: "0xbaddcafe",
    owner: "0xbaddcafe",
    createdAt: Date.now() / 1000 - 3600 * 2,
    inAuction: false,
  },
];

const now = Math.floor(Date.now() / 1000);

export const MOCK_BID_HISTORY: BidRecord[] = [
  { bidder: "0xaaa1", amount: 150_000_000, timestamp: now - 3600 },
  { bidder: "0xbbb2", amount: 200_000_000, timestamp: now - 2800 },
  { bidder: "0xccc3", amount: 280_000_000, timestamp: now - 1800 },
  { bidder: "0xddd4", amount: 350_000_000, timestamp: now - 900 },
];

export const MOCK_AUCTIONS: Auction[] = [
  {
    id: 0,
    auctionType: "forward",
    seller: "0xabcd1234",
    nftId: 0,
    nftMetadata: MOCK_NFTS[0],
    requirementDescription: "",
    startingPrice: 100_000_000,       // 1 APT
    currentBestBid: 350_000_000,      // 3.5 APT
    bestBidder: "0xddd4",
    endTime: now + 3600 * 2,          // 2 hours from now
    extensionCount: 1,
    status: "active",
    bidHistory: MOCK_BID_HISTORY,
    buyerBudget: 0,
  },
  {
    id: 1,
    auctionType: "forward",
    seller: "0xcafebabe",
    nftId: 2,
    nftMetadata: MOCK_NFTS[2],
    requirementDescription: "",
    startingPrice: 200_000_000,
    currentBestBid: 420_000_000,
    bestBidder: "0xeee5",
    endTime: now + 3600 * 6,
    extensionCount: 0,
    status: "active",
    bidHistory: [
      { bidder: "0xeee5", amount: 420_000_000, timestamp: now - 600 },
    ],
    buyerBudget: 0,
  },
  {
    id: 2,
    auctionType: "forward",
    seller: "0xfeedface",
    nftId: 4,
    nftMetadata: MOCK_NFTS[4],
    requirementDescription: "",
    startingPrice: 50_000_000,
    currentBestBid: 180_000_000,
    bestBidder: "0xfff6",
    endTime: now + 300,               // 5 minutes (almost ending!)
    extensionCount: 3,
    status: "active",
    bidHistory: [
      { bidder: "0xfff6", amount: 180_000_000, timestamp: now - 120 },
    ],
    buyerBudget: 0,
  },
  {
    id: 3,
    auctionType: "reverse",
    seller: "0x9876fedc",
    nftId: 0,
    requirementDescription: "Build a Rust WebAssembly module for real-time price feeds. Must support 10k req/sec throughput. Deliver within 2 weeks.",
    startingPrice: 500_000_000,       // max budget 5 APT
    currentBestBid: 320_000_000,
    bestBidder: "0xdev001",
    endTime: now + 3600 * 12,
    extensionCount: 0,
    status: "active",
    bidHistory: [
      { bidder: "0xdev001", amount: 400_000_000, timestamp: now - 7200 },
      { bidder: "0xdev002", amount: 350_000_000, timestamp: now - 3600 },
      { bidder: "0xdev001", amount: 320_000_000, timestamp: now - 1000 },
    ],
    buyerBudget: 500_000_000,
  },
  {
    id: 4,
    auctionType: "forward",
    seller: "0xabcd1234",
    nftId: 0,
    nftMetadata: { ...MOCK_NFTS[0], name: "Cosmic Genesis #000", inAuction: false },
    requirementDescription: "",
    startingPrice: 300_000_000,
    currentBestBid: 750_000_000,
    bestBidder: "0xwinner",
    endTime: now - 3600,              // ended 1 hour ago
    extensionCount: 2,
    status: "settled",
    bidHistory: [],
    buyerBudget: 0,
  },
];

export const MY_NFTS: NFTMetadata[] = [MOCK_NFTS[1], MOCK_NFTS[3], MOCK_NFTS[5]];
