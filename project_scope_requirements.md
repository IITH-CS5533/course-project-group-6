# Project Scope: Fair Auction Marketplace on Aptos

## 1. Project Overview
This project implements a secure and decentralized auction marketplace on the Aptos blockchain using the Move programming language.

The system is designed to:
- Reduce bot-based manipulation
- Ensure transparency and trust through on-chain logic
- Support multiple auction types for real-world usability

---

## 2. Problem Statement
Traditional and existing blockchain auctions suffer from:

- Bot Spamming: Automated systems repeatedly place bids to manipulate prices
- Unfair Incrementing: Minimal bid increases allow bots to dominate auctions
- Inefficient fund locking mechanisms
- Honeypot Risks: Users cannot verify outcomes before interacting with contracts

---

## 3. Proposed Solution
We implement a secure auction protocol with:

- A Digital Vault (Resource Account) to securely hold assets and bids
- Anti-bot protections to limit spam and unfair automation
- Transaction Simulation to preview outcomes before execution

Additionally:

- Auctioned assets are represented as **NFTs (Non-Fungible Tokens)**  
- NFTs are created through our smart contract and stored in user accounts  
- NFTs are stored on-chain as Move resources with metadata:
  - Name  
  - Description  
  - Image URL  

### Ownership Model:
- NFTs are owned by users (not the contract)  
- Only the NFT owner can create an auction  
- NFTs are transferred to the vault only during auction  

---

## 4. Account Model

The system defines two types of accounts:

### 🔹 Admin Account
- Controls system-level parameters  
- Can configure:
  - Maximum auction duration  
  - Minimum bid increment/decrement  
  - Cooldown duration  
  - Reverse auction limits  

---

### 🔹 User Accounts
Users can act in multiple roles:
- Seller (forward auction)
- Bidder (forward auction)
- Buyer (reverse auction)
- Seller (reverse auction)

All transactions are signed via the user's wallet.

---

## 5. Core Features

---

### 🔹 5.1 Forward Auction (NFT Sale)

#### Auction Creation:
Seller must:
- Own the NFT  
- Deposit NFT into vault  
- Define:
  - Starting price  
  - Auction duration (bounded by admin limit)  
  - Minimum bid increment  

---

#### Bidding System:
- Users place bids using fungible tokens  
- Highest valid bid is tracked on-chain  

#### Bid Validation:
new_bid > current_highest_bid


---

#### Refund Logic:
- When a new higher bid is placed:
  - Previous highest bidder is **immediately refunded**

---

#### Bid Update Logic:
- If user increases bid:
  - Only latest bid is active  
- If already highest bidder:
  - Only additional amount is locked  
- If previously outbid:
  - Full new bid amount is locked  

---

#### Constraints:
- Decreasing a bid is **not allowed**  
- Bid cancellation is **not allowed**

---

#### Settlement:
- NFT → highest bidder  
- Tokens → seller  
- No funds remain locked  

---

---

### 🔹 5.2 Reverse Auction (Service-Based)

#### Model:
- Buyer posts requirement  
- Sellers compete with **lower bids**  
- Lowest valid bid wins  

---

#### Auction Creation (Buyer):
Buyer must:
- Define requirement description  
- Define auction duration (bounded)  
- Deposit maximum budget into vault  

---

#### Bidding Logic:

new_bid < current_lowest_bid


- First bid initializes lowest bid  

---

#### Rules:
- Sellers can only decrease bids  
- Increasing bids is not allowed  
- Equal bids are rejected  

---

#### Fund Model (Escrow-Based):
- Buyer deposits maximum budget at auction creation  
- Ensures payment is guaranteed  

---

#### Settlement:
- Lowest bidder is selected as winner  
- Winning amount is transferred from vault to seller  
- Remaining funds are refunded to buyer  

---

#### Edge Cases:
- No bids → no winner  

---

## 6. Vault & Fund Management

### Digital Vault:
- Implemented using Resource Accounts  
- Holds:
  - NFTs during forward auctions  
  - Tokens during bidding  

---

### Fund Principles:
- Immediate refund on outbid  
- Minimal capital locking  
- No unnecessary fund retention  

---

## 7. Anti-Bot Protection Features

### 🔹 Minimum Bid Increment / Decrement
- Each new bid must exceed/decrease current bid by a percentage  
- Prevents micro-increment spam  

---

### 🔹 Cooldown per User
- Users must wait a fixed time between bids  
- Prevents rapid automated bidding  

---

### 🔹 Bid Fee / Deposit
- Small fee or temporary lock per bid  
- Discourages spam  


---

## 8. Frontend & Wallet Integration

- Frontend integrated with wallet  
- All transactions are signed by users  

### Features:
- Auction browsing  
- Bid placement  
- Reverse auction participation  
- User dashboard  

---

## 9. User Workflow

### Seller (Forward Auction):
- Create NFT  
- Create auction  
- Deposit NFT into vault  
- Receive tokens after auction  

---

### Bidder:
- View auction  
- Place bid  
- If outbid → immediate refund  
- If winner → receive NFT  

---

### Buyer (Reverse Auction):
- Create requirement  
- Deposit budget  
- Wait for bids  
- Receive service from winner  

---

### Seller (Reverse Auction):
- View requirements  
- Place lower bids  
- Win → receive payment  

---

## 10. Security & Verification

### Move Prover:
- Ensures:
  - Correct ownership transfer  
  - No fund leakage  

---

## 11. Auction Execution & Settlement Mechanism

### 🔹 Auction Lifecycle

- Each auction stores an *end_time* on-chain  
- An auction is considered **eligible for settlement** once: current_time >= end_time

---

### 🔹 Off-Chain Bot (Automation Layer)

Since smart contracts do not execute automatically, we use an **off-chain bot** to monitor and trigger settlement.

#### Responsibilities of the Bot:
- Continuously monitor active auctions  
- Detect when: current_time >= auction_end_time
- Trigger a transaction: settle_auction(auction_id)

---

### 🔹 Role of Smart Contract

- The smart contract performs:
  - Validation of auction state  
  - Determination of winner  
  - Transfer of assets and funds  
  - Marking auction as completed  

- The bot does **not** control:
  - Fund transfers  
  - Winner selection  

All critical logic is enforced on-chain.

---

### 🔹 Permissionless Settlement

- The *settle_auction* function is **publicly callable**  
- Any user (not just the bot) can trigger settlement  

This ensures:
- No dependency on a single off-chain entity  
- Robust and decentralized execution  

---

### 🔹 Failure Handling

- If the bot fails:
  - Any user can manually trigger settlement  
- Ensures auctions are always eventually settled  

---

### 🔹 Design Principle

> The off-chain bot provides automation, while the smart contract guarantees correctness and security.



### Unit Testing:
- Bid validation  
- Refund correctness  
- Auction settlement  
- Reverse auction correctness  