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

---

## 4. Core Features

### 🔹 Auction Creation
Seller creates auction with:
- Starting price
- Auction duration
- Minimum bid increment (%)
- Maximum extension limit

---

### 🔹 Bidding System
- Users place bids using fungible tokens
- Tokens are locked in the vault during the auction  
- Highest valid bid is tracked on-chain  

---

### 🔹 Speed Bump Logic
- If a bid is placed within the last N seconds:
  - Auction end time is extended  
- Extensions are capped by a predefined limit  

---

### 🔹 Vault Security
- Assets and tokens are stored in a resource account (digital vault)  
- Only smart contract logic controls fund movement  
- Prevents unauthorized withdrawals  

---

### 🔹 Settlement Logic
- After auction ends:
  - Highest bidder receives asset  
  - Seller receives tokens  
  - Other bidders are refunded  

---

## 5. Anti-Bot Protection Features

### 🔹 Minimum Bid Increment
- Each new bid must exceed current bid by a percentage (e.g., 5%)  
- Prevents micro-increment spam  

---

### 🔹 Speed Bump
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
- Will be applied when the bid leads to a time extension  

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
- View:
  - Auctions created  
  - Bids placed  
  - Auctions won/lost  

---

## 7. User Workflow

### Seller:
- Create auction  
- Deposit asset into vault  
- Wait for auction completion  
- Receive tokens  

---

### Bidder:
- View auction details  
- Simulate bid (optional)  
- Place bid  
- Tokens locked in vault  
- If highest → win asset  
- Else → refund  

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