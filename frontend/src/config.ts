// Central configuration: contract addresses & network settings
// Update these with your deployed contract addresses

// Central configuration: contract addresses & network settings
// Update these with your deployed contract addresses

export const NETWORK = import.meta.env.VITE_NETWORK || "devnet"; // "mainnet" | "testnet" | "devnet"

// The address that deployed (and owns) the contract modules
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || "0x36c715cd33192e6d915d684e0ed2f97ff3ed8e32961dab9b980135d575b00098";

// Admin address (holds AdminConfig and VaultRef)
export const ADMIN_ADDRESS = import.meta.env.VITE_ADMIN_ADDRESS || CONTRACT_ADDRESS;

// The address holding the AuctionStore (same as contract deployer)
export const STORE_OWNER_ADDRESS = import.meta.env.VITE_STORE_OWNER_ADDRESS || CONTRACT_ADDRESS;

// Aptos node endpoints
export const APTOS_NODE_URL =
  NETWORK === "mainnet"
    ? "https://fullnode.mainnet.aptoslabs.com/v1"
    : NETWORK === "testnet"
    ? "https://fullnode.testnet.aptoslabs.com/v1"
    : "https://fullnode.devnet.aptoslabs.com/v1";

// Module identifiers
export const NFT_MODULE      = `${CONTRACT_ADDRESS}::nft`;
export const AUCTION_MODULE  = `${CONTRACT_ADDRESS}::auction`;
export const VAULT_MODULE    = `${CONTRACT_ADDRESS}::vault`;
export const CONFIG_MODULE   = `${CONTRACT_ADDRESS}::config`;

// 1 APT = 1e8 octas
export const OCTAS_PER_APT = 1e8;

export const formatAPT = (octas: number): string =>
  (octas / OCTAS_PER_APT).toFixed(4);

export const toOctas = (apt: number): number => Math.floor(apt * OCTAS_PER_APT);
