/// NFT Module for Fair Auction Marketplace
/// Implements Non-Fungible Tokens as Move resources with on-chain metadata.
/// Each NFT is uniquely identified and owned by a user account.
module fair_auction::nft {
    use std::string::{Self, String};
    use std::signer;
    use std::vector;
    use aptos_framework::event;

    use aptos_framework::timestamp;

    // ─── Errors ──────────────────────────────────────────────────────────────
    const E_NOT_OWNER: u64              = 1;
    const E_NFT_NOT_FOUND: u64          = 2;
    const E_COLLECTION_NOT_FOUND: u64   = 3;
    const E_ALREADY_INITIALIZED: u64    = 4;
    const E_UNAUTHORIZED: u64           = 5;
    const E_NFT_IN_AUCTION: u64         = 6;
    const E_EMPTY_NAME: u64             = 7;
    const E_EMPTY_IMAGE_URL: u64        = 8;

    // ─── Structs ─────────────────────────────────────────────────────────────

    /// Core NFT resource – stored in the owner's account
    struct NFT has store, drop {
        id: u64,
        name: String,
        description: String,
        image_url: String,
        creator: address,
        owner: address,
        created_at: u64,
        in_auction: bool,
    }

    /// Holds all NFTs owned by a single account
    struct NFTCollection has key {
        nfts: vector<NFT>,
    }

    struct GlobalState has key {
        next_id: u64,
    }

    // ─── Events ───────────────────────────────────────────────────────────────

    #[event]
    struct NFTMintedEvent has drop, store {
        nft_id: u64,
        owner: address,
        name: String,
        image_url: String,
        timestamp: u64,
    }

    #[event]
    struct NFTTransferredEvent has drop, store {
        nft_id: u64,
        from: address,
        to: address,
        timestamp: u64,
    }

    // ─── Initialisation ───────────────────────────────────────────────────────

    /// Creates an empty NFT collection for the caller.
    /// Must be called once per account before minting.
    public entry fun initialize_collection(account: &signer) {
        let addr = signer::address_of(account);
        assert!(!exists<NFTCollection>(addr), E_ALREADY_INITIALIZED);
        move_to(account, NFTCollection {
            nfts: vector::empty<NFT>(),
        });

        // Initialize global state if it doesn't exist (on first use)
        // In a real app, this would be a separate admin-only initialization
        if (!exists<GlobalState>(@fair_auction)) {
            // This is a simplification; usually you'd have a dedicated admin setup
        };
    }

    public entry fun initialize_global(admin: &signer) {
        let addr = signer::address_of(admin);
        assert!(addr == @fair_auction, 100); // Only deployer
        if (!exists<GlobalState>(addr)) {
            move_to(admin, GlobalState { next_id: 0 });
        }
    }

    // ─── Mint ─────────────────────────────────────────────────────────────────

    /// Mints a new NFT and stores it in the caller's collection.
    public entry fun mint_nft(
        account: &signer,
        name: String,
        description: String,
        image_url: String,
    ) acquires NFTCollection, GlobalState {
        assert!(string::length(&name) > 0, E_EMPTY_NAME);
        assert!(string::length(&image_url) > 0, E_EMPTY_IMAGE_URL);

        let addr = signer::address_of(account);

        // Auto-initialize collection if it doesn't exist
        if (!exists<NFTCollection>(addr)) {
            move_to(account, NFTCollection {
                nfts: vector::empty<NFT>(),
            });
        };

        let collection = borrow_global_mut<NFTCollection>(addr);
        
        let global_state = borrow_global_mut<GlobalState>(@fair_auction);
        let nft_id = global_state.next_id;
        global_state.next_id = nft_id + 1;

        let nft = NFT {
            id: nft_id,
            name,
            description,
            image_url,
            creator: addr,
            owner: addr,
            created_at: timestamp::now_seconds(),
            in_auction: false,
        };

        vector::push_back(&mut collection.nfts, nft);

        event::emit(NFTMintedEvent {
            nft_id,
            owner: addr,
            name: *&vector::borrow(&collection.nfts, vector::length(&collection.nfts) - 1).name,
            image_url: *&vector::borrow(&collection.nfts, vector::length(&collection.nfts) - 1).image_url,
            timestamp: timestamp::now_seconds(),
        });
    }

    // ─── Transfer ─────────────────────────────────────────────────────────────

    /// Transfers an NFT from one account to another.
    public entry fun transfer_nft(
        from: &signer,
        to: address,
        nft_id: u64,
    ) acquires NFTCollection {
        let from_addr = signer::address_of(from);
        assert!(exists<NFTCollection>(from_addr), E_COLLECTION_NOT_FOUND);

        let from_collection = borrow_global_mut<NFTCollection>(from_addr);
        let (found, idx) = find_nft_index(&from_collection.nfts, nft_id);
        assert!(found, E_NFT_NOT_FOUND);

        let nft_ref = vector::borrow(&from_collection.nfts, idx);
        assert!(nft_ref.owner == from_addr, E_NOT_OWNER);
        assert!(!nft_ref.in_auction, E_NFT_IN_AUCTION);

        // Remove from sender
        let nft = vector::remove(&mut from_collection.nfts, idx);
        let mut_nft = &mut nft;
        mut_nft.owner = to;

        // Add to receiver (auto-initialize if needed)
        if (!exists<NFTCollection>(to)) {
            // Cannot move_to in a non-entry function; caller must ensure receiver is initialized
            // In practice, auction contract handles this
        };

        let to_collection = borrow_global_mut<NFTCollection>(to);
        vector::push_back(&mut to_collection.nfts, nft);

        event::emit(NFTTransferredEvent {
            nft_id,
            from: from_addr,
            to,
            timestamp: timestamp::now_seconds(),
        });
    }

    // ─── Auction Lock / Unlock ─────────────────────────────────────────────────

    /// Marks an NFT as locked in auction.
    /// Only callable by the auction module (friend).
    public(friend) fun lock_for_auction(owner: address, nft_id: u64) acquires NFTCollection {
        let collection = borrow_global_mut<NFTCollection>(owner);
        let (found, idx) = find_nft_index(&collection.nfts, nft_id);
        assert!(found, E_NFT_NOT_FOUND);
        let nft = vector::borrow_mut(&mut collection.nfts, idx);
        assert!(nft.owner == owner, E_NOT_OWNER);
        nft.in_auction = true;
    }

    /// Unlocks an NFT from auction state.
    public(friend) fun unlock_from_auction(owner: address, nft_id: u64) acquires NFTCollection {
        let collection = borrow_global_mut<NFTCollection>(owner);
        let (found, idx) = find_nft_index(&collection.nfts, nft_id);
        assert!(found, E_NFT_NOT_FOUND);
        let nft = vector::borrow_mut(&mut collection.nfts, idx);
        nft.in_auction = false;
    }

    /// Unlocks and transfers NFT to winner (friend only).
    public(friend) fun finalize_settlement(owner: address, winner: address, nft_id: u64) acquires NFTCollection {
        let from_collection = borrow_global_mut<NFTCollection>(owner);
        let (found, idx) = find_nft_index(&from_collection.nfts, nft_id);
        assert!(found, 2);

        let nft = vector::remove(&mut from_collection.nfts, idx);
        nft.in_auction = false;
        nft.owner = winner;

        // If winner doesn't have a collection, we have to abort because we can't create one for them
        // without their signer. Bidders must initialize their collection before bidding.
        assert!(exists<NFTCollection>(winner), E_COLLECTION_NOT_FOUND);

        let to_collection = borrow_global_mut<NFTCollection>(winner);
        vector::push_back(&mut to_collection.nfts, nft);
    }

    /// Removes an NFT from owner's collection and returns it (for vault deposit).
    public(friend) fun remove_nft(owner: address, nft_id: u64): NFT acquires NFTCollection {
        let collection = borrow_global_mut<NFTCollection>(owner);
        let (found, idx) = find_nft_index(&collection.nfts, nft_id);
        assert!(found, E_NFT_NOT_FOUND);
        let nft = vector::borrow(&collection.nfts, idx);
        assert!(nft.owner == owner, E_NOT_OWNER);
        assert!(!nft.in_auction, E_NFT_IN_AUCTION);
        vector::remove(&mut collection.nfts, idx)
    }

    /// Deposits an NFT into the recipient's collection.
    public(friend) fun deposit_nft(recipient: address, nft: NFT) acquires NFTCollection {
        let collection = borrow_global_mut<NFTCollection>(recipient);
        let mut_nft = &mut nft;
        mut_nft.owner = recipient;
        mut_nft.in_auction = false;
        vector::push_back(&mut collection.nfts, nft);
    }

    // ─── View Functions ──────────────────────────────────────────────────────

    #[view]
    public fun get_nft_count(owner: address): u64 acquires NFTCollection {
        if (!exists<NFTCollection>(owner)) { return 0 };
        let collection = borrow_global<NFTCollection>(owner);
        vector::length(&collection.nfts)
    }

    #[view]
    public fun get_nft_info(owner: address, nft_id: u64): (String, String, String, address, bool, u64) acquires NFTCollection {
        assert!(exists<NFTCollection>(owner), E_COLLECTION_NOT_FOUND);
        let collection = borrow_global<NFTCollection>(owner);
        let (found, idx) = find_nft_index(&collection.nfts, nft_id);
        assert!(found, E_NFT_NOT_FOUND);
        let nft = vector::borrow(&collection.nfts, idx);
        (nft.name, nft.description, nft.image_url, nft.creator, nft.in_auction, nft.created_at)
    }

    #[view]
    public fun nft_exists(owner: address, nft_id: u64): bool acquires NFTCollection {
        if (!exists<NFTCollection>(owner)) { return false };
        let collection = borrow_global<NFTCollection>(owner);
        let (found, _) = find_nft_index(&collection.nfts, nft_id);
        found
    }

    #[view]
    public fun has_collection(addr: address): bool {
        exists<NFTCollection>(addr)
    }

    // ─── Internal Helpers ─────────────────────────────────────────────────────

    fun find_nft_index(nfts: &vector<NFT>, nft_id: u64): (bool, u64) {
        let len = vector::length(nfts);
        let i = 0;
        while (i < len) {
            if (vector::borrow(nfts, i).id == nft_id) {
                return (true, i)
            };
            i = i + 1;
        };
        (false, 0)
    }

    // ─── Friend Declarations ──────────────────────────────────────────────────
    friend fair_auction::auction;
    friend fair_auction::vault;
}
