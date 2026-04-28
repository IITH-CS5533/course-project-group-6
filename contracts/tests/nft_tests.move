#[test_only]
module fair_auction::nft_tests {
    use std::string;
    use std::signer;
    use aptos_framework::account;
    use aptos_framework::timestamp;
    use fair_auction::nft;

    // We can define test addresses directly in the #[test] annotation
    #[test(aptos_framework = @0x1, alice = @0xA11CE, bob = @0x130B)]
    fun test_mint_and_transfer_nft(aptos_framework: &signer, alice: &signer, bob: &signer) {
        // Set up framework time module which the NFT module depends on
        timestamp::set_time_has_started_for_testing(aptos_framework);

        // Set up test accounts with the Aptos framework
        account::create_account_for_test(signer::address_of(alice));
        account::create_account_for_test(signer::address_of(bob));

        let alice_addr = signer::address_of(alice);
        let bob_addr = signer::address_of(bob);

        // 1. MINTING A NEW NFT
        // We define the string metadata for the NFT
        let nft_name = string::utf8(b"Aptos Test NFT");
        let nft_desc = string::utf8(b"This is an NFT created during testing.");
        let nft_url = string::utf8(b"https://example.com/nft.png");

        // Mint the NFT. (This will also auto-initialize Alice's collection because 
        // mint_nft in your code has that built-in safety check!)
        nft::mint_nft(alice, nft_name, nft_desc, nft_url);

        // 2. VERIFY MINT
        // Let's check that Alice now has exactly 1 NFT
        assert!(nft::get_nft_count(alice_addr) == 1, 0); // test fails with code 0 if false
        assert!(nft::nft_exists(alice_addr, 0), 1);     // test fails with code 1 if false

        // Fetch the NFT info and assert the spelling matches exactly
        let (fetched_name, _, _, _, _, _) = nft::get_nft_info(alice_addr, 0);
        assert!(fetched_name == string::utf8(b"Aptos Test NFT"), 2);


        // 3. TRANSFER THE NFT
        // According to your contract logic, the receiver must have an initialized collection 
        // before you can transfer an NFT into it.
        nft::initialize_collection(bob);
        
        // Alice transfers NFT with ID 0 to Bob
        nft::transfer_nft(alice, bob_addr, 0);


        // 4. VERIFY TRANSFER
        // Alice should now have 0 NFTs, and Bob should have 1
        assert!(nft::get_nft_count(alice_addr) == 0, 3);
        assert!(nft::get_nft_count(bob_addr) == 1, 4);

        // Verify that Bob actually owns NFT 0
        assert!(nft::nft_exists(bob_addr, 0), 5);
    }

    #[test(alice = @0xA11CE)]
    #[expected_failure(abort_code = fair_auction::nft::E_EMPTY_NAME)]
    fun test_minting_requires_name(alice: &signer) {
        account::create_account_for_test(signer::address_of(alice));
        
        // This should intentionally throw an error because we supplied an empty name!
        nft::mint_nft(
            alice, 
            string::utf8(b""), 
            string::utf8(b"desc"), 
            string::utf8(b"url")
        );
    }
}
