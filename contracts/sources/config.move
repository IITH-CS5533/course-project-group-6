/// Admin Configuration Module
/// Stores and enforces system-wide parameters controllable only by the admin.
module fair_auction::config {
    use std::signer;

    friend fair_auction::auction;

    // ─── Errors ───────────────────────────────────────────────────────────────
    const E_NOT_ADMIN: u64              = 200;
    const E_ALREADY_INITIALIZED: u64    = 201;
    const E_INVALID_PARAM: u64          = 202;

    // ─── Config Resource ──────────────────────────────────────────────────────

    struct AdminConfig has key {
        admin: address,
        /// Maximum auction duration in seconds (e.g. 7 days)
        max_auction_duration: u64,
        /// Minimum bid increment as a percentage × 100  (e.g. 500 = 5%)
        min_bid_increment_bps: u64,
        /// Cooldown between bids by the same user in seconds
        bid_cooldown_seconds: u64,
        /// Fee per bid in octas (1 APT = 1e8 octas)
        bid_fee_octas: u64,
        /// Max bids a single user can place per auction (0 = unlimited)
        max_bids_per_user: u64,
        /// Maximum number of time extensions per auction
        max_extensions: u64,
        /// Speed-bump threshold in seconds (extend if bid placed within this window)
        speed_bump_seconds: u64,
        /// Extension amount in seconds when speed-bump triggers
        extension_seconds: u64,
    }

    // ─── Init ─────────────────────────────────────────────────────────────────

    public entry fun initialize(admin: &signer) {
        let addr = signer::address_of(admin);
        assert!(!exists<AdminConfig>(addr), E_ALREADY_INITIALIZED);
        move_to(admin, AdminConfig {
            admin: addr,
            max_auction_duration: 7 * 24 * 3600,  // 7 days
            min_bid_increment_bps: 500,             // 5%
            bid_cooldown_seconds: 10,
            bid_fee_octas: 1_000_000,               // 0.01 APT
            max_bids_per_user: 20,
            max_extensions: 5,
            speed_bump_seconds: 120,                // 2 minutes
            extension_seconds: 300,                 // 5 minutes
        });
    }

    // ─── Setters ─────────────────────────────────────────────────────────────

    public entry fun set_min_bid_increment(admin: &signer, bps: u64) acquires AdminConfig {
        let cfg = borrow_global_mut<AdminConfig>(signer::address_of(admin));
        assert!(signer::address_of(admin) == cfg.admin, E_NOT_ADMIN);
        assert!(bps > 0 && bps <= 10000, E_INVALID_PARAM);
        cfg.min_bid_increment_bps = bps;
    }

    public entry fun set_bid_cooldown(admin: &signer, seconds: u64) acquires AdminConfig {
        let cfg = borrow_global_mut<AdminConfig>(signer::address_of(admin));
        assert!(signer::address_of(admin) == cfg.admin, E_NOT_ADMIN);
        cfg.bid_cooldown_seconds = seconds;
    }

    public entry fun set_bid_fee(admin: &signer, octas: u64) acquires AdminConfig {
        let cfg = borrow_global_mut<AdminConfig>(signer::address_of(admin));
        assert!(signer::address_of(admin) == cfg.admin, E_NOT_ADMIN);
        cfg.bid_fee_octas = octas;
    }

    public entry fun set_speed_bump(admin: &signer, threshold_secs: u64, extension_secs: u64) acquires AdminConfig {
        let cfg = borrow_global_mut<AdminConfig>(signer::address_of(admin));
        assert!(signer::address_of(admin) == cfg.admin, E_NOT_ADMIN);
        cfg.speed_bump_seconds = threshold_secs;
        cfg.extension_seconds = extension_secs;
    }

    // ─── Getters (friend-accessible) ──────────────────────────────────────────

    public(friend) fun get_config(admin: address): (u64, u64, u64, u64, u64, u64, u64, u64) acquires AdminConfig {
        let cfg = borrow_global<AdminConfig>(admin);
        (
            cfg.max_auction_duration,
            cfg.min_bid_increment_bps,
            cfg.bid_cooldown_seconds,
            cfg.bid_fee_octas,
            cfg.max_bids_per_user,
            cfg.max_extensions,
            cfg.speed_bump_seconds,
            cfg.extension_seconds,
        )
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    #[view]
    public fun get_admin(admin: address): address acquires AdminConfig {
        borrow_global<AdminConfig>(admin).admin
    }

    #[view]
    public fun get_min_bid_increment_bps(admin: address): u64 acquires AdminConfig {
        borrow_global<AdminConfig>(admin).min_bid_increment_bps
    }

    #[view]
    public fun get_bid_cooldown(admin: address): u64 acquires AdminConfig {
        borrow_global<AdminConfig>(admin).bid_cooldown_seconds
    }

    #[view]
    public fun get_bid_fee(admin: address): u64 acquires AdminConfig {
        borrow_global<AdminConfig>(admin).bid_fee_octas
    }

    #[view]
    public fun get_speed_bump(admin: address): (u64, u64) acquires AdminConfig {
        let cfg = borrow_global<AdminConfig>(admin);
        (cfg.speed_bump_seconds, cfg.extension_seconds)
    }

    #[view]
    public fun get_max_extensions(admin: address): u64 acquires AdminConfig {
        borrow_global<AdminConfig>(admin).max_extensions
    }
}
