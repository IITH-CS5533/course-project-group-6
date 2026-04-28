import React, { useState, useEffect, useCallback } from "react";
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from "react-router-dom";
import { Zap, LayoutGrid, PlusCircle, User, Gavel, Menu, X, Wallet } from "lucide-react";
import "./index.css";

// Pages
import MarketplacePage from "./pages/MarketplacePage";
import MintNFTPage from "./pages/MintNFTPage";
import DashboardPage from "./pages/DashboardPage";
import MyNFTsPage from "./pages/MyNFTsPage";

// ── Mock wallet context (replace with @aptos-labs/wallet-adapter-react)
export const WalletContext = React.createContext<{
  connected: boolean;
  address: string;
  connect: () => void;
  disconnect: () => void;
}>({ connected: false, address: "", connect: () => {}, disconnect: () => {} });

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { connected, address, connect, disconnect } = React.useContext(WalletContext);

  const links = [
    { to: "/", label: "Marketplace", icon: <LayoutGrid size={16}/> },
    { to: "/my-nfts", label: "My NFTs", icon: <Gavel size={16}/> },
    { to: "/mint", label: "Mint NFT", icon: <Zap size={16}/> },
    { to: "/dashboard", label: "Dashboard", icon: <User size={16}/> },
  ];

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 100,
      background: "rgba(8,11,20,0.85)",
      backdropFilter: "blur(20px)",
      borderBottom: "1px solid rgba(99,102,241,0.15)",
    }}>
      <div className="container" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:64 }}>
        {/* Logo */}
        <NavLink to="/" style={{ display:"flex", alignItems:"center", gap:10, textDecoration:"none" }}>
          <div style={{
            width:34, height:34, borderRadius:10,
            background:"linear-gradient(135deg,#6366f1,#a78bfa)",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <Gavel size={18} color="white"/>
          </div>
          <span style={{ fontFamily:"'Space Grotesk',sans-serif", fontWeight:700, fontSize:18, color:"#f1f5f9" }}>
            AuctionX
          </span>
        </NavLink>

        {/* Desktop nav */}
        <div style={{ display:"flex", gap:4, alignItems:"center" }} className="desktop-nav">
          {links.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to==="/"}
              style={({ isActive }) => ({
                display:"flex", alignItems:"center", gap:6,
                padding:"7px 14px", borderRadius:8, textDecoration:"none",
                fontSize:14, fontWeight:500,
                color: isActive ? "#f1f5f9" : "#94a3b8",
                background: isActive ? "rgba(99,102,241,0.15)" : "transparent",
                transition:"all 0.2s",
              })}
            >
              {l.icon}{l.label}
            </NavLink>
          ))}
        </div>

        {/* Wallet */}
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {connected ? (
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{
                padding:"7px 14px", borderRadius:8, fontSize:13, fontWeight:600,
                background:"rgba(16,185,129,0.1)", color:"#10b981",
                border:"1px solid rgba(16,185,129,0.2)",
              }}>
                {address.slice(0,6)}…{address.slice(-4)}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={disconnect}>Disconnect</button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={connect}>
              <Wallet size={15}/> Connect Wallet
            </button>
          )}
          <button style={{ display:"none", background:"none", border:"none", color:"#94a3b8", cursor:"pointer" }}
            className="hamburger" onClick={() => setMenuOpen(o => !o)}>
            {menuOpen ? <X size={22}/> : <Menu size={22}/>}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          background:"var(--bg-secondary)", borderTop:"1px solid var(--border)",
          padding:"12px 24px 16px",
        }}>
          {links.map(l => (
            <NavLink key={l.to} to={l.to} end={l.to==="/"}
              onClick={() => setMenuOpen(false)}
              style={({ isActive }) => ({
                display:"flex", alignItems:"center", gap:8, padding:"10px 0",
                textDecoration:"none", fontSize:15, fontWeight:500,
                color: isActive ? "#f1f5f9" : "#94a3b8",
                borderBottom:"1px solid var(--border)",
              })}
            >
              {l.icon}{l.label}
            </NavLink>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width:768px) {
          .desktop-nav { display:none !important; }
          .hamburger { display:flex !important; }
        }
      `}</style>
    </nav>
  );
}

import { AptosWalletAdapterProvider, useWallet } from "@aptos-labs/wallet-adapter-react";

function AppContent() {
  const { connected, account, connect: aptosConnect, disconnect, wallets } = useWallet();
  // In Aptos ts-sdk, account.address can sometimes be an object. We must call toString() safely.
  const address = account?.address ? account.address.toString() : "";

  // Connects securely by finding the Petra wallet in the detected installed wallets
  const connect = useCallback(() => {
    const petra = wallets?.find(w => w.name.toLowerCase().includes("petra"));
    if (petra) {
      aptosConnect(petra.name);
    } else if (wallets && wallets.length > 0) {
      aptosConnect(wallets[0].name); // Fallback to whatever first wallet is detected
    } else {
      aptosConnect("Petra" as any);
    }
  }, [aptosConnect, wallets]);

  return (
    <WalletContext.Provider value={{ connected, address, connect, disconnect }}>
      <BrowserRouter>
        <Navbar/>
        <Routes>
          <Route path="/" element={<MarketplacePage/>}/>
          <Route path="/mint" element={<MintNFTPage/>}/>
          <Route path="/dashboard" element={<DashboardPage/>}/>
          <Route path="/my-nfts" element={<MyNFTsPage/>}/>
        </Routes>
      </BrowserRouter>
    </WalletContext.Provider>
  );
}

export default function App() {
  return (
    <AptosWalletAdapterProvider autoConnect={true}>
      <AppContent />
    </AptosWalletAdapterProvider>
  );
}
