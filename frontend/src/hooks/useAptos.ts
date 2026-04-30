// Aptos blockchain interaction hooks
// Uses @aptos-labs/ts-sdk for direct RPC calls

import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { NETWORK, APTOS_NODE_URL, CONTRACT_ADDRESS, ADMIN_ADDRESS, STORE_OWNER_ADDRESS, OCTAS_PER_APT, formatAPT } from "../config";
import type { NFTMetadata, Auction, BidRecord, SimulationResult } from "../types";

const networkMap: Record<string, Network> = {
  mainnet: Network.MAINNET,
  testnet: Network.TESTNET,
  devnet: Network.DEVNET,
};

export const aptosClient = new Aptos(
  new AptosConfig({ network: networkMap[NETWORK] || Network.TESTNET })
);

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalizes an Aptos address to a standard long format with leading zeros.
 * This ensures "0x1" correctly matches "0x00...01" during comparisons.
 */
export function normalizeAddress(addr: any): string {
  if (!addr) return "0x0";
  const str = typeof addr === "string" ? addr : addr.toString();
  if (str === "0x0") return "0x0";
  
  try {
    const clean = str.startsWith("0x") ? str.slice(2) : str;
    return "0x" + clean.toLowerCase().padStart(64, "0");
  } catch {
    return str.toLowerCase();
  }
}

// ─── NFT Functions ─────────────────────────────────────────────────────────────

export async function fetchUserNFTs(address: string): Promise<NFTMetadata[]> {
  try {
    // Use direct REST API to avoid SDK response-wrapping ambiguity
    // The REST endpoint /accounts/{addr}/resource/{type} returns { type, data: { nfts: [...] } }
    const url = `${APTOS_NODE_URL}/accounts/${address}/resource/${encodeURIComponent(CONTRACT_ADDRESS + "::nft::NFTCollection")}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      // 404 = no collection initialized yet — not an error
      return [];
    }
    const json = await resp.json();
    const nftsRaw: any[] = json?.data?.nfts ?? [];

    const nfts: NFTMetadata[] = nftsRaw.map((n: any) => ({
      id: Number(n.id),
      name: n.name,
      description: n.description,
      imageUrl: n.image_url,
      creator: n.creator,
      owner: address,
      createdAt: Number(n.created_at),
      inAuction: Boolean(n.in_auction),
    }));

    return nfts;
  } catch {
    // Network error — silently return empty
    return [];
  }
}

export async function fetchAllNFTs(): Promise<NFTMetadata[]> {
  // In production, index via Aptos indexer GraphQL
  return [];
}

// ─── Auction Functions ─────────────────────────────────────────────────────────

export async function fetchAllAuctions(): Promise<Auction[]> {
  try {
    const count = await aptosClient.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::auction::get_auction_count`,
        typeArguments: [],
        functionArguments: [STORE_OWNER_ADDRESS],
      },
    });
    const total = Number(count[0]);
    const auctions: Auction[] = [];

    for (let i = 0; i < total; i++) {
      try {
        const info = await aptosClient.view({
          payload: {
            function: `${CONTRACT_ADDRESS}::auction::get_auction_info`,
            typeArguments: [],
            functionArguments: [STORE_OWNER_ADDRESS, i],
          },
        });

        const statusNum = Number(info[8]);
        const statusMap: Record<number, "active" | "settled" | "cancelled"> = {
          0: "active",
          1: "settled",
          2: "cancelled",
        };

        const auctionType = Number(info[0]) === 0 ? "forward" : "reverse";
        const seller = info[1] as string;
        const nftId = Number(info[2]);
        const bestBidder = info[5] as string;
        const isSettled = statusNum === 1;

        let nftMetadata: NFTMetadata | undefined;
        // After settlement, NFT is transferred to winner — try seller first, then winner
        let nftOwner: string | undefined;

        if (auctionType === "forward") {
          // Try seller first (active auction or no bids)
          const addressesToTry = [seller];
          if (isSettled && bestBidder && bestBidder !== "0x0") {
            addressesToTry.push(bestBidder);
          }

          for (const ownerAddr of addressesToTry) {
            try {
              // Use REST API to fetch the whole NFTCollection and find the NFT by id
              const collectionUrl = `${APTOS_NODE_URL}/accounts/${ownerAddr}/resource/${encodeURIComponent(CONTRACT_ADDRESS + "::nft::NFTCollection")}`;
              const collRes = await fetch(collectionUrl);
              if (!collRes.ok) continue;
              const collJson = await collRes.json();
              const allNfts: any[] = collJson?.data?.nfts ?? [];
              const found = allNfts.find((n: any) => Number(n.id) === nftId);
              if (found) {
                nftMetadata = {
                  id: nftId,
                  name: found.name,
                  description: found.description,
                  imageUrl: found.image_url,
                  creator: found.creator,
                  owner: ownerAddr,
                  createdAt: Number(found.created_at),
                  inAuction: !isSettled,
                };
                nftOwner = ownerAddr;
                break;
              }
            } catch {
              // not found at this address, try next
            }
          }
        }

        let requirementDescription = "";
        let buyerBudget = 0;
        
        // Since the current smart contract get_auction_info interface doesn't return
        // requirement_description or buyer_budget, we use mock values so the UI doesn't break
        if (auctionType === "reverse") {
            requirementDescription = `Service request #${i}`;
            buyerBudget = Number(info[3]);
        }

        // Fetch bid history size
        let bidHistory: BidRecord[] = [];
        try {
           const bidCountRaw = await aptosClient.view({
              payload: {
                function: `${CONTRACT_ADDRESS}::auction::get_bid_count`,
                typeArguments: [],
                functionArguments: [STORE_OWNER_ADDRESS, i],
              }
           });
           const bidCount = Number(bidCountRaw[0]);
           if (bidCount > 0 && Number(info[4]) > 0 && info[5] !== "0x0") {
             bidHistory = [{
                 bidder: info[5] as string,
                 amount: Number(info[4]),
                 timestamp: Math.floor(Date.now() / 1000) - 100, // mock timestamp
             }];
           }
        } catch(e) {}

        auctions.push({
          id: i,
          auctionType,
          seller,
          nftId,
          nftOwner,
          requirementDescription,
          startingPrice: Number(info[3]),
          currentBestBid: Number(info[4]),
          bestBidder: info[5] as string,
          endTime: Number(info[6]),
          extensionCount: Number(info[7]),
          status: statusMap[statusNum] || "active",
          bidHistory: bidHistory,
          buyerBudget: buyerBudget,
          nftMetadata,
        });
      } catch {
        // skip this auction if the view fails
      }
    }
    return auctions.reverse(); // Newest first
  } catch {
    console.warn("Contract not deployed or data unavailable");
    return [];
  }
}

export async function settleForwardAuction(signAndSubmitTransaction: any, auctionId: number) {
  const payload = {
    function: `${CONTRACT_ADDRESS}::auction::settle_forward_auction`,
    typeArguments: [],
    functionArguments: [STORE_OWNER_ADDRESS, auctionId],
  };
  return await signAndSubmitTransaction(payload);
}

export async function settleReverseAuction(signAndSubmitTransaction: any, auctionId: number) {
  const payload = {
    function: `${CONTRACT_ADDRESS}::auction::settle_reverse_auction`,
    typeArguments: [],
    functionArguments: [STORE_OWNER_ADDRESS, auctionId],
  };
  return await signAndSubmitTransaction(payload);
}

// ─── Simulation ────────────────────────────────────────────────────────────────

export function simulateBid(auction: Auction, bidAmount: number, userAddress: string): SimulationResult {
  const now = Math.floor(Date.now() / 1000);
  const isActive = auction.status === "active" && now < auction.endTime;

  if (!isActive) {
    return {
      willSucceed: false,
      newHighestBid: auction.currentBestBid,
      timeExtended: false,
      newEndTime: auction.endTime,
      cooldownViolation: false,
      bidTooLow: false,
      minNextBid: 0,
      bidFee: 1_000_000,
      reason: "Auction has ended",
    };
  }

  const minBidIncBps = 500; // 5% – from admin config
  const isForward = auction.auctionType === "forward";
  
  let minNextBid: number;
  if (isForward) {
    minNextBid = auction.currentBestBid === 0
      ? auction.startingPrice
      : auction.currentBestBid + Math.floor((auction.currentBestBid * minBidIncBps) / 10000);
  } else {
    // Reverse Auction: Next bid must be lower
    minNextBid = auction.currentBestBid === 0
      ? auction.startingPrice
      : auction.currentBestBid - Math.floor((auction.currentBestBid * minBidIncBps) / 10000);
  }

  const bidTooLow = isForward ? bidAmount < minNextBid : bidAmount > minNextBid;

  const speedBumpSeconds = 120;
  const extensionSeconds = 300;
  const maxExtensions = 5;

  const timeToEnd = auction.endTime - now;
  const wouldExtend =
    timeToEnd <= speedBumpSeconds && auction.extensionCount < maxExtensions;

  const newEndTime = wouldExtend
    ? auction.endTime + extensionSeconds
    : auction.endTime;

  // Check cooldown from bid history
  const userLastBid = auction.bidHistory
    .filter((b) => b.bidder === userAddress)
    .sort((a, b) => b.timestamp - a.timestamp)[0];

  const cooldownViolation = userLastBid
    ? now - userLastBid.timestamp < 10
    : false;

  const willSucceed = !bidTooLow && !cooldownViolation && isActive;

  return {
    willSucceed,
    newHighestBid: willSucceed ? bidAmount : auction.currentBestBid,
    timeExtended: willSucceed && wouldExtend,
    newEndTime: willSucceed ? newEndTime : auction.endTime,
    cooldownViolation,
    bidTooLow,
    minNextBid,
    bidFee: 1_000_000,
    reason: bidTooLow
      ? (isForward ? `Minimum bid is ${formatAPT(minNextBid)} APT` : `Maximum offer is ${formatAPT(minNextBid)} APT`)
      : cooldownViolation
      ? "Please wait for your cooldown period"
      : undefined,
  };
}

export function timeRemaining(endTime: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = endTime - now;
  if (diff <= 0) return "Ended";
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function shortAddress(addr: string): string {
  if (!addr || addr === "0x0" || addr.length < 10) return addr || "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export { formatAPT, OCTAS_PER_APT };
