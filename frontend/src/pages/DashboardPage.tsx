import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WalletContext } from "../App";
import { formatAPT, shortAddress, timeRemaining, fetchAllAuctions, fetchUserNFTs } from "../hooks/useAptos";
import type { Auction, NFTMetadata } from "../types";

export default function DashboardPage() {
  const { connected, address, connect } = useContext(WalletContext);
  const navigate = useNavigate();

  const [nfts, setNfts] = useState<NFTMetadata[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (connected && address) {
      setLoading(true);
      Promise.all([
        fetchUserNFTs(address),
        fetchAllAuctions()
      ]).then(([nftData, auctionData]) => {
        setNfts(nftData);
        setAuctions(auctionData);
        setLoading(false);
      });
    } else {
      setNfts([]);
      setAuctions([]);
      setLoading(false);
    }
  }, [connected, address]);

  if (!connected) return (
    <div className="page">
      <div className="container" style={{ textAlign:"center", paddingTop:60 }}>
        <h2 style={{ fontSize:28, fontWeight:800, marginBottom:12 }}>User Dashboard</h2>
        <p style={{ color:"#94a3b8", marginBottom:28 }}>Authenticate with your wallet to view your account activity.</p>
        <button className="btn btn-primary btn-lg" onClick={connect}>Connect Wallet</button>
      </div>
    </div>
  );

  const myAuctions = auctions.filter(a => a.seller === address);
  const wonAuctions = auctions.filter(a => a.status === "settled" && a.bestBidder === address);
  const myBids = auctions.flatMap(a => a.bidHistory.filter(b => b.bidder === address))
    .sort((a,b) => b.timestamp - a.timestamp);

  const totalVolumeBid = myBids.reduce((s,b) => s + b.amount, 0);

  return (
    <div className="page">
      <div className="container">
        <div className="section-header">
          <div>
            <h1 style={{ fontSize:28, fontWeight:900, marginBottom:4 }}>
              User <span className="gradient-text">Dashboard</span>
            </h1>
            <p style={{ fontSize:14, color:"#64748b" }}>Address: {shortAddress(address || "")}</p>
          </div>
        </div>

        {/* Summary stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:36 }}>
          {[
            { label:"NFTs Owned", value: loading ? "-" : nfts.length, color:"#6366f1" },
            { label:"Auctions Created", value: loading ? "-" : myAuctions.length, color:"#10b981" },
            { label:"Auctions Won", value: loading ? "-" : wonAuctions.length, color:"#f59e0b" },
            { label:"Volume Bid", value:`${loading ? "-" : formatAPT(totalVolumeBid)} APT`, color:"#ec4899" },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding:"20px 22px" }}>
              <div style={{ fontSize:26, fontWeight:800, fontFamily:"'Space Grotesk',sans-serif", color:s.color }}>
                {s.value}
              </div>
              <div style={{ fontSize:12, color:"#64748b", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em", marginTop:4 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:"center", padding:"80px 0" }}>
            <h2>Loading Dashboard...</h2>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:28 }}>
            {/* My Auctions */}
            <div>
              <div className="section-header" style={{ marginBottom:16 }}>
                <h2 style={{ fontSize:18, fontWeight:700 }}>Created Auctions</h2>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate("/create-auction")}>
                  Create Auction
                </button>
              </div>
              {myAuctions.length === 0 ? (
                <div className="card" style={{ padding:32, textAlign:"center", color:"#475569" }}>
                  No published auctions available.
                </div>
              ) : (
                myAuctions.map(a => (
                  <div key={a.id} className="card" style={{ padding:"16px", marginBottom:12, cursor:"pointer" }}
                    onClick={() => navigate(`/auction/${a.id}`)}>
                    <div style={{ display:"flex", gap:14, alignItems:"center" }}>
                      {a.nftMetadata && (
                        <img src={a.nftMetadata.imageUrl} alt=""
                          style={{ width:56, height:56, borderRadius:8, objectFit:"cover" }}/>
                      )}
                      {!a.nftMetadata && (
                        <div style={{ width:56, height:56, borderRadius:8, background:"linear-gradient(135deg,#1a1f35,#2a1f45)",
                          display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, textAlign:"center", color:"#64748b" }}>No<br/>Image</div>
                      )}
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:700, fontSize:14, marginBottom:2 }}>
                          {a.nftMetadata?.name || `Service Auction #${a.id}`}
                        </div>
                        <div style={{ fontSize:13, color:"#64748b" }}>
                          {a.currentBestBid > 0 ? `${formatAPT(a.currentBestBid)} APT` : "No bids"} •&nbsp;
                          {timeRemaining(a.endTime)}
                        </div>
                      </div>
                      <span className={`badge ${a.status==="active" ? "badge-active" : "badge-settled"}`}>
                        {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Recent Bids */}
            <div>
              <h2 style={{ fontSize:18, fontWeight:700, marginBottom:16 }}>Bidding History</h2>
              {myBids.length === 0 ? (
                <div className="card" style={{ padding:32, textAlign:"center", color:"#475569" }}>
                  No historical bids found.
                </div>
              ) : (
                myBids.slice(0,6).map((b,i) => (
                  <div key={i} className="card" style={{ padding:"14px 16px", marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div>
                        <div style={{ fontSize:14, fontWeight:600, marginBottom:2 }}>
                          Auction Bid Placement
                        </div>
                        <div style={{ fontSize:12, color:"#64748b" }}>
                          {new Date(b.timestamp*1000).toLocaleString()}
                        </div>
                      </div>
                      <div style={{ fontWeight:800, fontSize:16, color:"#6366f1" }}>
                        {formatAPT(b.amount)} APT
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Won Auctions */}
        {!loading && wonAuctions.length > 0 && (
          <div style={{ marginTop:32 }}>
            <h2 style={{ fontSize:18, fontWeight:700, marginBottom:16 }}>Resolved Auctions (Won)</h2>
            <div className="grid-3">
              {wonAuctions.map(a => (
                <div key={a.id} className="card" style={{ overflow:"hidden", cursor:"pointer" }}
                  onClick={() => navigate(`/auction/${a.id}`)}>
                  {a.nftMetadata && (
                    <img src={a.nftMetadata.imageUrl} alt="" style={{ width:"100%", aspectRatio:"1.5", objectFit:"cover" }}/>
                  )}
                  <div style={{ padding:14 }}>
                    <div style={{ fontWeight:700 }}>{a.nftMetadata?.name || `Service Auction #${a.id}`}</div>
                    <div style={{ color:"#10b981", fontWeight:600, marginTop:4 }}>
                      Winning Bid: {formatAPT(a.currentBestBid)} APT
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .dashboard-stats { grid-template-columns: repeat(2,1fr) !important; }
          .dashboard-cols  { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
