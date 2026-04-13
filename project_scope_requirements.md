# Project Scope: Fair Auction Marketplace on Aptos

## 1. Project Overview
This project implements a fair and secure decentralized auction system on the Aptos blockchain using the Move programming language.

The system is designed to:
- Prevent last-second bidding advantages (sniping)
- Reduce bot-based manipulation
- Ensure transparency and trust through on-chain logic

---

## 2. Problem Statement
Traditional and existing blockchain auctions suffer from:

- Sniping Attacks: Bots place bids in the last milliseconds, leaving no time for real users to respond
- Bot Spamming: Automated systems repeatedly place bids to manipulate prices
- Unfair Incrementing: Minimal bid increases allow bots to dominate auctions
- Honeypot Risks: Users cannot verify outcomes before interacting with contracts

---

## 3. Proposed Solution
We implement a fair auction protocol with:

- A Digital Vault (Resource Account) to securely hold assets and bids
- An IEX-inspired Speed Bump to extend auctions on last-minute bids
- Anti-bot protections to limit spam and unfair automation
- Transaction Simulation to preview outcomes before execution

Additionally:

- Auctioned assets are represented as **NFTs (Non-Fungible Tokens)**  
- We maintain an NFT collection within our smart contract  
- Users can create NFTs through our platform, which are then stored in their account
- NFTs are stored on-chain as Move resources, with metadata (name, description, image URL)  

---

## 4. Core Features

### 🔹 Auction Creation
Seller creates auction with:
- Starting price
- Auction duration (with an enforced upper bound to prevent misuse)
- Minimum bid increment (%)
- Maximum extension limit (hard cap)

---

### 🔹 Bidding System
- Users place bids using fungible tokens
- Tokens are locked in the vault during the auction  
- Highest valid bid is tracked on-chain  

**Refund Logic:**
- When a new higher bid is placed:
  - The previous highest bidder is **immediately refunded**  
  - Prevents unnecessary locking of funds  

**Bid Update Logic:**
- If a user increases their bid (e.g., from 10 → 20):
  - Only the latest bid (20) is considered active  
- If the user is not the previously highest bidder 
 - This means the bidder was outbid previously and the older amount was already refunded, so the entire new amount is locked.
- If the user is already the highest bidder:
  - Only the additional amount is locked  
- Decreasing a bid is **not allowed**  
- No bid cancellation.



---

### 🔹 Speed Bump Logic
- A **sniping attack** occurs when a bidder places a bid at the last moment, leaving no time for others to respond  

**Example Scenario:**
- Auction ends at 10:00:00  
- User A bids 10 tokens at 09:59:58  
- *A bot detects this and bids 11 tokens at 09:59:59*
- Auction ends → User A has no chance to react  

**Solution (Speed Bump):**
- If a **new bid surpassing the current highest bid** is placed within the last N seconds:
  - Auction end time is extended by N seconds  
- Extensions are limited by a **hard cap**  

**Effect:**
- Late bids no longer immediately end the auction  
- Other users get time to respond  
- Reduces unfair timing advantage  

---

### 🔹 Vault Security
- Assets (NFTs) and tokens are stored in a resource account (digital vault)  
- Only smart contract logic controls fund movement  
- Prevents unauthorized withdrawals  

---

### 🔹 Settlement Logic
- After auction ends:
  - Highest bidder receives NFT  
  - Seller receives tokens  
  - No funds remain locked  

---

## 5. Anti-Bot Protection Features

### 🔹 Minimum Bid Increment
- Each new bid must exceed current bid by a percentage (e.g., 5%)  
- Prevents micro-increment spam  

---

### 🔹 Speed Bump
- Triggered only when a **new valid highest bid** is placed  
- Extends auction time for last-minute bids  
- Reduces sniping advantage  

---

### 🔹 Cooldown per User
- Users must wait a fixed time (e.g., 5–10 seconds) between bids  
- Prevents rapid automated bidding  

---

### 🔹 Maximum Extensions Cap
- Limits how many times auction can be extended  
- Prevents indefinite prolonging  

---

### 🔹 Max Bids per User
- Each user has a limit on total bids per auction  
- Prevents dominance by a single participant  
- Applied when bid leads to time extension  

---

### 🔹 Bid Fee / Deposit
- Each bid requires a small fee or temporary token lock  
- Discourages spam and bot abuse  

---

## 6. Additional Features

### 🔹 Bid History UI
- Display all bids with timestamps  
- Helps users understand auction progression  

---

### 🔹 Transaction Simulation UI
- Users can preview:
  - Bid success/failure  
  - Updated highest bid  
  - Auction time extension  

- Improves trust and prevents unexpected outcomes  

---

### 🔹 User Dashboard
- UI Display:
  - Auctions created  
  - Bids placed  
  - Auctions won/lost  

---

## 7. User Workflow

### Seller:
- Create or own an NFT  
- Create auction  
- Deposit NFT into vault  
- Wait for auction completion  
- Receive tokens  

---

### Bidder:
- View auction details  
- Simulate bid (optional)  
- Place bid  
- Tokens locked in vault  
- If outbid → immediate refund  
- If highest → win NFT  

---

## 8. Security & Verification

### 🔹 Move Prover
- Ensure:
  - Funds cannot be stolen  
  - Only valid winner receives asset  

---

### 🔹 Unit Testing
- Test:
  - Speed bump logic  
  - Cooldown enforcement  
  - Bid validation rules  
  - Settlement correctness  