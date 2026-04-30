import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WalletContext } from "../App";
import {
  formatAPT,
  shortAddress,
  timeRemaining,
  fetchAllAuctions,
  fetchUserNFTs,
  normalizeAddress,
} from "../hooks/useAptos";
import type { Auction, NFTMetadata } from "../types";
import { Gavel, Trophy, TrendingUp, Image, PlusCircle, ExternalLink, Clock, CheckCircle, XCircle } from "lucide-react";

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: React.ReactNode }) {
  return (
    <div className="card" style={{ padding: "22px 24px", display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{
        width: 48, height: 48, borderRadius: 12,
        background: `${color}20`, border: `1px solid ${color}40`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        {React.cloneElement(icon as React.ReactElement, { size: 22, color })}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, fontFamily: "'Space Grotesk',sans-serif", color }}>{value}</div>
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function AuctionRow({ auction, myAddr }: { auction: Auction; myAddr: string }) {
  const navigate = useNavigate();
  const isExpired = auction.endTime - Date.now() / 1000 <= 0;
  const statusLabel =
    auction.status === "settled" ? "Settled" :
    auction.status === "cancelled" ? "Cancelled" :
    isExpired ? "Ended" : "Live";
  const statusClass =
    auction.status === "settled" ? "badge-settled" :
    auction.status === "cancelled" ? "badge-settled" :
    isExpired ? "badge-expired" : "badge-active";

  return (
    <div
      className="card"
      style={{ padding: "14px 16px", marginBottom: 10, cursor: "pointer", transition: "transform 0.15s" }}
      onClick={() => navigate(`/auction/${auction.id}`)}
      onMouseOver={e => (e.currentTarget.style.transform = "translateY(-2px)")}
      onMouseOut={e => (e.currentTarget.style.transform = "translateY(0)")}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        {/* Thumbnail */}
        {auction.nftMetadata?.imageUrl ? (
          <img
            src={auction.nftMetadata.imageUrl}
            alt=""
            style={{ width: 52, height: 52, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <div style={{
            width: 52, height: 52, borderRadius: 8, flexShrink: 0,
            background: "linear-gradient(135deg,#1a1f35,#2a1f45)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Gavel size={18} color="#475569" />
          </div>
        )}

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {auction.nftMetadata?.name || (auction.auctionType === "reverse" ? auction.requirementDescription.slice(0, 40) : `Auction #${auction.id}`)}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span className={`badge badge-${auction.auctionType}`} style={{ fontSize: 10, padding: "1px 7px" }}>
                {auction.auctionType === "forward" ? "Forward" : "Reverse"}
              </span>
            </span>
            <span>{auction.currentBestBid > 0 ? `${formatAPT(auction.currentBestBid)} APT` : "No bids"}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <Clock size={11} />
              {auction.status === "settled" ? "Settled" : timeRemaining(auction.endTime)}
            </span>
          </div>
        </div>

        {/* Badge */}
        <span className={`badge ${statusClass}`} style={{ flexShrink: 0, fontSize: 11 }}>
          {statusLabel}
        </span>
        <ExternalLink size={14} color="#475569" />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { connected, address, connect } = useContext(WalletContext);
  const navigate = useNavigate();

  const [nfts, setNfts] = useState<NFTMetadata[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (connected && address) {
      setLoading(true);
      Promise.all([fetchUserNFTs(address), fetchAllAuctions()]).then(
        ([nftData, auctionData]) => {
          setNfts(nftData);
          setAuctions(auctionData);
          setLoading(false);
        }
      );
    } else {
      setNfts([]);
      setAuctions([]);
      setLoading(false);
    }
  }, [connected, address]);

  if (!connected)
    return (
      <div className="page">
        <div className="container" style={{ textAlign: "center", paddingTop: 80 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 24, margin: "0 auto 24px",
            background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Gavel size={36} color="#6366f1" />
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>User Dashboard</h2>
          <p style={{ color: "#94a3b8", marginBottom: 28 }}>
            Connect your wallet to view your auction activity, NFTs, and bidding history.
          </p>
          <button className="btn btn-primary btn-lg" onClick={connect}>
            Connect Wallet
          </button>
        </div>
      </div>
    );

  // ── Normalised comparisons ────────────────────────────────────────────────
  const myNorm = normalizeAddress(address);

  const myAuctions = auctions.filter(
    (a) => normalizeAddress(a.seller) === myNorm
  );
  const activeAuctions  = myAuctions.filter(a => a.status === "active" && a.endTime - Date.now()/1000 > 0);
  const endedAuctions   = myAuctions.filter(a => a.status !== "active" || a.endTime - Date.now()/1000 <= 0);

  const wonAuctions = auctions.filter(
    (a) => a.status === "settled" && normalizeAddress(a.bestBidder) === myNorm
  );

  const myBids = auctions
    .flatMap((a) =>
      a.bidHistory
        .filter((b) => normalizeAddress(b.bidder) === myNorm)
        .map((b) => ({ ...b, auctionId: a.id, auctionName: a.nftMetadata?.name || `Auction #${a.id}` }))
    )
    .sort((a, b) => b.timestamp - a.timestamp);

  const totalVolumeBid = myBids.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="page">
      <div className="container">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 4 }}>
              User <span className="gradient-text">Dashboard</span>
            </h1>
            <p style={{ fontSize: 14, color: "#64748b" }}>
              {shortAddress(address || "")} • {loading ? "Loading…" : `${myAuctions.length} auctions · ${nfts.length} NFTs`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => navigate("/mint")}>
              <Image size={14} /> Mint NFT
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => navigate("/create-auction")}>
              <PlusCircle size={14} /> Create Auction
            </button>
          </div>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 36 }}>
          <StatCard label="NFTs Owned"        value={loading ? "—" : nfts.length}         color="#6366f1" icon={<Image />} />
          <StatCard label="Auctions Created"  value={loading ? "—" : myAuctions.length}   color="#10b981" icon={<Gavel />} />
          <StatCard label="Auctions Won"      value={loading ? "—" : wonAuctions.length}  color="#f59e0b" icon={<Trophy />} />
          <StatCard label="Volume Bid"        value={loading ? "—" : `${formatAPT(totalVolumeBid)} APT`} color="#ec4899" icon={<TrendingUp />} />
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div className="spinner" style={{ margin: "0 auto 20px" }} />
            <h3 style={{ color: "#64748b" }}>Loading your activity…</h3>
          </div>
        ) : (
          <>
            {/* ── My Auctions + Bids ──────────────────────────────────── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28, marginBottom: 32 }}>

              {/* Created Auctions */}
              <div>
                <div className="section-header" style={{ marginBottom: 16 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                    Created Auctions
                    <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 500, color: "#64748b" }}>
                      ({myAuctions.length})
                    </span>
                  </h2>
                </div>

                {myAuctions.length === 0 ? (
                  <div className="card" style={{ padding: 32, textAlign: "center", color: "#475569" }}>
                    <Gavel size={32} color="#334155" style={{ margin: "0 auto 12px" }} />
                    <p style={{ marginBottom: 16 }}>You haven't created any auctions yet.</p>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate("/create-auction")}>
                      Create Your First Auction
                    </button>
                  </div>
                ) : (
                  <>
                    {activeAuctions.length > 0 && (
                      <>
                        <p style={{ fontSize: 12, color: "#10b981", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                          ● Live ({activeAuctions.length})
                        </p>
                        {activeAuctions.map(a => <AuctionRow key={a.id} auction={a} myAddr={address} />)}
                      </>
                    )}
                    {endedAuctions.length > 0 && (
                      <>
                        <p style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", margin: "16px 0 8px" }}>
                          Ended / Settled ({endedAuctions.length})
                        </p>
                        {endedAuctions.map(a => <AuctionRow key={a.id} auction={a} myAddr={address} />)}
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Bidding History */}
              <div>
                <div className="section-header" style={{ marginBottom: 16 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>
                    Bid History
                    <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 500, color: "#64748b" }}>
                      ({myBids.length})
                    </span>
                  </h2>
                </div>

                {myBids.length === 0 ? (
                  <div className="card" style={{ padding: 32, textAlign: "center", color: "#475569" }}>
                    <TrendingUp size={32} color="#334155" style={{ margin: "0 auto 12px" }} />
                    <p>You haven't placed any bids yet.</p>
                  </div>
                ) : (
                  myBids.slice(0, 8).map((b, i) => (
                    <div
                      key={i}
                      className="card"
                      style={{ padding: "12px 16px", marginBottom: 10, cursor: "pointer", transition: "transform 0.15s" }}
                      onClick={() => navigate(`/auction/${b.auctionId}`)}
                      onMouseOver={e => (e.currentTarget.style.transform = "translateY(-2px)")}
                      onMouseOut={e => (e.currentTarget.style.transform = "translateY(0)")}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9", marginBottom: 2 }}>
                            {b.auctionName}
                          </div>
                          <div style={{ fontSize: 11, color: "#64748b" }}>
                            {new Date(b.timestamp * 1000).toLocaleString()}
                          </div>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: "#6366f1" }}>
                          {formatAPT(b.amount)} APT
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* ── Won Auctions ─────────────────────────────────────────── */}
            {wonAuctions.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  <Trophy size={18} color="#f59e0b" /> Auctions Won ({wonAuctions.length})
                </h2>
                <div className="grid-3">
                  {wonAuctions.map(a => (
                    <div
                      key={a.id}
                      className="card"
                      style={{ overflow: "hidden", cursor: "pointer" }}
                      onClick={() => navigate(`/auction/${a.id}`)}
                    >
                      {a.nftMetadata?.imageUrl ? (
                        <img src={a.nftMetadata.imageUrl} alt="" style={{ width: "100%", aspectRatio: "1.5", objectFit: "cover", display: "block" }} />
                      ) : (
                        <div style={{ width: "100%", aspectRatio: "1.5", background: "linear-gradient(135deg,#1a1f35,#2a1f45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <CheckCircle size={32} color="#10b981" />
                        </div>
                      )}
                      <div style={{ padding: 14 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "#f1f5f9" }}>
                          {a.nftMetadata?.name || `Service Auction #${a.id}`}
                        </div>
                        <div style={{ color: "#10b981", fontWeight: 700, fontSize: 13 }}>
                          Won for {formatAPT(a.currentBestBid)} APT
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── NFT Gallery ──────────────────────────────────────────── */}
            <div>
              <div className="section-header" style={{ marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  <Image size={18} color="#6366f1" /> My NFTs ({nfts.length})
                </h2>
                <button className="btn btn-secondary btn-sm" onClick={() => navigate("/my-nfts")}>
                  View All
                </button>
              </div>

              {nfts.length === 0 ? (
                <div className="card" style={{ padding: 32, textAlign: "center", color: "#475569" }}>
                  <Image size={32} color="#334155" style={{ margin: "0 auto 12px" }} />
                  <p style={{ marginBottom: 16 }}>No NFTs in your wallet yet.</p>
                  <button className="btn btn-primary btn-sm" onClick={() => navigate("/mint")}>Mint an NFT</button>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 14 }}>
                  {nfts.slice(0, 8).map(nft => (
                    <div key={nft.id} className="card" style={{ overflow: "hidden", cursor: "pointer" }}
                      onClick={() => navigate("/my-nfts")}>
                      <div style={{ position: "relative", paddingTop: "100%", background: "#1a2235" }}>
                        {nft.imageUrl ? (
                          <img src={nft.imageUrl} alt={nft.name}
                            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <XCircle size={24} color="#334155" />
                          </div>
                        )}
                        {nft.inAuction && (
                          <div style={{ position: "absolute", top: 6, left: 6 }}>
                            <span className="badge badge-ending" style={{ fontSize: 9, padding: "1px 5px" }}>In Auction</span>
                          </div>
                        )}
                      </div>
                      <div style={{ padding: "8px 10px" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {nft.name}
                        </div>
                        <div style={{ fontSize: 10, color: "#64748b" }}>#{nft.id}</div>
                      </div>
                    </div>
                  ))}
                  {nfts.length > 8 && (
                    <div className="card" style={{ overflow: "hidden", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", minHeight: 140 }}
                      onClick={() => navigate("/my-nfts")}>
                      <div style={{ textAlign: "center", color: "#6366f1" }}>
                        <div style={{ fontSize: 22, fontWeight: 800 }}>+{nfts.length - 8}</div>
                        <div style={{ fontSize: 12 }}>more</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        @media (max-width: 900px) {
          .dashboard-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          .dashboard-stats { grid-template-columns: repeat(2,1fr) !important; }
        }
        .spinner {
          width: 36px; height: 36px;
          border: 3px solid rgba(99,102,241,0.2);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(12px);} to {opacity:1; transform:translateY(0);} }
        .animate-fade-in { animation: fadeIn 0.4s ease forwards; }
      `}</style>
    </div>
  );
}
