import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WalletContext } from "../App";
import { shortAddress, fetchUserNFTs, aptosClient } from "../hooks/useAptos";
import type { NFTMetadata } from "../types";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { CONTRACT_ADDRESS } from "../config";

function NFTCard({ nft, onTransfer }: { nft: NFTMetadata; onTransfer: (nft: NFTMetadata) => void }) {
  const navigate = useNavigate();
  return (
    <div className="card" style={{ overflow:"hidden" }}>
      <div style={{ position:"relative", paddingTop:"80%", background:"#1a2235", overflow:"hidden" }}>
        <img src={nft.imageUrl} alt={nft.name}
          style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover",
            transition:"transform 0.4s" }}
          onMouseOver={e => (e.currentTarget.style.transform="scale(1.05)")}
          onMouseOut={e => (e.currentTarget.style.transform="scale(1)")}
        />
        {nft.inAuction && (
          <div style={{ position:"absolute", top:10, left:10 }}>
            <span className="badge badge-active">In Auction</span>
          </div>
        )}
      </div>
      <div style={{ padding:"16px" }}>
        <h3 style={{ fontSize:16, fontWeight:700, marginBottom:4 }}>{nft.name}</h3>
        <p style={{ fontSize:13, color:"#64748b", marginBottom:2 }}>Token #{nft.id}</p>
        <p style={{ fontSize:12, color:"#475569", marginBottom:14 }}>
          Created by {shortAddress(nft.creator)}
        </p>
        <div style={{ display:"flex", gap:8 }}>
          {!nft.inAuction && (
            <button className="btn btn-primary btn-sm"
              onClick={() => navigate("/create-auction?nftId=" + nft.id)}>
              Sell at Auction
            </button>
          )}
          {!nft.inAuction && (
             <button className="btn btn-secondary btn-sm"
               onClick={() => onTransfer(nft)}>
               Transfer
             </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MyNFTsPage() {
  const { connected, connect, address } = useContext(WalletContext);
  const navigate = useNavigate();
  const { signAndSubmitTransaction } = useWallet();
  const [nfts, setNfts] = useState<NFTMetadata[]>([]);
  const [loading, setLoading] = useState(false);

  // Transfer Modal State
  const [transferNft, setTransferNft] = useState<NFTMetadata | null>(null);
  const [transferAddress, setTransferAddress] = useState("");
  const [txStatus, setTxStatus] = useState<"idle"|"pending"|"success"|"error">("idle");
  const [txMsg, setTxMsg] = useState("");

  // Toast notification
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const refreshNFTs = () => {
    if (connected && address) {
      setLoading(true);
      fetchUserNFTs(address).then((data) => {
        setNfts(data);
        setLoading(false);
      });
    } else {
      setNfts([]);
    }
  };

  useEffect(() => {
    refreshNFTs();
  }, [connected, address]);

  const handleTransfer = async () => {
    if (!transferNft || !transferAddress) return;
    setTxStatus("pending");
    setTxMsg("Validating recipient address...");
    
    try {
      // Validate recipient has initialized their collection
      const hasCollection = await aptosClient.view({
        payload: {
          function: `${CONTRACT_ADDRESS}::nft::has_collection`,
          typeArguments: [],
          functionArguments: [transferAddress],
        }
      });
      
      if (!hasCollection[0]) {
        setTxStatus("error");
        setTxMsg("Recipient address has not initialized an asset inventory. They must connect and mint at least one asset to receive transfers.");
        return;
      }
      
      setTxMsg("Awaiting transaction signature...");
      const payload = {
        data: {
          function: `${CONTRACT_ADDRESS}::nft::transfer_nft`,
          typeArguments: [],
          functionArguments: [transferAddress, transferNft.id],
        }
      };
      const response = await signAndSubmitTransaction(payload);
      setTxMsg("Transaction submitted. Waiting for network confirmation...");
      await aptosClient.waitForTransaction({ transactionHash: response.hash });
      
      // Close modal immediately and show toast
      setTransferNft(null);
      setTransferAddress("");
      setTxStatus("idle");
      setTxMsg("");
      showToast(`Asset successfully transferred to ${shortAddress(transferAddress)}.`);
      refreshNFTs();
    } catch (err: any) {
      console.error("Transfer failed", err);
      setTxStatus("error");
      setTxMsg(err.message || "Failed to transfer asset. Ensure the address is valid.");
    }
  };

  if (!connected) return (
    <div className="page">
      <div className="container" style={{ textAlign:"center", paddingTop:60 }}>
        <h2 style={{ fontSize:28, fontWeight:800, marginBottom:12 }}>User Asset Inventory</h2>
        <p style={{ color:"#94a3b8", marginBottom:28 }}>Authenticate with your wallet to view and manage your assets.</p>
        <button className="btn btn-primary btn-lg" onClick={connect}>Connect Wallet</button>
      </div>
    </div>
  );

  const inAuction = nfts.filter(n => n.inAuction);
  const available = nfts.filter(n => !n.inAuction);

  return (
    <div className="page" style={{ position: "relative" }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 200, minWidth: 320, maxWidth: 480,
          background: toast.type === "success" ? "linear-gradient(135deg,#10b981,#059669)" : "linear-gradient(135deg,#ef4444,#dc2626)",
          color: "white", padding: "14px 24px", borderRadius: 12,
          fontWeight: 700, fontSize: 15, boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span>{toast.type === "success" ? "✓" : "✕"}</span>
          {toast.msg}
        </div>
      )}
      <div className="container">
        <div className="section-header">
          <div>
            <h1 style={{ fontSize:28, fontWeight:900, marginBottom:4 }}>
              User <span className="gradient-text">Asset Inventory</span>
            </h1>
            <p style={{ color:"#64748b" }}>{loading ? "Loading..." : `${nfts.length} Assets Total • ${inAuction.length} Managed by Auction`}</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate("/mint")}>
            Mint New Asset
          </button>
        </div>

        {/* Stats */}
        <div className="grid-3" style={{ gap:16, marginBottom:36 }}>
          {[
            { label:"Total Assets", value: loading ? "-" : nfts.length },
            { label:"In Auction", value: loading ? "-" : inAuction.length },
            { label:"Available", value: loading ? "-" : available.length },
          ].map(s => (
            <div key={s.label} className="card stat-card" style={{ padding:"18px 22px" }}>
              <div className="stat-value" style={{ fontSize:28, marginBottom: 8 }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {available.length > 0 && (
          <>
            <h2 style={{ fontSize:20, fontWeight:700, marginBottom:18 }}>Available to Sell</h2>
            <div className="grid-3" style={{ marginBottom:40 }}>
              {available.map(n => <NFTCard key={n.id} nft={n} onTransfer={setTransferNft}/>)}
            </div>
          </>
        )}

        {inAuction.length > 0 && (
          <>
            <h2 style={{ fontSize:20, fontWeight:700, marginBottom:18 }}>Currently in Auction</h2>
            <div className="grid-3">
              {inAuction.map(n => <NFTCard key={n.id} nft={n} onTransfer={setTransferNft}/>)}
            </div>
          </>
        )}

        {!loading && nfts.length === 0 && (
          <div style={{ textAlign:"center", padding:"60px 0", color:"#475569" }}>
            <h3 style={{ fontSize:20, marginBottom:8 }}>No assets found</h3>
            <p style={{ marginBottom:20 }}>Initialize your inventory by minting an asset.</p>
            <button className="btn btn-primary" onClick={() => navigate("/mint")}>Mint Asset</button>
          </div>
        )}
      </div>

      {transferNft && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:50 }}>
          <div className="card" style={{ padding:24, width:"100%", maxWidth:400, background:"#0d1120" }}>
             <h2 style={{ fontSize:20, fontWeight:800, marginBottom:8 }}>Transfer Asset</h2>
             <p style={{ color:"#94a3b8", fontSize: 14, marginBottom: 20 }}>Send {transferNft.name} to another wallet address.</p>
             <div className="input-group" style={{ marginBottom:20 }}>
               <label>Recipient Address</label>
               <input className="input" value={transferAddress} onChange={e=>setTransferAddress(e.target.value)} placeholder="0x..." />
             </div>
             
             {txStatus === "pending" && <div className="alert alert-info" style={{ marginBottom: 20 }}>{txMsg}</div>}
             {txStatus === "success" && <div className="alert alert-success" style={{ marginBottom: 20 }}>{txMsg}</div>}
             {txStatus === "error" && <div className="alert alert-error" style={{ marginBottom: 20 }}>{txMsg}</div>}

             <div style={{ display:"flex", gap:12 }}>
               <button className="btn btn-primary" style={{ flex: 1, justifyContent:"center" }} onClick={handleTransfer} disabled={!transferAddress || txStatus==="pending" || txStatus==="success"}>
                 {txStatus === "pending" ? "Processing..." : "Confirm Transfer"}
               </button>
               <button className="btn btn-secondary" style={{ flex: 1, justifyContent:"center" }} onClick={() => { setTransferNft(null); setTxStatus("idle"); setTxMsg(""); }} disabled={txStatus==="pending"}>
                 Cancel
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
