#[test_only]
module fair_auction::nft_tests {
    use std::string;
    use std::signer;
    use aptos_framework::account;
    use aptos_framework::timestamp;
    use fair_auction::nft;

    // We can define test addresses directly in the #[test] annotation
    #[test(aptos_framework = @0x1, alice = @0xAAAA, bob = @0xBBBB, fair_auction = @fair_auction)]
    fun test_mint_and_transfer_nft(aptos_framework: &signer, alice: &signer, bob: &signer, fair_auction: &signer) {
        // Set up framework time module which the NFT module depends on
        timestamp::set_time_has_started_for_testing(aptos_framework);

        // Set up test accounts with the Aptos framework
        account::create_account_for_test(signer::address_of(alice));
        account::create_account_for_test(signer::address_of(bob));
        account::create_account_for_test(signer::address_of(fair_auction));

        nft::initialize_global(fair_auction);

        let alice_addr = signer::address_of(alice);
        let bob_addr = signer::address_of(bob);

        // 1. MINTING A NEW NFT
        let nft_name = string::utf8(b"Aptos Test NFT");
        let nft_desc = string::utf8(b"This is an NFT created during testing.");
        let nft_url = string::utf8(b"https://example.com/nft.png");

        nft::mint_nft(alice, nft_name, nft_desc, nft_url);

        // 2. VERIFY MINT
        assert!(nft::get_nft_count(alice_addr) == 1, 0); 
        assert!(nft::nft_exists(alice_addr, 0), 1);     

        let (fetched_name, _, _, _, _, _) = nft::get_nft_info(alice_addr, 0);
        assert!(fetched_name == string::utf8(b"Aptos Test NFT"), 2);

        // 3. TRANSFER THE NFT
        nft::initialize_collection(bob);
        nft::transfer_nft(alice, bob_addr, 0);

        // 4. VERIFY TRANSFER
        assert!(nft::get_nft_count(alice_addr) == 0, 3);
        assert!(nft::get_nft_count(bob_addr) == 1, 4);
        assert!(nft::nft_exists(bob_addr, 0), 5);
    }

    #[test(alice = @0xAAAA, fair_auction = @fair_auction)]
    #[expected_failure(abort_code = fair_auction::nft::E_EMPTY_NAME)]
    fun test_minting_requires_name(alice: &signer, fair_auction: &signer) {
        account::create_account_for_test(signer::address_of(alice));
        account::create_account_for_test(signer::address_of(fair_auction));
        nft::initialize_global(fair_auction);
        
        nft::mint_nft(
            alice, 
            string::utf8(b""), 
            string::utf8(b"desc"), 
            string::utf8(b"url")
        );
    }
}
