#[test_only]
module fair_auction::feature_tests {
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
    const ADMIN: address = @fair_auction;
    const ALICE: address = @0xAAAA;
    const BOB: address   = @0xBBBB;
    const CHARLIE: address = @0xCCCC;
    const STORE: address = @0x5708E;

    // --- SETUP HELPER ---
    fun setup(
        framework: &signer,
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
        store_signer: &signer,
        fair_auction: &signer
    ) {
        timestamp::set_time_has_started_for_testing(framework);
        
        account::create_account_for_test(signer::address_of(admin));
        account::create_account_for_test(signer::address_of(alice));
        account::create_account_for_test(signer::address_of(bob));
        account::create_account_for_test(signer::address_of(charlie));
        account::create_account_for_test(signer::address_of(store_signer));
        account::create_account_for_test(signer::address_of(fair_auction));

        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(framework);
        coin::register<AptosCoin>(admin);
        coin::register<AptosCoin>(alice);
        coin::register<AptosCoin>(bob);
        coin::register<AptosCoin>(charlie);

        coin::deposit(signer::address_of(alice), coin::mint(100_000_000, &mint_cap));
        coin::deposit(signer::address_of(bob), coin::mint(100_000_000, &mint_cap));
        coin::deposit(signer::address_of(charlie), coin::mint(100_000_000, &mint_cap));

        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);

        config::initialize(admin);
        vault::initialize(admin);
        auction::initialize_store(store_signer);
        nft::initialize_global(fair_auction);

        // Initialize collections for all users so they can hold NFTs
        nft::initialize_collection(alice);
        nft::initialize_collection(bob);
        nft::initialize_collection(charlie);
    }

    // =========================================================================
    // FEATURE 1: PROTOCOL CONFIGURATION & GUARDS
    // =========================================================================
    #[test(framework = @0x1, admin = @fair_auction, alice = @0xAAAA, bob = @0xBBBB, charlie = @0xCCCC, store_signer = @0x5708E, fair_auction = @fair_auction)]
    fun feature_protocol_config(
        framework: &signer, admin: &signer, alice: &signer, bob: &signer, charlie: &signer, store_signer: &signer, fair_auction: &signer
    ) {
        setup(framework, admin, alice, bob, charlie, store_signer, fair_auction);
        
        config::set_bid_fee(admin, 5_000_000);
        assert!(config::get_bid_fee(ADMIN) == 5_000_000, 1);
    }

    // =========================================================================
    // FEATURE 2: GLOBAL UNIQUE NFT REGISTRY
    // =========================================================================
    #[test(framework = @0x1, admin = @fair_auction, alice = @0xAAAA, bob = @0xBBBB, charlie = @0xCCCC, store_signer = @0x5708E, fair_auction = @fair_auction)]
    fun feature_nft_registry(
        framework: &signer, admin: &signer, alice: &signer, bob: &signer, charlie: &signer, store_signer: &signer, fair_auction: &signer
    ) {
        setup(framework, admin, alice, bob, charlie, store_signer, fair_auction);
        
        nft::mint_nft(alice, string::utf8(b"NFT 1"), string::utf8(b"D1"), string::utf8(b"U1"));
        nft::mint_nft(bob, string::utf8(b"NFT 2"), string::utf8(b"D2"), string::utf8(b"U2"));
        
        // Verify Unique IDs (NFT 1 is ID 0, NFT 2 is ID 1)
        assert!(nft::nft_exists(ALICE, 0), 2);
        assert!(nft::nft_exists(BOB, 1), 3); 
    }

    // =========================================================================
    // FEATURE 3: FORWARD AUCTION & AUTOMATIC SETTLEMENT
    // =========================================================================
    #[test(framework = @0x1, admin = @fair_auction, alice = @0xAAAA, bob = @0xBBBB, charlie = @0xCCCC, store_signer = @0x5708E, fair_auction = @fair_auction)]
    fun feature_forward_auction_flow(
        framework: &signer, admin: &signer, alice: &signer, bob: &signer, charlie: &signer, store_signer: &signer, fair_auction: &signer
    ) {
        setup(framework, admin, alice, bob, charlie, store_signer, fair_auction);
        nft::mint_nft(alice, string::utf8(b"Sale NFT"), string::utf8(b"D"), string::utf8(b"U"));
        
        auction::create_forward_auction(alice, STORE, ADMIN, 0, 1000, 3600, 500, 10, 20, 5, 120, 300);
        
        auction::place_bid(bob, STORE, 0, 2000);
        timestamp::fast_forward_seconds(15);
        auction::place_bid(charlie, STORE, 0, 3000);

        // Settle
        timestamp::fast_forward_seconds(3601);
        auction::settle_forward_auction(admin, STORE, 0);
        
        // NFT moved to Charlie
        assert!(nft::get_nft_count(CHARLIE) == 1, 5);
    }

    // =========================================================================
    // FEATURE 4: REVERSE AUCTION & VAULT ESCROW
    // =========================================================================
    #[test(framework = @0x1, admin = @fair_auction, alice = @0xAAAA, bob = @0xBBBB, charlie = @0xCCCC, store_signer = @0x5708E, fair_auction = @fair_auction)]
    fun feature_reverse_auction_flow(
        framework: &signer, admin: &signer, alice: &signer, bob: &signer, charlie: &signer, store_signer: &signer, fair_auction: &signer
    ) {
        setup(framework, admin, alice, bob, charlie, store_signer, fair_auction);
        
        auction::create_reverse_auction(alice, STORE, ADMIN, string::utf8(b"Logo Job"), 50000, 3600, 1000, 10, 20, 5, 120, 300);
        auction::place_reverse_bid(bob, STORE, 0, 40000);
        
        timestamp::fast_forward_seconds(3601);
        auction::settle_reverse_auction(admin, STORE, 0);
        
        assert!(coin::balance<AptosCoin>(BOB) > 100_000_000 - 2_000_000, 7); 
    }

    // =========================================================================
    // FEATURE 5: SPEED BUMP (TIME EXTENSION)
    // =========================================================================
    #[test(framework = @0x1, admin = @fair_auction, alice = @0xAAAA, bob = @0xBBBB, charlie = @0xCCCC, store_signer = @0x5708E, fair_auction = @fair_auction)]
    fun feature_speed_bump_logic(
        framework: &signer, admin: &signer, alice: &signer, bob: &signer, charlie: &signer, store_signer: &signer, fair_auction: &signer
    ) {
        setup(framework, admin, alice, bob, charlie, store_signer, fair_auction);
        nft::mint_nft(alice, string::utf8(b"NFT"), string::utf8(b"D"), string::utf8(b"U"));
        auction::create_forward_auction(alice, STORE, ADMIN, 0, 1000, 3600, 500, 10, 20, 5, 120, 300);
        
        timestamp::fast_forward_seconds(3500);
        let (_, _, _, _, _, _, end_before, _, _) = auction::get_auction_info(STORE, 0);
        
        auction::place_bid(bob, STORE, 0, 2000);
        
        let (_, _, _, _, _, _, end_after, _, _) = auction::get_auction_info(STORE, 0);
        assert!(end_after == end_before + 300, 8);
    }

    // =========================================================================
    // FEATURE 6: CANCELLATION & RECOVERY
    // =========================================================================
    #[test(framework = @0x1, admin = @fair_auction, alice = @0xAAAA, bob = @0xBBBB, charlie = @0xCCCC, store_signer = @0x5708E, fair_auction = @fair_auction)]
    fun feature_auction_cancellation(
        framework: &signer, admin: &signer, alice: &signer, bob: &signer, charlie: &signer, store_signer: &signer, fair_auction: &signer
    ) {
        setup(framework, admin, alice, bob, charlie, store_signer, fair_auction);
        nft::mint_nft(alice, string::utf8(b"NFT"), string::utf8(b"D"), string::utf8(b"U"));
        auction::create_forward_auction(alice, STORE, ADMIN, 0, 1000, 3600, 500, 10, 20, 5, 120, 300);
        
        auction::cancel_forward_auction(alice, STORE, 0);
        
        nft::transfer_nft(alice, BOB, 0);
        assert!(nft::get_nft_count(BOB) == 1, 9);
    }

    // =========================================================================
    // FEATURE 7: CONFIG NEGATIVE TESTS (ERROR HANDLING)
    // =========================================================================
    #[test(framework = @0x1, admin = @fair_auction, alice = @0xAAAA, bob = @0xBBBB, charlie = @0xCCCC, store_signer = @0x5708E, fair_auction = @fair_auction)]
    #[expected_failure(abort_code = 200, location = fair_auction::config)] // E_NOT_ADMIN
    fun feature_config_non_admin_fails(
        framework: &signer, admin: &signer, alice: &signer, bob: &signer, charlie: &signer, store_signer: &signer, fair_auction: &signer
    ) {
        setup(framework, admin, alice, bob, charlie, store_signer, fair_auction);
        config::set_bid_fee(alice, 10_000_000); // Alice is not admin
    }

    #[test(framework = @0x1, admin = @fair_auction, alice = @0xAAAA, bob = @0xBBBB, charlie = @0xCCCC, store_signer = @0x5708E, fair_auction = @fair_auction)]
    #[expected_failure(abort_code = 202, location = fair_auction::config)] // E_INVALID_PARAM
    fun feature_config_invalid_increment_fails(
        framework: &signer, admin: &signer, alice: &signer, bob: &signer, charlie: &signer, store_signer: &signer, fair_auction: &signer
    ) {
        setup(framework, admin, alice, bob, charlie, store_signer, fair_auction);
        config::set_increment_bounds(admin, 1000, 500); // min > max
    }

    #[test(framework = @0x1, admin = @fair_auction, alice = @0xAAAA, bob = @0xBBBB, charlie = @0xCCCC, store_signer = @0x5708E, fair_auction = @fair_auction)]
    fun feature_config_view_functions(
        framework: &signer, admin: &signer, alice: &signer, bob: &signer, charlie: &signer, store_signer: &signer, fair_auction: &signer
    ) {
        setup(framework, admin, alice, bob, charlie, store_signer, fair_auction);
        assert!(config::get_admin(ADMIN) == ADMIN, 10);
        assert!(config::get_bid_fee(ADMIN) == 1_000_000, 11);
    }
    #[test(framework = @0x1, admin = @fair_auction, alice = @0xAAAA, bob = @0xBBBB, charlie = @0xCCCC, store_signer = @0x5708E, fair_auction = @fair_auction)]
    #[expected_failure(abort_code = 201, location = fair_auction::config)] // E_ALREADY_INITIALIZED
    fun feature_config_double_init_fails(
        framework: &signer, admin: &signer, alice: &signer, bob: &signer, charlie: &signer, store_signer: &signer, fair_auction: &signer
    ) {
        setup(framework, admin, alice, bob, charlie, store_signer, fair_auction);
        config::initialize(admin); // Double init
    }

    #[test(framework = @0x1, admin = @fair_auction, alice = @0xAAAA, bob = @0xBBBB, charlie = @0xCCCC, store_signer = @0x5708E, fair_auction = @fair_auction)]
    fun feature_config_all_bounds_setters(
        framework: &signer, admin: &signer, alice: &signer, bob: &signer, charlie: &signer, store_signer: &signer, fair_auction: &signer
    ) {
        setup(framework, admin, alice, bob, charlie, store_signer, fair_auction);
        config::set_cooldown_bounds(admin, 10, 500);
        config::set_participation_bounds(admin, 5, 50, 2, 8);
        
    }
}
