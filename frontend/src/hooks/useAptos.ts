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
export function normalizeAddress(addr: string): string {
  if (!addr || addr === "0x0") return "0x0";
  try {
    // Remove 0x prefix, pad to 64 chars, add 0x back
    const clean = addr.startsWith("0x") ? addr.slice(2) : addr;
    return "0x" + clean.toLowerCase().padStart(64, "0");
  } catch {
    return addr.toLowerCase();
  }
}

// ─── NFT Functions ─────────────────────────────────────────────────────────────

export async function fetchUserNFTs(address: string): Promise<NFTMetadata[]> {
  try {
    const resource = await aptosClient.getAccountResource({
      accountAddress: address,
      resourceType: `${CONTRACT_ADDRESS}::nft::NFTCollection`
    });

    const data = resource as any;
    const nftsRaw = data?.nfts || [];
    
    const nfts: NFTMetadata[] = nftsRaw.map((n: any) => ({
      id: Number(n.id),
      name: n.name,
      description: n.description,
      imageUrl: n.image_url,
      creator: n.creator,
      owner: address,
      createdAt: Number(n.created_at),
      inAuction: Boolean(n.in_auction)
    }));

    // Refined override to support legacy auctions (created before the contract fix)
    // We match by ID AND Creator to distinguish between collided IDs (e.g. two Token #0s)
    try {
      const allAuctions = await fetchAllAuctions();
      const normalizedUserAddr = normalizeAddress(address);
      
      const activeAuctionKeys = new Set(
         allAuctions
           .filter(a => a.status === "active" && a.auctionType === "forward" && normalizeAddress(a.seller) === normalizedUserAddr)
           .map(a => `${a.nftId}-${normalizeAddress(a.nftMetadata?.creator || "")}`)
      );

      for (const nft of nfts) {
        const nftKey = `${nft.id}-${normalizeAddress(nft.creator)}`;
        if (activeAuctionKeys.has(nftKey)) {
          nft.inAuction = true;
        } else if (nft.inAuction) {
          nft.inAuction = false;
        }
      }
    } catch (e) {
      console.warn("Could not cross-reference active auctions", e);
    }

    return nfts;
  } catch {
    console.warn("Contract not deployed or error fetching NFTs");
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

        let nftMetadata: NFTMetadata | undefined;

        if (auctionType === "forward") {
          try {
            const nftInfo = await aptosClient.view({
              payload: {
                function: `${CONTRACT_ADDRESS}::nft::get_nft_info`,
                typeArguments: [],
                functionArguments: [seller, nftId],
              },
            });
            nftMetadata = {
              id: nftId,
              name: nftInfo[0] as string,
              description: nftInfo[1] as string,
              imageUrl: nftInfo[2] as string,
              creator: nftInfo[3] as string,
              owner: seller,
              createdAt: Number(nftInfo[5]),
              inAuction: true,
            };
          } catch (e) {
            console.error(`Failed to fetch NFT info for auction ${i}`, e);
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
           // We might need an actual function in the contract to get bid history,
           // but for MVP we will synthesize the last bid based on the current best.
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
