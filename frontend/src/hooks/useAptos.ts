// Aptos blockchain interaction hooks
// Uses @aptos-labs/ts-sdk for direct RPC calls

import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { NETWORK, APTOS_NODE_URL, CONTRACT_ADDRESS, ADMIN_ADDRESS, STORE_OWNER_ADDRESS, OCTAS_PER_APT, formatAPT } from "../config";
import type { NFTMetadata} from "../types";

const networkMap: Record<string, Network> = {
  mainnet: Network.MAINNET,
  testnet: Network.TESTNET,
  devnet: Network.DEVNET,
};

export const aptosClient = new Aptos(
  new AptosConfig({ network: networkMap[NETWORK] || Network.TESTNET })
);

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
