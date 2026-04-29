import React, { useState, useContext, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, AlertTriangle, Info } from "lucide-react";
import { WalletContext } from "../App";
import { OCTAS_PER_APT, CONTRACT_ADDRESS, STORE_OWNER_ADDRESS, ADMIN_ADDRESS } from "../config";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { aptosClient, fetchUserNFTs } from "../hooks/useAptos";
import type { NFTMetadata } from "../types";

export default function CreateAuctionPage() {
  const { connected, address, connect } = useContext(WalletContext);
  const { signAndSubmitTransaction } = useWallet();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialNftId = searchParams.get("nftId") || "";
  
  const [myNfts, setMyNfts] = useState<NFTMetadata[]>([]);
  const [form, setForm] = useState({
    nftId: initialNftId,
    startingPrice: "",
  });
  const [duration, setDuration] = useState({ d: 1, h: 0, m: 0, s: 0 });
  const [advanced, setAdvanced] = useState({
    minBidInc: "5",
    cooldown: "10",
    maxBids: "20",
    maxExt: "5",
    speedBump: "120",
    extSecs: "300"
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [status, setStatus] = useState<"idle"|"pending"|"success"|"error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (connected && address) {
      fetchUserNFTs(address).then(setMyNfts);
    } else {
      setMyNfts([]);
    }
  }, [connected, address]);

  function handle(e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  function handleDuration(e: React.ChangeEvent<HTMLInputElement>) {
    let val = parseInt(e.target.value) || 0;
    if (e.target.name !== "d" && val > 59) val = 59; // cap h/m/s initially, though hours theoretically max at 23
    setDuration(d => ({ ...d, [e.target.name]: val }));
  }

  function handleAdvanced(e: React.ChangeEvent<HTMLInputElement>) {
    setAdvanced(a => ({ ...a, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!connected) { connect(); return; }
    setStatus("pending");
    setMsg("Awaiting transaction signature in Petra.");
    
    try {
      const totalSeconds = duration.d * 86400 + duration.h * 3600 + duration.m * 60 + duration.s;
      
      if (totalSeconds < 60) {
        setStatus("error");
        setMsg("Total duration must be at least 60 seconds.");
        return;
      }

      const functionArguments = [
        STORE_OWNER_ADDRESS, 
        ADMIN_ADDRESS, 
        form.nftId, 
        Math.floor(parseFloat(form.startingPrice) * OCTAS_PER_APT), 
        totalSeconds,
        Math.floor(parseFloat(advanced.minBidInc) * 100),
        parseInt(advanced.cooldown),
        parseInt(advanced.maxBids),
        parseInt(advanced.maxExt),
        parseInt(advanced.speedBump),
        parseInt(advanced.extSecs)
      ];

      const payload = {
        data: {
          function: `${CONTRACT_ADDRESS}::auction::create_forward_auction`,
          typeArguments: [],
          functionArguments
        }
      };

      const response = await signAndSubmitTransaction(payload);
      
      setMsg("Transaction submitted. Waiting for network confirmation...");
      await aptosClient.waitForTransaction({ transactionHash: response.hash });
      
      setStatus("success");
      setMsg("Auction successfully created on the network.");
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setMsg(err.message || "Failed to create auction.");
    }
  }



  return (
    <div className="page">
      <div className="container" style={{ maxWidth:680 }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <h1 style={{ fontSize:32, fontWeight:900, marginBottom:8 }}>
            Create <span className="gradient-text">Auction</span>
          </h1>
          <p style={{ color:"#94a3b8" }}>
            Launch a new NFT sale on-chain.
          </p>
        </div>
        <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:20 }}>
              <div className="input-group">
                <label>Select NFT to Sell *</label>
                <select className="input" name="nftId" value={form.nftId} onChange={handle} required>
                  <option value="">Choose an NFT…</option>
                  {myNfts.map(n => (
                    <option key={n.id} value={n.id} disabled={n.inAuction}>
                      {n.name}{n.inAuction?" (already in auction)":""}
                    </option>
                  ))}
                </select>
                {!connected && (
                  <span style={{ fontSize:12, color:"#f59e0b" }}>Connect wallet to see your NFTs</span>
                )}
              </div>
              <div className="input-group">
                <label>Starting Price (APT) *</label>
                <input className="input" type="number" name="startingPrice" min="0.01" step="0.01"
                  placeholder="1.00" value={form.startingPrice} onChange={handle} required/>
              </div>

          <div className="input-group">
            <label>Auction Duration *</label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12 }}>
              <div>
                <input className="input" type="number" name="d" value={duration.d} onChange={handleDuration} min="0" />
                <div style={{fontSize:11, color:"#64748b", marginTop:4, textAlign: "center"}}>Days</div>
              </div>
              <div>
                <input className="input" type="number" name="h" value={duration.h} onChange={handleDuration} min="0" max="23" />
                <div style={{fontSize:11, color:"#64748b", marginTop:4, textAlign: "center"}}>Hours</div>
              </div>
              <div>
                <input className="input" type="number" name="m" value={duration.m} onChange={handleDuration} min="0" max="59" />
                <div style={{fontSize:11, color:"#64748b", marginTop:4, textAlign: "center"}}>Minutes</div>
              </div>
              <div>
                <input className="input" type="number" name="s" value={duration.s} onChange={handleDuration} min="0" max="59" />
                <div style={{fontSize:11, color:"#64748b", marginTop:4, textAlign: "center"}}>Seconds</div>
              </div>
            </div>
            {duration.d * 86400 + duration.h * 3600 + duration.m * 60 + duration.s < 60 && (
               <span style={{ fontSize:12, color:"#ef4444", marginTop: 6, display: "block" }}>Must be at least 1 minute (60s).</span>
            )}
          </div>

          <div className="card" style={{ padding:16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setShowAdvanced(!showAdvanced)}>
              <h4 style={{ fontWeight:700, fontSize:14, margin:0, color:"#f1f5f9" }}>Advanced Settings</h4>
              <span style={{ color:"#94a3b8", fontSize: 13 }}>{showAdvanced ? "Hide ▲" : "Show ▼"}</span>
            </div>
            
            {showAdvanced && (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginTop:16 }}>
                <div className="input-group">
                  <label style={{ fontSize:12 }}>Min Bid Increment (%)</label>
                  <input className="input" type="number" step="0.1" name="minBidInc" value={advanced.minBidInc} onChange={handleAdvanced} required min="1"/>
                </div>
                <div className="input-group">
                  <label style={{ fontSize:12 }}>Bid Cooldown (Seconds)</label>
                  <input className="input" type="number" name="cooldown" value={advanced.cooldown} onChange={handleAdvanced} required min="0"/>
                </div>
                <div className="input-group">
                  <label style={{ fontSize:12 }}>Max Bids Per User</label>
                  <input className="input" type="number" name="maxBids" value={advanced.maxBids} onChange={handleAdvanced} required min="1"/>
                </div>
                <div className="input-group">
                  <label style={{ fontSize:12 }}>Max Extensions</label>
                  <input className="input" type="number" name="maxExt" value={advanced.maxExt} onChange={handleAdvanced} required min="0"/>
                </div>
                <div className="input-group">
                  <label style={{ fontSize:12 }}>Speed Bump Window (s)</label>
                  <input className="input" type="number" name="speedBump" value={advanced.speedBump} onChange={handleAdvanced} required min="0"/>
                </div>
                <div className="input-group">
                  <label style={{ fontSize:12 }}>Extension Amount (s)</label>
                  <input className="input" type="number" name="extSecs" value={advanced.extSecs} onChange={handleAdvanced} required min="0"/>
                </div>
              </div>
            )}
          </div>

          {status === "success" && (
            <div className="alert alert-success">
              <CheckCircle size={14}/> {msg}
            </div>
          )}
          {status === "error" && (
            <div className="alert alert-error"><AlertTriangle size={14}/> {msg}</div>
          )}
          {status === "pending" && (
            <div className="alert alert-info"><Info size={14}/> {msg}</div>
          )}

          <button className="btn btn-primary btn-lg" style={{ justifyContent:"center" }}
            type="submit" disabled={status==="pending"}>
            {status==="pending" ? "Processing..." : connected ? "Create Auction" : "Connect Wallet to Create"}
          </button>

          {status === "success" && (
            <button className="btn btn-secondary" type="button"
              onClick={() => navigate("/")} style={{ justifyContent:"center" }}>
              View Marketplace →
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
