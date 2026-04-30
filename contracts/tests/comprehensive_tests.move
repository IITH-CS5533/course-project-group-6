#[test_only]
module fair_auction::comprehensive_tests {
    use std::string;
    use std::signer;
    use aptos_framework::account;
    use aptos_framework::timestamp;
    use aptos_framework::aptos_coin::{Self, AptosCoin};
    use aptos_framework::coin;
    
    use fair_auction::nft;
    use fair_auction::config;
    use fair_auction::vault;
    use fair_auction::auction;

    // --- TEST CONSTANTS ---
    const ADMIN_ADDR: address = @fair_auction;
    const SELLER_ADDR: address = @0x5E11;
    const BIDDER1_ADDR: address = @0xB1;
    const BIDDER2_ADDR: address = @0xB2;
    const STORE_OWNER_ADDR: address = @0x5708E;

    // --- SETUP HELPER ---
    fun setup_test(
        aptos_framework: &signer,
        admin: &signer,
        seller: &signer,
        bidder1: &signer,
        bidder2: &signer,
        store_owner: &signer,
        fair_auction: &signer
    ) {
        timestamp::set_time_has_started_for_testing(aptos_framework);
        
        account::create_account_for_test(signer::address_of(admin));
        account::create_account_for_test(signer::address_of(seller));
        account::create_account_for_test(signer::address_of(bidder1));
        account::create_account_for_test(signer::address_of(bidder2));
        account::create_account_for_test(signer::address_of(store_owner));
        account::create_account_for_test(signer::address_of(fair_auction));

        // Initialize AptosCoin for everyone
        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(aptos_framework);
        coin::register<AptosCoin>(admin);
        coin::register<AptosCoin>(seller);
        coin::register<AptosCoin>(bidder1);
        coin::register<AptosCoin>(bidder2);
        coin::register<AptosCoin>(store_owner);

        // Give them some money
        coin::deposit(signer::address_of(seller), coin::mint(100_000_000, &mint_cap));
        coin::deposit(signer::address_of(bidder1), coin::mint(100_000_000, &mint_cap));
        coin::deposit(signer::address_of(bidder2), coin::mint(100_000_000, &mint_cap));

        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);

        // Initialize modules
        config::initialize(admin);
        vault::initialize(admin);
        auction::initialize_store(store_owner);
        nft::initialize_collection(seller);
        nft::initialize_collection(bidder1);
        nft::initialize_collection(bidder2);
        nft::initialize_global(fair_auction);
    }

    // =========================================================================
    // 1. CONFIG & PROTOCOL GUARDS
    // =========================================================================

    #[test(aptos_framework = @0x1, admin = @fair_auction, seller = @0x5E11, bidder1 = @0xB1, bidder2 = @0xB2, store_owner = @0x5708E, fair_auction = @fair_auction)]
    fun test_config_and_bounds(
        aptos_framework: &signer, admin: &signer, seller: &signer, bidder1: &signer, bidder2: &signer, store_owner: &signer, fair_auction: &signer
    ) {
        setup_test(aptos_framework, admin, seller, bidder1, bidder2, store_owner, fair_auction);
        config::set_bid_fee(admin, 2_000_000);
        config::set_increment_bounds(admin, 200, 5000); 
    }

    #[test(aptos_framework = @0x1, admin = @fair_auction, seller = @0x5E11, bidder1 = @0xB1, bidder2 = @0xB2, store_owner = @0x5708E, fair_auction = @fair_auction)]
    #[expected_failure(abort_code = 315, location = fair_auction::auction)] // E_EXCEEDS_ADMIN_CAP
    fun test_auction_violates_admin_min_increment(
        aptos_framework: &signer, admin: &signer, seller: &signer, bidder1: &signer, bidder2: &signer, store_owner: &signer, fair_auction: &signer
    ) {
        setup_test(aptos_framework, admin, seller, bidder1, bidder2, store_owner, fair_auction);
        nft::mint_nft(seller, string::utf8(b"NFT"), string::utf8(b"D"), string::utf8(b"U"));
        // Default min increment is 100 bps (1%). Let's try 50 bps.
        auction::create_forward_auction(seller, STORE_OWNER_ADDR, ADMIN_ADDR, 0, 1000, 3600, 50, 10, 20, 5, 120, 300);
    }

    // =========================================================================
    // 2. FORWARD AUCTION FULL CYCLE
    // =========================================================================

    #[test(aptos_framework = @0x1, admin = @fair_auction, seller = @0x5E11, bidder1 = @0xB1, bidder2 = @0xB2, store_owner = @0x5708E, fair_auction = @fair_auction)]
    fun test_forward_auction_success(
        aptos_framework: &signer, admin: &signer, seller: &signer, bidder1: &signer, bidder2: &signer, store_owner: &signer, fair_auction: &signer
    ) {
        setup_test(aptos_framework, admin, seller, bidder1, bidder2, store_owner, fair_auction);
        nft::mint_nft(seller, string::utf8(b"High Value NFT"), string::utf8(b"Desc"), string::utf8(b"url"));
        
        auction::create_forward_auction(seller, STORE_OWNER_ADDR, ADMIN_ADDR, 0, 10000, 3600, 500, 10, 20, 5, 120, 300);
        
        auction::place_bid(bidder1, STORE_OWNER_ADDR, 0, 15000);
        timestamp::fast_forward_seconds(15); // Wait for cooldown
        auction::place_bid(bidder2, STORE_OWNER_ADDR, 0, 20000); // Bidder 2 outbids
        
        // Fast forward to end
        timestamp::fast_forward_seconds(3601);
        auction::settle_forward_auction(admin, STORE_OWNER_ADDR, 0);
        
        // Winner (Bidder 2) should own the NFT
        assert!(nft::get_nft_count(BIDDER2_ADDR) == 1, 401);
        // Status should be settled (1)
        let (_, _, _, _, _, _, _, _, status) = auction::get_auction_info(STORE_OWNER_ADDR, 0);
        assert!(status == 1, 402);
    }

    // =========================================================================
    // 3. REVERSE AUCTION FULL CYCLE
    // =========================================================================

    #[test(aptos_framework = @0x1, admin = @fair_auction, seller = @0x5E11, bidder1 = @0xB1, bidder2 = @0xB2, store_owner = @0x5708E, fair_auction = @fair_auction)]
    fun test_reverse_auction_success(
        aptos_framework: &signer, admin: &signer, seller: &signer, bidder1: &signer, bidder2: &signer, store_owner: &signer, fair_auction: &signer
    ) {
        setup_test(aptos_framework, admin, seller, bidder1, bidder2, store_owner, fair_auction);
        
        // Seller is "Buyer" in reverse
        auction::create_reverse_auction(seller, STORE_OWNER_ADDR, ADMIN_ADDR, string::utf8(b"Need Logo"), 50000, 3600, 1000, 10, 20, 5, 120, 300);
        
        auction::place_reverse_bid(bidder1, STORE_OWNER_ADDR, 0, 45000);
        timestamp::fast_forward_seconds(15);
        let bal_before = coin::balance<AptosCoin>(BIDDER2_ADDR);
        auction::place_reverse_bid(bidder2, STORE_OWNER_ADDR, 0, 40000); // Lowest bid wins
        
        timestamp::fast_forward_seconds(3601);
        auction::settle_reverse_auction(admin, STORE_OWNER_ADDR, 0);
        
        // Bidder 2 should receive their money (40000)
        // (Note: They started with 100,000,000, paid bid fee 1,000,000, then earned 40,000)
        assert!(coin::balance<AptosCoin>(BIDDER2_ADDR) == bal_before + 40000, 501);
    }

    // =========================================================================
    // 4. BOT PROTECTION & COOLDOWNS
    // =========================================================================

    #[test(aptos_framework = @0x1, admin = @fair_auction, seller = @0x5E11, bidder1 = @0xB1, bidder2 = @0xB2, store_owner = @0x5708E, fair_auction = @fair_auction)]
    #[expected_failure(abort_code = 304, location = fair_auction::auction)] // E_BID_COOLDOWN
    fun test_bid_cooldown_violation(
        aptos_framework: &signer, admin: &signer, seller: &signer, bidder1: &signer, bidder2: &signer, store_owner: &signer, fair_auction: &signer
    ) {
        setup_test(aptos_framework, admin, seller, bidder1, bidder2, store_owner, fair_auction);
        nft::mint_nft(seller, string::utf8(b"NFT"), string::utf8(b"D"), string::utf8(b"U"));
        auction::create_forward_auction(seller, STORE_OWNER_ADDR, ADMIN_ADDR, 0, 1000, 3600, 500, 10, 20, 5, 120, 300);
        
        auction::place_bid(bidder1, STORE_OWNER_ADDR, 0, 2000);
        auction::place_bid(bidder1, STORE_OWNER_ADDR, 0, 3000); // Too fast
    }

    #[test(aptos_framework = @0x1, admin = @fair_auction, seller = @0x5E11, bidder1 = @0xB1, bidder2 = @0xB2, store_owner = @0x5708E, fair_auction = @fair_auction)]
    #[expected_failure(abort_code = 305, location = fair_auction::auction)] // E_MAX_BIDS_REACHED
    fun test_max_bids_violation(
        aptos_framework: &signer, admin: &signer, seller: &signer, bidder1: &signer, bidder2: &signer, store_owner: &signer, fair_auction: &signer
    ) {
        setup_test(aptos_framework, admin, seller, bidder1, bidder2, store_owner, fair_auction);
        nft::mint_nft(seller, string::utf8(b"NFT"), string::utf8(b"D"), string::utf8(b"U"));
        // Set max bids to 2
        auction::create_forward_auction(seller, STORE_OWNER_ADDR, ADMIN_ADDR, 0, 1000, 3600, 100, 10, 2, 5, 120, 300);
        
        auction::place_bid(bidder1, STORE_OWNER_ADDR, 0, 2000);
        timestamp::fast_forward_seconds(15);
        auction::place_bid(bidder2, STORE_OWNER_ADDR, 0, 2500); // Bid 2 outbids
        timestamp::fast_forward_seconds(15);
        auction::place_bid(bidder1, STORE_OWNER_ADDR, 0, 3000); // Bid 1 second bid
        timestamp::fast_forward_seconds(15);
        auction::place_bid(bidder2, STORE_OWNER_ADDR, 0, 3500); // Bid 2 second bid
        timestamp::fast_forward_seconds(15);
        auction::place_bid(bidder1, STORE_OWNER_ADDR, 0, 4000); // Bid 1 third bid - FAIL
    }

    // =========================================================================
    // 5. CANCELLATION & UNLOCKING
    // =========================================================================

    #[test(aptos_framework = @0x1, admin = @fair_auction, seller = @0x5E11, bidder1 = @0xB1, bidder2 = @0xB2, store_owner = @0x5708E, fair_auction = @fair_auction)]
    fun test_cancel_unlocks_nft(
        aptos_framework: &signer, admin: &signer, seller: &signer, bidder1: &signer, bidder2: &signer, store_owner: &signer, fair_auction: &signer
    ) {
        setup_test(aptos_framework, admin, seller, bidder1, bidder2, store_owner, fair_auction);
        nft::mint_nft(seller, string::utf8(b"NFT"), string::utf8(b"D"), string::utf8(b"U"));
        auction::create_forward_auction(seller, STORE_OWNER_ADDR, ADMIN_ADDR, 0, 1000, 3600, 500, 10, 20, 5, 120, 300);
        
        auction::cancel_forward_auction(seller, STORE_OWNER_ADDR, 0);
        
        // NFT should be unlocked and transferable again
        nft::transfer_nft(seller, BIDDER1_ADDR, 0);
        assert!(nft::get_nft_count(BIDDER1_ADDR) == 1, 601);
    }
}
