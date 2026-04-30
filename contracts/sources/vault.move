/// Vault Module – Digital Vault using Resource Accounts
/// Securely holds NFTs and fungible tokens during auctions.
/// Only the auction module can instruct fund/NFT movement.
module fair_auction::vault {
    use std::signer;
    use aptos_framework::account::{Self, SignerCapability};
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::coin;
    friend fair_auction::auction;

    // ─── Errors ───────────────────────────────────────────────────────────────
    const E_VAULT_NOT_INITIALIZED: u64 = 100;
    const E_ALREADY_INITIALIZED: u64   = 101;
    const E_INSUFFICIENT_FUNDS: u64    = 102;
    const E_UNAUTHORIZED: u64          = 103;

    // ─── Structs ─────────────────────────────────────────────────────────────

    /// Resource stored at the vault's resource account address.
    struct Vault has key {
        signer_cap: SignerCapability,
    }

    /// Stores the vault resource-account address at the admin's account.
    struct VaultRef has key {
        vault_address: address,
    }

    // ─── Init ─────────────────────────────────────────────────────────────────

    /// Creates the vault resource account.  Called once by admin.
    public entry fun initialize(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        assert!(!exists<VaultRef>(admin_addr), E_ALREADY_INITIALIZED);

        let (vault_signer, signer_cap) = account::create_resource_account(admin, b"fair_auction_vault");
        let vault_addr = signer::address_of(&vault_signer);

        // Register vault for AptosCoin
        coin::register<AptosCoin>(&vault_signer);

        move_to(&vault_signer, Vault { signer_cap });
        move_to(admin, VaultRef { vault_address: vault_addr });
    }

    // ─── Fund Operations ──────────────────────────────────────────────────────

    /// Deposits APT coins into the vault on behalf of a bidder.
    public(friend) fun deposit_coins(
        depositor: &signer,
        amount: u64,
        vault_addr: address,
    ) {
        let coins = coin::withdraw<AptosCoin>(depositor, amount);
        coin::deposit<AptosCoin>(vault_addr, coins);
    }

    /// Withdraws APT coins from vault to a recipient.
    public(friend) fun withdraw_coins(
        vault_addr: address,
        recipient: address,
        amount: u64,
    ) acquires Vault {
        let vault = borrow_global<Vault>(vault_addr);
        let vault_signer = account::create_signer_with_capability(&vault.signer_cap);
        let coins = coin::withdraw<AptosCoin>(&vault_signer, amount);
        coin::deposit<AptosCoin>(recipient, coins);
    }

    // ─── NFT Operations ───────────────────────────────────────────────────────

    // Returns the vault address stored in admin's VaultRef.
    #[view]
    public fun get_vault_address(admin: address): address acquires VaultRef {
        assert!(exists<VaultRef>(admin), E_VAULT_NOT_INITIALIZED);
        borrow_global<VaultRef>(admin).vault_address
    }

    #[view]
    public fun vault_balance(vault_addr: address): u64 {
        coin::balance<AptosCoin>(vault_addr)
    }
}
