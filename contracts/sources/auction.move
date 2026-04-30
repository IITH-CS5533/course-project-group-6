/// Core Auction Module – Forward & Reverse Auctions
/// Implements all auction lifecycle logic:
///   - Forward auction (NFT sale, highest bid wins)
///   - Reverse auction (service, lowest bid wins)
///   - Speed-bump anti-sniping
///   - Anti-bot cooldowns and bid limits
///   - Immediate refunds on outbid
///   - Permissionless settlement
module fair_auction::auction {
    use std::signer;
    use std::string::String;
    use std::vector;
    use aptos_framework::event;
    use aptos_framework::timestamp;

    use fair_auction::config;
    use fair_auction::vault;

    // ─── Errors ───────────────────────────────────────────────────────────────
    const E_AUCTION_NOT_FOUND: u64      = 300;
    const E_AUCTION_ENDED: u64          = 301;
    const E_AUCTION_NOT_ENDED: u64      = 302;
    const E_BID_TOO_LOW: u64            = 303;
    const E_BID_COOLDOWN: u64           = 304;
    const E_MAX_BIDS_REACHED: u64       = 305;
    const E_NOT_OWNER: u64              = 306;
    const E_ALREADY_SETTLED: u64        = 307;
    const E_INVALID_DURATION: u64       = 308;
    const E_NOT_INITIALIZED: u64        = 309;
    const E_ALREADY_HIGHEST: u64        = 310;
    const E_CANNOT_DECREASE_BID: u64    = 311;
    const E_NO_BIDS: u64                = 312;
    const E_REVERSE_ONLY_DECREASE: u64  = 313;
    const E_INSUFFICIENT_BUDGET: u64    = 314;
    const E_EXCEEDS_ADMIN_CAP: u64      = 315;

    // ─── Auction Types ────────────────────────────────────────────────────────
    const AUCTION_TYPE_FORWARD: u8 = 0;
    const AUCTION_TYPE_REVERSE: u8 = 1;

    // ─── Status ───────────────────────────────────────────────────────────────
    const STATUS_ACTIVE: u8   = 0;
    const STATUS_SETTLED: u8  = 1;
    const STATUS_CANCELLED: u8 = 2;

    // ─── Structs ─────────────────────────────────────────────────────────────

    struct BidRecord has store, drop, copy {
        bidder: address,
        amount: u64,
        timestamp: u64,
    }

    struct UserBidState has store, drop, copy {
        bidder: address,
        locked_amount: u64,
        bid_count: u64,
        last_bid_time: u64,
    }

    struct Auction has store, drop {
        id: u64,
        auction_type: u8,
        seller: address,
        /// For forward: NFT id in seller's collection (locked)
        nft_id: u64,
        nft_owner: address,   // original owner before vault
        /// For reverse: text description of requirement
        requirement_description: String,
        starting_price: u64,
        current_best_bid: u64,  // highest (fwd) or lowest (rev)
        best_bidder: address,
        end_time: u64,
        extension_count: u64,
        status: u8,
        bid_history: vector<BidRecord>,
        bidder_states: vector<UserBidState>,
        /// For reverse: buyer's maximum budget locked in vault
        buyer_budget: u64,
        admin: address,
        vault_address: address,
        min_bid_change_bps: u64,
        bid_cooldown_seconds: u64,
        max_bids_per_user: u64,
        max_extensions: u64,
        speed_bump_seconds: u64,
        extension_seconds: u64,
        bidfee_octas: u64,
    }

    struct AuctionStore has key {
        auctions: vector<Auction>,
        next_id: u64,
    }

    // ─── Events ───────────────────────────────────────────────────────────────

    #[event]
    struct AuctionCreatedEvent has drop, store {
        auction_id: u64,
        auction_type: u8,
        seller: address,
        nft_id: u64,
        starting_price: u64,
        end_time: u64,
    }

    #[event]
    struct BidPlacedEvent has drop, store {
        auction_id: u64,
        bidder: address,
        amount: u64,
        new_end_time: u64,
        timestamp: u64,
    }

    #[event]
    struct AuctionSettledEvent has drop, store {
        auction_id: u64,
        winner: address,
        winning_amount: u64,
        timestamp: u64,
    }

    #[event]
    struct RefundEvent has drop, store {
        auction_id: u64,
        recipient: address,
        amount: u64,
    }

    // ─── Initialisation ───────────────────────────────────────────────────────

    public entry fun initialize_store(account: &signer) {
        let addr = signer::address_of(account);
        if (!exists<AuctionStore>(addr)) {
            move_to(account, AuctionStore {
                auctions: vector::empty<Auction>(),
                next_id: 0,
            });
        };
    }

    // ─── Forward Auction Creation ─────────────────────────────────────────────

    /// Creates a forward NFT auction.
    /// The NFT (nft_id) must be owned by `seller` in their NFT collection.
    /// Auction parameters are bounded by admin config.
    public entry fun create_forward_auction(
        seller: &signer,
        store_owner: address,        // address holding AuctionStore
        admin: address,              // address holding AdminConfig & VaultRef
        nft_id: u64,
        starting_price: u64,
        duration_seconds: u64,
        min_bid_inc_bps: u64,
        cooldown_secs: u64,
        max_bids: u64,
        max_ext: u64,
        speed_bump: u64,
        ext_secs: u64,
    ) acquires AuctionStore {
        let seller_addr = signer::address_of(seller);

        // Fetch admin config
        // Fetch protocol bounds from Admin
        let (
            fee,
            min_inc, max_inc,
            _min_dec, _max_dec,
            min_cool, max_cool,
            min_bids, max_bids_limit,
            min_ext, max_ext_limit,
            min_sb, max_sb,
            min_es, max_es
        ) = config::get_protocol_bounds(admin);

        // Validation against Protocol Guards
        assert!(min_bid_inc_bps >= min_inc && min_bid_inc_bps <= max_inc, E_EXCEEDS_ADMIN_CAP);
        assert!(cooldown_secs >= min_cool && cooldown_secs <= max_cool, E_EXCEEDS_ADMIN_CAP);
        assert!(max_bids >= min_bids && max_bids <= max_bids_limit, E_EXCEEDS_ADMIN_CAP);
        assert!(max_ext >= min_ext && max_ext <= max_ext_limit, E_EXCEEDS_ADMIN_CAP);
        assert!(speed_bump >= min_sb && speed_bump <= max_sb, E_EXCEEDS_ADMIN_CAP);
        assert!(ext_secs >= min_es && ext_secs <= max_es, E_EXCEEDS_ADMIN_CAP);

        let vault_addr = vault::get_vault_address(admin);
        let now = timestamp::now_seconds();
        let end_time = now + duration_seconds;

        // Lock the NFT so it cannot be transferred during auction
        fair_auction::nft::lock_for_auction(seller_addr, nft_id);

        let store = borrow_global_mut<AuctionStore>(store_owner);
        let auction_id = store.next_id;

        let auction = Auction {
            id: auction_id,
            auction_type: AUCTION_TYPE_FORWARD,
            seller: seller_addr,
            nft_id,
            nft_owner: seller_addr,
            requirement_description: std::string::utf8(b""),
            starting_price,
            current_best_bid: 0,
            best_bidder: @0x0,
            end_time,
            extension_count: 0,
            status: STATUS_ACTIVE,
            bid_history: vector::empty<BidRecord>(),
            bidder_states: vector::empty<UserBidState>(),
            buyer_budget: 0,
            admin,
            vault_address: vault_addr,
            min_bid_change_bps: min_bid_inc_bps,
            bid_cooldown_seconds: cooldown_secs,
            max_bids_per_user: max_bids,
            max_extensions: max_ext,
            speed_bump_seconds: speed_bump,
            extension_seconds: ext_secs,
            bidfee_octas: fee,
        };

        vector::push_back(&mut store.auctions, auction);
        store.next_id = auction_id + 1;

        event::emit(AuctionCreatedEvent {
            auction_id,
            auction_type: AUCTION_TYPE_FORWARD,
            seller: seller_addr,
            nft_id,
            starting_price,
            end_time,
        });
    }

    // ─── Reverse Auction Creation ─────────────────────────────────────────────

    /// Creates a reverse auction. Buyer deposits their maximum budget.
    public entry fun create_reverse_auction(
        buyer: &signer,
        store_owner: address,
        admin: address,
        requirement_description: String,
        max_budget: u64,
        duration_seconds: u64,
        min_bid_dec_bps: u64,
        cooldown_secs: u64,
        max_bids: u64,
        max_ext: u64,
        speed_bump: u64,
        ext_secs: u64,
    ) acquires AuctionStore {
        let buyer_addr = signer::address_of(buyer);

        // Fetch protocol bounds from Admin
        let (
            fee,
            _min_inc, _max_inc,
            min_dec, max_dec,
            min_cool, max_cool,
            min_bids, max_bids_limit,
            min_ext, max_ext_limit,
            min_sb, max_sb,
            min_es, max_es
        ) = config::get_protocol_bounds(admin);

        // Validation against Protocol Guards
        assert!(min_bid_dec_bps >= min_dec && min_bid_dec_bps <= max_dec, E_EXCEEDS_ADMIN_CAP);
        assert!(cooldown_secs >= min_cool && cooldown_secs <= max_cool, E_EXCEEDS_ADMIN_CAP);
        assert!(max_bids >= min_bids && max_bids <= max_bids_limit, E_EXCEEDS_ADMIN_CAP);
        assert!(max_ext >= min_ext && max_ext <= max_ext_limit, E_EXCEEDS_ADMIN_CAP);
        assert!(speed_bump >= min_sb && speed_bump <= max_sb, E_EXCEEDS_ADMIN_CAP);
        assert!(ext_secs >= min_es && ext_secs <= max_es, E_EXCEEDS_ADMIN_CAP);
        let vault_addr = vault::get_vault_address(admin);

        // Deposit buyer's budget into vault
        vault::deposit_coins(buyer, max_budget, vault_addr);

        let now = timestamp::now_seconds();
        let end_time = now + duration_seconds;

        let store = borrow_global_mut<AuctionStore>(store_owner);
        let auction_id = store.next_id;

        let auction = Auction {
            id: auction_id,
            auction_type: AUCTION_TYPE_REVERSE,
            seller: buyer_addr,
            nft_id: 0,
            nft_owner: @0x0,
            requirement_description,
            starting_price: max_budget,
            current_best_bid: max_budget + 1,  // sentinel: no bids yet
            best_bidder: @0x0,
            end_time,
            extension_count: 0,
            status: STATUS_ACTIVE,
            bid_history: vector::empty<BidRecord>(),
            bidder_states: vector::empty<UserBidState>(),
            buyer_budget: max_budget,
            admin,
            vault_address: vault_addr,
            min_bid_change_bps: min_bid_dec_bps,
            bid_cooldown_seconds: cooldown_secs,
            max_bids_per_user: max_bids,
            max_extensions: max_ext,
            speed_bump_seconds: speed_bump,
            extension_seconds: ext_secs,
            bidfee_octas: fee,
        };

        vector::push_back(&mut store.auctions, auction);
        store.next_id = auction_id + 1;

        event::emit(AuctionCreatedEvent {
            auction_id,
            auction_type: AUCTION_TYPE_REVERSE,
            seller: buyer_addr,
            nft_id: 0,
            starting_price: max_budget,
            end_time,
        });
    }

    // ─── Place Bid (Forward) ──────────────────────────────────────────────────

    public entry fun place_bid(
        bidder: &signer,
        store_owner: address,
        auction_id: u64,
        bid_amount: u64,
    ) acquires AuctionStore {
        let bidder_addr = signer::address_of(bidder);
        let now = timestamp::now_seconds();

        let store = borrow_global_mut<AuctionStore>(store_owner);
        let (found, idx) = find_auction_index(&store.auctions, auction_id);
        assert!(found, E_AUCTION_NOT_FOUND);

        let auction = vector::borrow_mut(&mut store.auctions, idx);

        // State checks
        assert!(auction.status == STATUS_ACTIVE, E_ALREADY_SETTLED);
        assert!(now < auction.end_time, E_AUCTION_ENDED);
        assert!(auction.auction_type == AUCTION_TYPE_FORWARD, E_AUCTION_NOT_FOUND);

        // Ensure bidder has an NFT collection initialized (to avoid settlement failure)
        assert!(fair_auction::nft::has_collection(bidder_addr), E_NOT_INITIALIZED);

        // Bid validation
        let min_next_bid = if (auction.current_best_bid == 0) {
            auction.starting_price
        } else {
            auction.current_best_bid + (auction.current_best_bid * auction.min_bid_change_bps / 10000)
        };
        assert!(bid_amount >= min_next_bid, E_BID_TOO_LOW);

        // Cooldown & per-user checks
        let (bidder_idx_found, bidder_idx) = find_bidder_index(&auction.bidder_states, bidder_addr);

        if (bidder_idx_found) {
            let state = vector::borrow(&auction.bidder_states, bidder_idx);
            assert!(now - state.last_bid_time >= auction.bid_cooldown_seconds, E_BID_COOLDOWN);
            if (auction.max_bids_per_user > 0) {
                assert!(state.bid_count < auction.max_bids_per_user, E_MAX_BIDS_REACHED);
            };
            // Cannot lower your own bid
            assert!(bid_amount > state.locked_amount, E_CANNOT_DECREASE_BID);
        };

        // Pay fee
        vault::deposit_coins(bidder, auction.bidfee_octas, auction.vault_address);

        // Lock only the additional amount (delta)
        let additional = if (bidder_idx_found) {
            let state = vector::borrow(&auction.bidder_states, bidder_idx);
            bid_amount - state.locked_amount
        } else {
            bid_amount
        };
        vault::deposit_coins(bidder, additional, auction.vault_address);

        // Refund previous highest bidder (if different)
        let prev_bidder = auction.best_bidder;
        let prev_amount = auction.current_best_bid;
        if (prev_amount > 0 && prev_bidder != bidder_addr && prev_bidder != @0x0) {
            vault::withdraw_coins(auction.vault_address, prev_bidder, prev_amount);
            event::emit(RefundEvent { auction_id, recipient: prev_bidder, amount: prev_amount });
            // Clear prev bidder's locked state
            let (pb_found, pb_idx) = find_bidder_index(&auction.bidder_states, prev_bidder);
            if (pb_found) {
                let pb_state = vector::borrow_mut(&mut auction.bidder_states, pb_idx);
                pb_state.locked_amount = 0;
            };
        };

        // Update best bid
        auction.current_best_bid = bid_amount;
        auction.best_bidder = bidder_addr;

        // Update bidder state
        if (bidder_idx_found) {
            let state = vector::borrow_mut(&mut auction.bidder_states, bidder_idx);
            state.locked_amount = bid_amount;
            state.bid_count = state.bid_count + 1;
            state.last_bid_time = now;
        } else {
            vector::push_back(&mut auction.bidder_states, UserBidState {
                bidder: bidder_addr,
                locked_amount: bid_amount,
                bid_count: 1,
                last_bid_time: now,
            });
        };

        // Record bid history
        vector::push_back(&mut auction.bid_history, BidRecord {
            bidder: bidder_addr,
            amount: bid_amount,
            timestamp: now,
        });

        // Speed bump
        let new_end_time = auction.end_time;
        if (auction.end_time - now <= auction.speed_bump_seconds
            && auction.extension_count < auction.max_extensions) {
            auction.end_time = auction.end_time + auction.extension_seconds;
            auction.extension_count = auction.extension_count + 1;
            new_end_time = auction.end_time;
        };

        event::emit(BidPlacedEvent {
            auction_id,
            bidder: bidder_addr,
            amount: bid_amount,
            new_end_time,
            timestamp: now,
        });
    }

    // ─── Place Bid (Reverse) ──────────────────────────────────────────────────

    public entry fun place_reverse_bid(
        seller: &signer,
        store_owner: address,
        auction_id: u64,
        bid_amount: u64,
    ) acquires AuctionStore {
        let seller_addr = signer::address_of(seller);
        let now = timestamp::now_seconds();

        let store = borrow_global_mut<AuctionStore>(store_owner);
        let (found, idx) = find_auction_index(&store.auctions, auction_id);
        assert!(found, E_AUCTION_NOT_FOUND);

        let auction = vector::borrow_mut(&mut store.auctions, idx);

        assert!(auction.status == STATUS_ACTIVE, E_ALREADY_SETTLED);
        assert!(now < auction.end_time, E_AUCTION_ENDED);
        assert!(auction.auction_type == AUCTION_TYPE_REVERSE, E_AUCTION_NOT_FOUND);

        // Must be lower than current best
        let has_bids = auction.best_bidder != @0x0;
        if (has_bids) {
            assert!(bid_amount < auction.current_best_bid, E_REVERSE_ONLY_DECREASE);
            // Percentage check on decrement
            let max_new = auction.current_best_bid
                - (auction.current_best_bid * auction.min_bid_change_bps / 10000);
            assert!(bid_amount <= max_new, E_BID_TOO_LOW);
        } else {
            assert!(bid_amount <= auction.starting_price, E_BID_TOO_LOW);
        };

        // Cooldown check
        let (bidder_idx_found, bidder_idx) = find_bidder_index(&auction.bidder_states, seller_addr);
        if (bidder_idx_found) {
            let state = vector::borrow(&auction.bidder_states, bidder_idx);
            assert!(now - state.last_bid_time >= auction.bid_cooldown_seconds, E_BID_COOLDOWN);
            if (auction.max_bids_per_user > 0) {
                assert!(state.bid_count < auction.max_bids_per_user, E_MAX_BIDS_REACHED);
            };
        };

        auction.current_best_bid = bid_amount;
        auction.best_bidder = seller_addr;

        let record = BidRecord { bidder: seller_addr, amount: bid_amount, timestamp: now };
        vector::push_back(&mut auction.bid_history, record);

        if (bidder_idx_found) {
            let state = vector::borrow_mut(&mut auction.bidder_states, bidder_idx);
            state.bid_count = state.bid_count + 1;
            state.last_bid_time = now;
        } else {
            vector::push_back(&mut auction.bidder_states, UserBidState {
                bidder: seller_addr,
                locked_amount: 0,
                bid_count: 1,
                last_bid_time: now,
            });
        };

        event::emit(BidPlacedEvent {
            auction_id,
            bidder: seller_addr,
            amount: bid_amount,
            new_end_time: auction.end_time,
            timestamp: now,
        });
    }

    // ─── Settlement ───────────────────────────────────────────────────────────

    /// Settles a forward auction. Permissionless – anyone can call once end_time passed.
    public entry fun settle_forward_auction(
        caller: &signer,
        store_owner: address,
        auction_id: u64,
    ) acquires AuctionStore {
        let caller_addr = signer::address_of(caller);
        let now = timestamp::now_seconds();

        let store = borrow_global_mut<AuctionStore>(store_owner);
        let (found, idx) = find_auction_index(&store.auctions, auction_id);
        assert!(found, E_AUCTION_NOT_FOUND);

        let auction = vector::borrow_mut(&mut store.auctions, idx);

        assert!(auction.status == STATUS_ACTIVE, E_ALREADY_SETTLED);
        assert!(now >= auction.end_time, E_AUCTION_NOT_ENDED);
        assert!(auction.auction_type == AUCTION_TYPE_FORWARD, E_AUCTION_NOT_FOUND);

        // Only creator OR store owner (admin/bot) can settle
        assert!(caller_addr == auction.seller || caller_addr == store_owner, E_NOT_OWNER);

        auction.status = STATUS_SETTLED;

        if (auction.best_bidder == @0x0 || auction.current_best_bid == 0) {
            // No bids – Unlock NFT so seller can use it again
            fair_auction::nft::unlock_from_auction(auction.seller, auction.nft_id);
            
            event::emit(AuctionSettledEvent {
                auction_id,
                winner: auction.seller,
                winning_amount: 0,
                timestamp: now,
            });
            return
        };

        let winner = auction.best_bidder;
        let winning_amount = auction.current_best_bid;
        let seller = auction.seller;
        let vault_addr = auction.vault_address;

        // Transfer winning amount to seller
        vault::withdraw_coins(vault_addr, seller, winning_amount);

        // Atomic transfer of NFT to winner
        fair_auction::nft::finalize_settlement(seller, winner, auction.nft_id);

        event::emit(AuctionSettledEvent {
            auction_id,
            winner,
            winning_amount,
            timestamp: now,
        });
    }

    /// Settles a reverse auction.
    public entry fun settle_reverse_auction(
        caller: &signer,
        store_owner: address,
        auction_id: u64,
    ) acquires AuctionStore {
        let caller_addr = signer::address_of(caller);
        let now = timestamp::now_seconds();

        let store = borrow_global_mut<AuctionStore>(store_owner);
        let (found, idx) = find_auction_index(&store.auctions, auction_id);
        assert!(found, E_AUCTION_NOT_FOUND);

        let auction = vector::borrow_mut(&mut store.auctions, idx);

        assert!(auction.status == STATUS_ACTIVE, E_ALREADY_SETTLED);
        assert!(now >= auction.end_time, E_AUCTION_NOT_ENDED);
        assert!(auction.auction_type == AUCTION_TYPE_REVERSE, E_AUCTION_NOT_FOUND);

        // Only creator OR store owner (admin/bot) can settle
        assert!(caller_addr == auction.seller || caller_addr == store_owner, E_NOT_OWNER);

        auction.status = STATUS_SETTLED;

        let buyer = auction.seller;
        let vault_addr = auction.vault_address;
        let budget = auction.buyer_budget;

        if (auction.best_bidder == @0x0) {
            // No bids – refund entire budget to buyer
            vault::withdraw_coins(vault_addr, buyer, budget);
            event::emit(AuctionSettledEvent {
                auction_id,
                winner: @0x0,
                winning_amount: 0,
                timestamp: now,
            });
            return
        };

        let winner = auction.best_bidder;
        let winning_amount = auction.current_best_bid;

        // Pay winner (lowest bidder / service provider)
        vault::withdraw_coins(vault_addr, winner, winning_amount);

        // Refund remainder to buyer
        let refund = budget - winning_amount;
        if (refund > 0) {
            vault::withdraw_coins(vault_addr, buyer, refund);
        };

        event::emit(AuctionSettledEvent {
            auction_id,
            winner,
            winning_amount,
            timestamp: now,
        });
    }
    public entry fun cancel_forward_auction(
        account: &signer,
        store_owner: address,
        auction_id: u64,
    ) acquires AuctionStore {
        let sender = signer::address_of(account);
        let store = borrow_global_mut<AuctionStore>(store_owner);
        let (found, idx) = find_auction_index(&store.auctions, auction_id);
        assert!(found, E_AUCTION_NOT_FOUND);
        
        let auction = vector::borrow_mut(&mut store.auctions, idx);
        assert!(auction.status == 0, 100); // 0 = active
        assert!(sender == auction.seller || sender == @fair_auction, 101);

        auction.status = 2; // 2 = cancelled
        fair_auction::nft::unlock_from_auction(auction.seller, auction.nft_id);
    }

    public entry fun cancel_reverse_auction(
        account: &signer,
        store_owner: address,
        auction_id: u64,
    ) acquires AuctionStore {
        let sender = signer::address_of(account);
        let store = borrow_global_mut<AuctionStore>(store_owner);
        let (found, idx) = find_auction_index(&store.auctions, auction_id);
        assert!(found, E_AUCTION_NOT_FOUND);
        
        let auction = vector::borrow_mut(&mut store.auctions, idx);
        assert!(auction.status == 0, 100);
        assert!(sender == auction.seller || sender == @fair_auction, 101);

        auction.status = 2;
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    #[view]
    public fun get_auction_count(store_owner: address): u64 acquires AuctionStore {
        if (!exists<AuctionStore>(store_owner)) { return 0 };
        vector::length(&borrow_global<AuctionStore>(store_owner).auctions)
    }

    #[view]
    public fun get_auction_info(
        store_owner: address,
        auction_id: u64,
    ): (u8, address, u64, u64, u64, address, u64, u64, u8) acquires AuctionStore {
        let store = borrow_global<AuctionStore>(store_owner);
        let (found, idx) = find_auction_index(&store.auctions, auction_id);
        assert!(found, E_AUCTION_NOT_FOUND);
        let a = vector::borrow(&store.auctions, idx);
        (
            a.auction_type,
            a.seller,
            a.nft_id,
            a.starting_price,
            a.current_best_bid,
            a.best_bidder,
            a.end_time,
            a.extension_count,
            a.status,
        )
    }

    #[view]
    public fun get_bid_count(store_owner: address, auction_id: u64): u64 acquires AuctionStore {
        let store = borrow_global<AuctionStore>(store_owner);
        let (found, idx) = find_auction_index(&store.auctions, auction_id);
        assert!(found, E_AUCTION_NOT_FOUND);
        vector::length(&vector::borrow(&store.auctions, idx).bid_history)
    }

    // ─── Internal Helpers ─────────────────────────────────────────────────────

    fun find_auction_index(auctions: &vector<Auction>, id: u64): (bool, u64) {
        let len = vector::length(auctions);
        let i = 0;
        while (i < len) {
            if (vector::borrow(auctions, i).id == id) { return (true, i) };
            i = i + 1;
        };
        (false, 0)
    }

    fun find_bidder_index(states: &vector<UserBidState>, addr: address): (bool, u64) {
        let len = vector::length(states);
        let i = 0;
        while (i < len) {
            if (vector::borrow(states, i).bidder == addr) { return (true, i) };
            i = i + 1;
        };
        (false, 0)
    }
}
