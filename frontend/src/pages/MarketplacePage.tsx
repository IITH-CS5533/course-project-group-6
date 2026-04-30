import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { timeRemaining, formatAPT, fetchAllAuctions, settleForwardAuction, settleReverseAuction } from "../hooks/useAptos";
import type { Auction, FilterStatus, FilterType, SortOption } from "../types";
import { WalletContext } from "../App";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { normalizeAddress } from "../hooks/useAptos";

function AuctionCard({ auction, onSettle }: { auction: Auction, onSettle: () => void }) {
  const navigate = useNavigate();
    const { connected, address, connect } = useContext(WalletContext);
    const { signAndSubmitTransaction } = useWallet();
    const [timer, setTimer] = useState(timeRemaining(auction.endTime));
    const [isSettling, setIsSettling] = useState(false);
    const isUrgent = auction.endTime - Date.now()/1000 < 300;
    const isExpired = auction.endTime - Date.now()/1000 <= 0;
    const isCreator = address && normalizeAddress(address) === normalizeAddress(auction.seller);

    useEffect(() => {
      const id = setInterval(() => setTimer(timeRemaining(auction.endTime)), 1000);
      return () => clearInterval(id);
    }, [auction.endTime]);

    const handleSettle = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!connected) { connect(); return; }
      if (!signAndSubmitTransaction) return;
      setIsSettling(true);
      try {
        if (auction.auctionType === "forward") {
          await settleForwardAuction(signAndSubmitTransaction, auction.id);
        } else {
          await settleReverseAuction(signAndSubmitTransaction, auction.id);
        }
      onSettle();
    } catch (err) {
      console.error("Settlement failed", err);
    } finally {
      setIsSettling(false);
    }
  };

  const nft = auction.nftMetadata;

  return (
    <div className="card animate-fade-in" style={{ overflow:"hidden", cursor:"pointer", transition: "transform 0.2s" }}
      onClick={() => navigate(`/auction/${auction.id}`)}
      onMouseOver={e => (e.currentTarget.style.transform="translateY(-4px)")}
      onMouseOut={e => (e.currentTarget.style.transform="translateY(0)")}>
      {/* Image */}
      <div style={{ position:"relative", paddingTop:"75%", overflow:"hidden", background:"#1a2235" }}>
        {nft?.imageUrl ? (
          <img src={nft.imageUrl} alt={nft.name}
            style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }}
          />
        ) : (
          <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center",
            background:"linear-gradient(135deg,#1a1f35,#2a1f45)", color: "#94a3b8", fontSize:14, fontWeight:600 }}>
            Image Not Available
          </div>
        )}
        {/* Badges overlay */}
        <div style={{ position:"absolute", top:12, left:12, display:"flex", gap:6 }}>
          <span className={`badge badge-${auction.auctionType}`}>
            {auction.auctionType === "forward" ? "Forward" : "Reverse"}
          </span>
          {auction.status === "active" && (
            <span className={`badge ${isExpired ? "badge-expired" : isUrgent ? "badge-ending" : "badge-active"}`}>
              {isExpired ? "Ended" : isUrgent ? "Ending Soon" : "Live"}
            </span>
          )}
          {auction.status === "settled" && <span className="badge badge-settled">Settled</span>}
        </div>
        {auction.extensionCount > 0 && (
          <div style={{ position:"absolute", top:12, right:12 }}>
            <span className="badge" style={{ background:"rgba(245,158,11,0.2)", color:"#f59e0b", border:"1px solid rgba(245,158,11,0.3)" }}>
              +{auction.extensionCount} extensions
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding:"18px" }}>
        {auction.auctionType === "forward" && nft && (
          <h3 style={{ fontSize:16, fontWeight:700, marginBottom:4, color:"#f1f5f9" }}>{nft.name}</h3>
        )}
        {auction.auctionType === "reverse" && (
          <h3 style={{ fontSize:15, fontWeight:700, marginBottom:4, color:"#f1f5f9", lineHeight:1.4 }}>
            {auction.requirementDescription.slice(0,60)}…
          </h3>
        )}
        <p style={{ fontSize:13, color:"#64748b", marginBottom:14 }}>
          {auction.status === "settled" ? "Seller" : "Seller"}: {String(auction.seller).slice(0,8)}…
        </p>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
          <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:8, padding:"10px 12px" }}>
            <div style={{ fontSize:11, color:"#64748b", fontWeight:600, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>
              {auction.status === "settled" ? "Final Price" : auction.auctionType === "forward" ? "Current Bid" : "Lowest Bid"}
            </div>
            <div style={{ fontSize:18, fontWeight:800, color: auction.status === "settled" ? "#10b981" : "#6366f1", fontFamily:"'Space Grotesk',sans-serif" }}>
              {auction.currentBestBid > 0 ? `${formatAPT(auction.currentBestBid)} APT` : "No bids"}
            </div>
          </div>
          <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:8, padding:"10px 12px" }}>
            <div style={{ fontSize:11, color:"#64748b", fontWeight:600, marginBottom:4, textTransform:"uppercase", letterSpacing:"0.05em" }}>
              {auction.status === "settled" ? "Status" : "Time Left"}
            </div>
            <div className={`countdown ${isUrgent ? "urgent" : ""}`} style={{ fontSize:18, fontWeight:800, fontFamily:"'Space Grotesk',sans-serif", color: auction.status === "settled" ? "#10b981" : undefined }}>
              {auction.status === "settled" ? "Settled ✓" : timer}
            </div>
          </div>
        </div>

        {/* Action Button */}
        {auction.status === "active" && isExpired && isCreator ? (
          <button 
            className="btn btn-primary" 
            style={{ width: "100%", marginTop: 8, height: 40, fontSize: 14 }}
            onClick={handleSettle}
            disabled={isSettling}
          >
            {isSettling ? "Settling..." : "Settle Auction"}
          </button>
        ) : (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:13, color:"#64748b", marginTop: 8 }}>
            <span style={{ display:"flex", alignItems:"center", gap:4 }}>
              Total Bids: {auction.bidHistory.length}
            </span>
            <span style={{ display:"flex", alignItems:"center", gap:4 }}>
              Starting: {formatAPT(auction.startingPrice)} APT
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortOption>("endTime");
  const { connected } = useContext(WalletContext);

  const loadData = () => {
    setLoading(true);
    fetchAllAuctions().then((data) => {
      setAuctions(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const active = auctions.filter(a => a.status === "active").length;
  const totalVolume = auctions.reduce((s, a) => s + a.currentBestBid, 0);

  const filtered = auctions
    .filter(a => filterStatus === "all" || a.status === filterStatus)
    .filter(a => filterType === "all" || a.auctionType === filterType)
    .filter(a => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        a.nftMetadata?.name.toLowerCase().includes(q) ||
        a.requirementDescription.toLowerCase().includes(q) ||
        a.seller.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sort === "endTime") return a.endTime - b.endTime;
      if (sort === "currentBid") return b.currentBestBid - a.currentBestBid;
      if (sort === "startPrice") return a.startingPrice - b.startingPrice;
      return b.id - a.id;
    });

  return (
    <div className="page animate-fade-in">
      <div className="container">
        {/* Hero */}
        <div style={{ textAlign:"center", marginBottom:48 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, padding:"6px 16px",
            borderRadius:20, background:"rgba(99,102,241,0.1)", border:"1px solid rgba(99,102,241,0.2)",
            fontSize:13, fontWeight:600, color:"#818cf8", marginBottom:20 }}>
            Active on Aptos Blockchain
          </div>
          <h1 style={{ fontSize:"clamp(32px,5vw,56px)", fontWeight:900, lineHeight:1.1, marginBottom:16 }}>
            Decentralized<br/>
            <span className="gradient-text">Auction Marketplace</span>
          </h1>
          <p style={{ fontSize:18, color:"#94a3b8", maxWidth:520, margin:"0 auto" }}>
            Secure on-chain settlement, configurable parameters, and formal bidding models.
          </p>
        </div>

        {/* Stats bar */}
        <div className="grid-3" style={{ marginBottom:40, gap:16 }}>
          {[
            { label:"Active Auctions", value: loading ? "-" : active },
            { label:"Total Auctions", value: loading ? "-" : auctions.length },
            { label:"Total Volume", value:`${loading ? "-" : formatAPT(totalVolume)} APT` },
          ].map(s => (
            <div key={s.label} className="card stat-card" style={{ padding:"20px 24px" }}>
              <div className="stat-value" style={{ fontSize:26, marginBottom: 8 }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:12, marginBottom:28, alignItems:"center" }}>
          <div style={{ flex:"1 1 240px", position:"relative" }}>
            <input className="input" placeholder="Search auctions or NFTs…"
              style={{ paddingLeft:14 }} value={search} onChange={e => setSearch(e.target.value)}/>
          </div>

          <div className="tabs">
            {(["all","active","settled"] as FilterStatus[]).map(s => (
              <button key={s} className={`tab ${filterStatus===s?"active":""}`} onClick={() => setFilterStatus(s)}>
                {s.charAt(0).toUpperCase()+s.slice(1)}
              </button>
            ))}
          </div>

          <div className="tabs">
            {(["all","forward","reverse"] as FilterType[]).map(t => (
              <button key={t} className={`tab ${filterType===t?"active":""}`} onClick={() => setFilterType(t)}>
                {t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>

          <select className="input" style={{ width:"auto", flex:"0 0 auto" }}
            value={sort} onChange={e => setSort(e.target.value as SortOption)}>
            <option value="endTime">Ending Soon</option>
            <option value="currentBid">Highest Bid</option>
            <option value="startPrice">Starting Price</option>
            <option value="newest">Newest</option>
          </select>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign:"center", padding:"80px 0" }}>
            <div className="spinner" style={{ margin: "0 auto 20px" }}></div>
            <h2>Fetching Marketplace Data...</h2>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:"center", padding:"80px 0", color:"#475569" }}>
            <h3 style={{ fontSize:20, marginBottom:8 }}>No matches found</h3>
            <p>Adjust your filter parameters.</p>
          </div>
        ) : (
          <div className="grid-3">{filtered.map(a => <AuctionCard key={a.id} auction={a} onSettle={loadData}/>)}</div>
        )}
      </div>
    </div>
  );
}
