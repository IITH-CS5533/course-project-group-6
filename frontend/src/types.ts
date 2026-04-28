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

export interface UserDashboard {
  nftsOwned: NFTMetadata[];
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

