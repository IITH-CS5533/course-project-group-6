// Type definitions for the NFT auction marketplace

export interface NFTMetadata {
  id: number;
  name: string;
  description: string;
  imageUrl: string;
  creator: string;
  owner: string;
  createdAt: number;
  inAuction: boolean;
}

export type AuctionType = "forward" | "reverse";
export type AuctionStatus = "active" | "settled" | "cancelled";

export interface BidRecord {
  bidder: string;
  amount: number;
  timestamp: number;
}

export interface Auction {
  id: number;
  auctionType: AuctionType;
  seller: string;
  nftId: number;
  nftOwner?: string;                 // current owner of the NFT (winner after settlement)
  nftMetadata?: NFTMetadata;        // enriched client-side
  requirementDescription: string;   // for reverse auctions
  startingPrice: number;
  currentBestBid: number;
  bestBidder: string;
  endTime: number;                  // unix seconds
  extensionCount: number;
  status: AuctionStatus;
  bidHistory: BidRecord[];
  buyerBudget: number;              // for reverse auctions
}

export interface UserDashboard {
  auctionsCreated: Auction[];
  bidsPlaced: BidRecord[];
  auctionsWon: Auction[];
  nftsOwned: NFTMetadata[];
}

export interface SimulationResult {
  willSucceed: boolean;
  newHighestBid: number;
  timeExtended: boolean;
  newEndTime: number;
  cooldownViolation: boolean;
  bidTooLow: boolean;
  minNextBid: number;
  bidFee: number;
  reason?: string;
}

export interface WalletContextType {
  connected: boolean;
  address?: string;
  connect: () => void;
  disconnect: () => void;
  signAndSubmitTransaction: (payload: TransactionPayload) => Promise<string>;
}

export interface TransactionPayload {
  function: string;
  type_arguments: string[];
  arguments: (string | number | boolean | string[])[];
}

export type SortOption = "endTime" | "currentBid" | "startPrice" | "newest";
export type FilterStatus = "all" | "active" | "settled";
export type FilterType  = "all" | "forward" | "reverse";
