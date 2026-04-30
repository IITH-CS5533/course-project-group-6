import React, { useEffect, useState, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, TrendingUp, Shield, Zap, AlertTriangle, CheckCircle, Info } from "lucide-react";
import { timeRemaining, formatAPT, simulateBid, shortAddress, aptosClient, fetchAllAuctions, normalizeAddress } from "../hooks/useAptos";
import type { Auction, SimulationResult } from "../types";
import { WalletContext } from "../App";
import { OCTAS_PER_APT, CONTRACT_ADDRESS, STORE_OWNER_ADDRESS } from "../config";
import { useWallet } from "@aptos-labs/wallet-adapter-react";

function BidHistoryRow({ bidder, amount, timestamp, isTop }: { bidder:string; amount:number; timestamp:number; isTop:boolean }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
      padding:"12px 16px", borderRadius:8,
      background: isTop ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.02)",
      border: isTop ? "1px solid rgba(99,102,241,0.2)" : "1px solid transparent",
      marginBottom:6 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:"50%",
          background:"linear-gradient(135deg,#6366f1,#a78bfa)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:12, fontWeight:700, color:"white" }}>
          {bidder.slice(2,4).toUpperCase()}
        </div>
        <div>
          <div style={{ fontSize:14, fontWeight:600 }}>{shortAddress(bidder)}</div>
          <div style={{ fontSize:12, color:"#64748b" }}>{new Date(timestamp*1000).toLocaleTimeString()}</div>
        </div>
      </div>
      <div style={{ textAlign:"right" }}>
        <div style={{ fontSize:16, fontWeight:800, color: isTop ? "#6366f1" : "#f1f5f9" }}>
          {formatAPT(amount)} APT
        </div>
        {isTop && <div style={{ fontSize:11, color:"#10b981", fontWeight:600 }}>Highest Bid</div>}
      </div>
    </div>
  );
}

function SimulationPanel({ result, bidAmount, isForward }: { result: SimulationResult; bidAmount: number; isForward: boolean }) {
  return (
    <div style={{ border:"1px solid rgba(99,102,241,0.2)", borderRadius:10,
      padding:"18px", background:"rgba(99,102,241,0.05)", marginTop:12 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14, fontSize:14, fontWeight:700 }}>
        <Info size={15} color="#818cf8"/> Bid Simulation Preview
      </div>
      <div style={{ display:"grid", gap:8 }}>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:14 }}>
          <span style={{ color:"#94a3b8" }}>Outcome</span>
          <span style={{ fontWeight:700, color: result.willSucceed ? "#10b981" : "#ef4444" }}>
            {result.willSucceed ? "Will Succeed" : "Will Fail"}
          </span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:14 }}>
          <span style={{ color:"#94a3b8" }}>{isForward ? "Min Required" : "Max Allowed"}</span>
          <span style={{ fontWeight:600 }}>{formatAPT(result.minNextBid)} APT</span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:14 }}>
          <span style={{ color:"#94a3b8" }}>Bid Fee</span>
          <span style={{ fontWeight:600 }}>{formatAPT(result.bidFee)} APT</span>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", fontSize:14 }}>
          <span style={{ color:"#94a3b8" }}>Time Extended?</span>
          <span style={{ fontWeight:600, color: result.timeExtended ? "#f59e0b" : "#64748b" }}>
            {result.timeExtended ? `+5 min` : "No"}
          </span>
        </div>
        {result.reason && (
          <div className="alert alert-warning" style={{ marginTop:4 }}>
            <AlertTriangle size={14}/> {result.reason}
          </div>
        )}
        {result.willSucceed && (
          <div className="alert alert-success" style={{ marginTop:4 }}>
            <CheckCircle size={14}/> {isForward ? `Your bid of ${formatAPT(bidAmount)} APT will become the new highest bid.` : `Your offer of ${formatAPT(bidAmount)} APT will become the new lowest bid.`}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuctionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { connected, address, connect } = useContext(WalletContext);
  const { signAndSubmitTransaction } = useWallet();

  const [auction, setAuction] = useState<Auction | undefined>();
  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState("");
  const [bidInput, setBidInput] = useState("");
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [txStatus, setTxStatus] = useState<"idle"|"pending"|"success"|"error">("idle");
  const [txMsg, setTxMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"details"|"history">("details");

  const loadAuction = async () => {
    try {
      const all = await fetchAllAuctions();
      const match = all.find(a => a.id === Number(id));
      setAuction(match);
      if (match) setTimer(timeRemaining(match.endTime));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAuction();
  }, [id]);

  useEffect(() => {
    if (!auction) return;
    const intervalId = setInterval(() => setTimer(timeRemaining(auction.endTime)), 1000);
    return () => clearInterval(intervalId);
  }, [auction]);

  useEffect(() => {
    if (!auction || !bidInput) { setSimulation(null); return; }
    const val = parseFloat(bidInput) * OCTAS_PER_APT;
    if (!isNaN(val) && val > 0) {
      setSimulation(simulateBid(auction, val, address));
    }
  }, [bidInput, auction, address]);

  if (loading) return (
    <div className="page container" style={{ textAlign:"center", paddingTop:80 }}>
      <h2>Loading Auction...</h2>
    </div>
  );

  if (!auction) return (
    <div className="page container" style={{ textAlign:"center", paddingTop:80 }}>
      <h2>Auction Not Found</h2>
      <button className="btn btn-primary" style={{ marginTop:20 }} onClick={() => navigate("/")}>Back to Marketplace</button>
    </div>
  );

  const nft = auction.nftMetadata;
  const isActive = auction.status === "active";
  const isForward = auction.auctionType === "forward";
  const isUrgent = auction.endTime - Date.now()/1000 < 300;
  const isExpired = auction.endTime - Date.now()/1000 <= 0;
  
  const minBid = isForward 
    ? (auction.currentBestBid > 0 ? auction.currentBestBid * 1.05 : auction.startingPrice)
    : (auction.currentBestBid > 0 ? auction.currentBestBid * 0.95 : auction.startingPrice);

  async function handleBid() {
    if (!connected) { connect(); return; }
    // Prevent self-bidding
    if (address && auction.seller && normalizeAddress(address) === normalizeAddress(auction.seller)) {
      setTxStatus("error");
      setTxMsg("You cannot bid on your own auction.");
      return;
    }
    setTxStatus("pending");
    setTxMsg("Prompting wallet... Please approve the transaction.");
    
    try {
      const isForward = auction.auctionType === "forward";
      const amountInOctas = Math.floor(parseFloat(bidInput) * OCTAS_PER_APT);
      
      const payload = {
        data: {
          function: `${CONTRACT_ADDRESS}::auction::${isForward ? 'place_bid' : 'place_reverse_bid'}`,
          typeArguments: [],
          functionArguments: [STORE_OWNER_ADDRESS, auction.id, amountInOctas],
        }
      };

      const response = await signAndSubmitTransaction(payload);
      
      setTxMsg("Transaction submitted. Waiting for network confirmation...");
      await aptosClient.waitForTransaction({ transactionHash: response.hash });

      setTxStatus("success");
      setTxMsg(`Bid of ${bidInput} APT successfully recorded.`);
      setBidInput("");
      
      // Refresh auction data after success
      loadAuction();
    } catch (err: any) {
      console.error(err);
      setTxStatus("error");
      setTxMsg(err.message || "Failed to submit bid.");
    }
  }

  const sortedBids = [...auction.bidHistory].sort((a,b) => b.timestamp - a.timestamp);

  return (
    <div className="page">
      <div className="container">
        <button className="btn btn-secondary btn-sm" style={{ marginBottom:24 }} onClick={() => navigate(-1)}>
          <ArrowLeft size={14}/> Back
        </button>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 420px", gap:32 }}>
          {/* Left column */}
          <div>
            {/* NFT image */}
            {nft && (
              <div style={{ overflow:"hidden", marginBottom:24,
                border:"1px solid rgba(99,102,241,0.15)", boxShadow:"0 0 40px rgba(99,102,241,0.1)", borderRadius:14 }}>
                <img src={nft.imageUrl} alt={nft.name}
                  style={{ width:"100%", aspectRatio:"1", objectFit:"cover", display:"block" }}/>
              </div>
            )}
            {!nft && (
              <div style={{ borderRadius:14, background:"linear-gradient(135deg,#1a1f35,#2a1f45)",
                aspectRatio:"1", display:"flex", alignItems:"center", justifyContent:"center", color:"#94a3b8",
                fontSize:14, fontWeight: 600, marginBottom:24, border:"1px solid var(--border)" }}>Image Not Available</div>
            )}

            {/* Tabs */}
            <div className="tabs" style={{ marginBottom:20 }}>
              <button className={`tab ${activeTab==="details"?"active":""}`} onClick={() => setActiveTab("details")}>Details</button>
              <button className={`tab ${activeTab==="history"?"active":""}`} onClick={() => setActiveTab("history")}>
                Bid History ({auction.bidHistory.length})
              </button>
            </div>

            {activeTab === "details" && (
              <div className="animate-fade">
                {nft && (
                  <>
                    <h2 style={{ fontSize:24, fontWeight:800, marginBottom:8 }}>{nft.name}</h2>
                    <p style={{ color:"#94a3b8", marginBottom:20, lineHeight:1.6 }}>{nft.description}</p>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                      {[
                        { label:"Creator", value: shortAddress(nft.creator) },
                        { label:"Token ID", value: `#${nft.id}` },
                        { label:"Created", value: new Date(nft.createdAt*1000).toLocaleDateString() },
                        { label:"Status", value: nft.inAuction ? "In Auction" : "Available" },
                      ].map(row => (
                        <div key={row.label} className="card" style={{ padding:"14px 16px" }}>
                          <div style={{ fontSize:11, color:"#64748b", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>{row.label}</div>
                          <div style={{ fontSize:15, fontWeight:600 }}>{row.value}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {auction.auctionType === "reverse" && (
                  <>
                    <h2 style={{ fontSize:22, fontWeight:800, marginBottom:12 }}>Service Requirement</h2>
                    <div className="card" style={{ padding:20 }}>
                      <p style={{ lineHeight:1.7, color:"#cbd5e1" }}>{auction.requirementDescription}</p>
                    </div>
                    <div className="alert alert-info" style={{ marginTop:16 }}>
                      <Info size={14}/> This is a reverse auction. Place a lower bid to win the contract. The buyer has locked {formatAPT(auction.buyerBudget)} APT as payment.
                    </div>
                  </>
                )}

                {/* Anti-bot info */}
                {/* <div className="card" style={{ padding:20, marginTop:20 }}>
                  <h4 style={{ fontSize:15, fontWeight:700, marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
                    <Shield size={15} color="#6366f1"/> Network Protections Active
                  </h4>
                  <div style={{ display:"grid", gap:8, fontSize:14 }}>
                    {[
                      { icon:"Cooldown", label:"", val:"10s between bids" },
                      { icon:"Min Increment", label:"", val:"5% per bid" },
                      { icon:"Speed Bump", label:"", val:`${auction.extensionCount}/${5} extensions used` },
                      { icon:"Max Bids/User", label:"", val:"20 per auction" },
                    ].map(p => (
                      <div key={p.icon} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                        padding:"8px 12px", borderRadius:8, background:"rgba(255,255,255,0.03)" }}>
                        <span style={{ color:"#94a3b8" }}>{p.icon}</span>
                        <span style={{ fontWeight:600 }}>{p.val}</span>
                      </div>
                    ))}
                  </div>
                </div> */}
              </div>
            )}

            {activeTab === "history" && (
              <div className="animate-fade">
                {sortedBids.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"40px 0", color:"#475569" }}>No bids yet</div>
                ) : (
                  sortedBids.map((b,i) => (
                    <BidHistoryRow key={i} {...b} isTop={i===0}/>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Right column – bid panel */}
          <div>
            <div className="card" style={{ padding:24, position:"sticky", top:84 }}>
              {/* Status + timer */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                <div>
                  <span className={`badge ${isActive ? (isExpired ? "badge-expired" : isUrgent ? "badge-ending" : "badge-active") : "badge-settled"}`}>
                    {isActive ? (isExpired ? "Ended" : isUrgent ? "Ending Soon" : "Live") : "Settled"}
                  </span>
                  <span className={`badge badge-${auction.auctionType}`} style={{ marginLeft:6 }}>
                    {auction.auctionType === "forward" ? "Forward" : "Reverse"}
                  </span>
                </div>
                <div className={`countdown ${isUrgent ? "urgent" : ""}`} style={{ fontSize:22, fontWeight:800 }}>
                  {timer}
                </div>
              </div>

              <div className="divider"/>

              {/* Current bid */}
              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:12, color:"#64748b", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>
                  {auction.auctionType==="forward" ? "Current Highest Bid" : "Current Lowest Bid"}
                </div>
                <div style={{ fontSize:38, fontWeight:900, color:"#6366f1", fontFamily:"'Space Grotesk',sans-serif" }}>
                  {auction.currentBestBid > 0 ? `${formatAPT(auction.currentBestBid)} APT` : "No bids yet"}
                </div>
                {auction.bestBidder && auction.bestBidder !== "0x0" && (
                  <div style={{ fontSize:13, color:"#64748b", marginTop:4 }}>
                    by {shortAddress(auction.bestBidder)}
                  </div>
                )}
                <div style={{ fontSize:13, color:"#64748b", marginTop:4 }}>
                  Started at {formatAPT(auction.startingPrice)} APT
                </div>
              </div>

              <div className="divider"/>

              {/* Bid form */}
              {isActive && !isExpired ? (
                <>
                  {/* Self-bid guard */}
                  {connected && address && auction.seller &&
                   normalizeAddress(address) === normalizeAddress(auction.seller) ? (
                    <div className="alert alert-warning" style={{ margin: "16px 0" }}>
                      <AlertTriangle size={14}/> You are the seller of this auction and cannot place a bid.
                    </div>
                  ) : (
                    <>
                  <div className="input-group" style={{ marginBottom:12 }}>
                    <label>{isForward ? "Your Bid (APT)" : "Your Offer (APT)"}</label>
                    <input type="number" className="input" step="0.01" min="0"
                      placeholder={isForward ? `Min ${(minBid/OCTAS_PER_APT).toFixed(4)} APT` : `Max ${(minBid/OCTAS_PER_APT).toFixed(4)} APT`}
                      value={bidInput} onChange={e => setBidInput(e.target.value)}/>
                    <div style={{ fontSize:12, color:"#64748b", marginTop:4 }}>
                      + 0.01 APT bid fee • Cooldown: 10s
                    </div>
                  </div>

                  {simulation && <SimulationPanel result={simulation} bidAmount={parseFloat(bidInput)*OCTAS_PER_APT} isForward={isForward}/>}

                  {txStatus === "success" && (
                    <div className="alert alert-success" style={{ margin:"12px 0" }}>
                      <CheckCircle size={14}/> {txMsg}
                    </div>
                  )}
                  {txStatus === "error" && (
                    <div className="alert alert-error" style={{ margin:"12px 0" }}>
                      <AlertTriangle size={14}/> {txMsg}
                    </div>
                  )}

                  <button className="btn btn-primary btn-lg" style={{ width:"100%", marginTop:16, justifyContent:"center" }}
                    disabled={txStatus==="pending" || (!bidInput)}
                    onClick={handleBid}>
                    {txStatus==="pending" ? "Processing..." : connected ? (auction.auctionType==="forward" ? "Place Bid" : "Place Offer") : "Connect Wallet to Bid"}
                  </button>

                  {!connected && (
                    <div className="alert alert-info" style={{ marginTop:12 }}>
                      <Info size={14}/> Connect your Aptos wallet to place a bid.
                    </div>
                  )}
                    </>
                  )}
                </>
              ) : auction.status === "settled" ? (
                <div style={{ textAlign:"center", padding:"24px 0" }}>
                  <div style={{ fontSize:40, marginBottom:8 }}>🏆</div>
                  <h3 style={{ fontWeight:700, marginBottom:8, color:"#f1f5f9" }}>Auction Settled</h3>
                  <p style={{ color:"#64748b", fontSize:14, lineHeight:1.6 }}>
                    {auction.bestBidder && auction.bestBidder !== "0x0" ? (
                      <>
                        Winner: <span style={{ color:"#6366f1", fontWeight:600 }}>{shortAddress(auction.bestBidder)}</span><br/>
                        Winning bid: <span style={{ color:"#10b981", fontWeight:700 }}>{formatAPT(auction.currentBestBid)} APT</span>
                      </>
                    ) : (
                      "No bids placed. NFT returned to seller."
                    )}
                  </p>
                </div>
              ) : (
                <div style={{ textAlign:"center", padding:"24px 0", color:"#64748b" }}>
                  <p>This auction has expired and is pending settlement.</p>
                </div>
              )}

              <div className="divider"/>

              {/* Quick stats */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, fontSize:13 }}>
                {[
                  { label:"Total Bids", val:auction.bidHistory.length },
                  { label:"Extensions", val:`${auction.extensionCount}/5` },
                  { label:"Auction ID", val:`#${auction.id}` },
                  { label:"End Time", val:new Date(auction.endTime*1000).toLocaleString() },
                ].map(s => (
                  <div key={s.label} style={{ padding:"10px 12px", borderRadius:8, background:"rgba(255,255,255,0.03)" }}>
                    <div style={{ color:"#64748b", fontSize:11, fontWeight:600, marginBottom:3, textTransform:"uppercase" }}>{s.label}</div>
                    <div style={{ fontWeight:600 }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .auction-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
