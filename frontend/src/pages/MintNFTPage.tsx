import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle, AlertTriangle, Info } from "lucide-react";
import { WalletContext } from "../App";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { CONTRACT_ADDRESS } from "../config";
import { aptosClient } from "../hooks/useAptos";

export default function MintNFTPage() {
  const { connected, address, connect } = useContext(WalletContext);
  const { signAndSubmitTransaction } = useWallet();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name:"", description:"", imageUrl:"" });
  const [status, setStatus] = useState<"idle"|"pending"|"success"|"error">("idle");
  const [msg, setMsg] = useState("");
  const [preview, setPreview] = useState<string|null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (name === "imageUrl" && value.startsWith("http")) setPreview(value);
  }

  async function handleMint(e: React.FormEvent) {
    e.preventDefault();
    if (!connected) { connect(); return; }
    if (!form.name || !form.imageUrl) return;
    setStatus("pending");
    setMsg("Awaiting transaction signature in Petra.");
    
    try {
      const response = await signAndSubmitTransaction({
        data: {
          function: `${CONTRACT_ADDRESS}::nft::mint_nft`,
          typeArguments: [],
          functionArguments: [form.name, form.description, form.imageUrl],
        }
      });
      setStatus("pending");
      setMsg("Transaction submitted. Waiting for network confirmation...");
      await aptosClient.waitForTransaction({ transactionHash: response.hash });
      
      setStatus("success");
      setMsg(`Asset "${form.name}" successfully minted and stored in your account.`);
      setForm({ name:"", description:"", imageUrl:"" }); // reset form
    } catch (err: any) {
      console.error(err);
      setStatus("error");
      setMsg(err.message || "Failed to mint asset.");
    }
  }

  return (
    <div className="page">
      <div className="container" style={{ maxWidth:700 }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <h1 style={{ fontSize:32, fontWeight:900, marginBottom:8 }}>
            Mint Your <span className="gradient-text">Asset</span>
          </h1>
          <p style={{ color:"#94a3b8" }}>
            Create a Non-Fungible Token stored as a Move resource on the Aptos network.
          </p>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:28 }}>
          {/* Form */}
          <div>
            <form onSubmit={handleMint} style={{ display:"flex", flexDirection:"column", gap:18 }}>
              <div className="input-group">
                <label>Asset Name *</label>
                <input className="input" name="name" placeholder="Cosmic Genesis #001"
                  value={form.name} onChange={handleChange} required/>
              </div>
              <div className="input-group">
                <label>Description</label>
                <textarea className="input" name="description" placeholder="Describe your asset…"
                  value={form.description} onChange={handleChange} rows={4}/>
              </div>
              <div className="input-group">
                <label>Image URL *</label>
                <input className="input" name="imageUrl" type="url"
                  placeholder="https://…" value={form.imageUrl} onChange={handleChange} required/>
                <span style={{ fontSize:12, color:"#64748b" }}>
                  Paste any publicly accessible image URL (IPFS, Arweave, HTTPS)
                </span>
              </div>

              <div className="card" style={{ padding:16, fontSize:13 }}>
                <h4 style={{ fontWeight:700, marginBottom:10, fontSize:14 }}>On-chain Storage Overview</h4>
                <div style={{ display:"flex", flexDirection:"column", gap:6, color:"#94a3b8" }}>
                  <div>• Name, description, image URL stored as a Move resource</div>
                  <div>• Asset belongs exclusively to your wallet</div>
                  <div>• Single transaction with precise capability constraints</div>
                  <div>• Only the owner can execute transfer operations</div>
                </div>
              </div>

              {status === "success" && (
                <div className="alert alert-success">
                  <CheckCircle size={14}/> {msg}
                </div>
              )}
              {status === "error" && (
                <div className="alert alert-error">
                  <AlertTriangle size={14}/> {msg}
                </div>
              )}
              {status === "pending" && (
                <div className="alert alert-info">
                  <Info size={14}/> {msg}
                </div>
              )}

              <button className="btn btn-primary btn-lg" type="submit"
                style={{ justifyContent:"center" }}
                disabled={status==="pending"}>
                {status==="pending" ? "Processing..." : connected ? "Mint Asset" : "Connect Wallet to Mint"}
              </button>

              {status === "success" && (
                <button className="btn btn-secondary" type="button"
                  onClick={() => navigate("/my-nfts")} style={{ justifyContent:"center" }}>
                  View Inventory →
                </button>
              )}
            </form>
          </div>

          {/* Preview */}
          <div>
            <div className="card" style={{ overflow:"hidden", position:"sticky", top:84 }}>
              <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border)", fontSize:13, fontWeight:700, color:"#94a3b8" }}>
                Preview
              </div>
              <div style={{ aspectRatio:"1", background:"linear-gradient(135deg,#1a1f35,#2a1f45)",
                display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
                {preview ? (
                  <img src={preview} alt="preview" style={{ width:"100%", height:"100%", objectFit:"cover" }}
                    onError={() => setPreview(null)}/>
                ) : (
                  <div style={{ textAlign:"center", color:"#334155" }}>
                    <div style={{ fontSize:13, fontWeight: 600 }}>Image Placeholder</div>
                  </div>
                )}
              </div>
              <div style={{ padding:16 }}>
                <h3 style={{ fontWeight:700, fontSize:16, marginBottom:6 }}>
                  {form.name || "Untitled Asset"}
                </h3>
                <p style={{ fontSize:13, color:"#64748b", lineHeight:1.5 }}>
                  {form.description || "No description"}
                </p>
                {connected && (
                  <div style={{ fontSize:12, color:"#475569", marginTop:10 }}>
                    Owner: {address.slice(0,8)}…{address.slice(-4)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
