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
        bid_fee_octas: u64,
        
        // Allowed Ranges (Protocol Guards)
        min_bid_inc_bps: u64, // For Forward Auctions
        max_bid_inc_bps: u64,
        
        min_bid_dec_bps: u64, // For Reverse Auctions
        max_bid_dec_bps: u64,
        
        min_cooldown_sec: u64,
        max_cooldown_sec: u64,
        
        min_max_bids: u64,
        max_max_bids: u64,
        
        min_max_ext: u64,
        max_max_ext: u64,
        
        min_speed_bump_sec: u64,
        max_speed_bump_sec: u64,
        
        min_ext_sec: u64,
        max_ext_sec: u64,
    }

    // ─── Init ─────────────────────────────────────────────────────────────────

    public entry fun initialize(admin: &signer) {
        let addr = signer::address_of(admin);
        assert!(!exists<AdminConfig>(addr), E_ALREADY_INITIALIZED);
        move_to(admin, AdminConfig {
            admin: addr,
            bid_fee_octas: 1_000_000, // 0.01 APT
            
            min_bid_inc_bps: 100,     // 1%
            max_bid_inc_bps: 2000,    // 20%
            
            min_bid_dec_bps: 100,     // 1%
            max_bid_dec_bps: 2000,    // 20%
            
            min_cooldown_sec: 5,
            max_cooldown_sec: 3600,   // 1 hour
            
            min_max_bids: 1,
            max_max_bids: 100,
            
            min_max_ext: 0,
            max_max_ext: 50,
            
            min_speed_bump_sec: 30,
            max_speed_bump_sec: 3600,
            
            min_ext_sec: 60,
            max_ext_sec: 3600,
        });
    }

    // ─── Setters ─────────────────────────────────────────────────────────────

    public entry fun set_bid_fee(admin: &signer, octas: u64) acquires AdminConfig {
        let addr = signer::address_of(admin);
        let cfg = borrow_global_mut<AdminConfig>(@fair_auction);
        assert!(addr == cfg.admin, E_NOT_ADMIN);
        cfg.bid_fee_octas = octas;
    }

    public entry fun set_increment_bounds(admin: &signer, min: u64, max: u64) acquires AdminConfig {
        let addr = signer::address_of(admin);
        let cfg = borrow_global_mut<AdminConfig>(@fair_auction);
        assert!(addr == cfg.admin, E_NOT_ADMIN);
        assert!(min > 0 && min <= max && max <= 10000, E_INVALID_PARAM);
        cfg.min_bid_inc_bps = min;
        cfg.max_bid_inc_bps = max;
    }

    public entry fun set_decrement_bounds(admin: &signer, min: u64, max: u64) acquires AdminConfig {
        let addr = signer::address_of(admin);
        let cfg = borrow_global_mut<AdminConfig>(@fair_auction);
        assert!(addr == cfg.admin, E_NOT_ADMIN);
        assert!(min > 0 && min <= max && max <= 10000, E_INVALID_PARAM);
        cfg.min_bid_dec_bps = min;
        cfg.max_bid_dec_bps = max;
    }

    public entry fun set_cooldown_bounds(admin: &signer, min: u64, max: u64) acquires AdminConfig {
        let addr = signer::address_of(admin);
        let cfg = borrow_global_mut<AdminConfig>(@fair_auction);
        assert!(addr == cfg.admin, E_NOT_ADMIN);
        assert!(min <= max, E_INVALID_PARAM);
        cfg.min_cooldown_sec = min;
        cfg.max_cooldown_sec = max;
    }

    public entry fun set_participation_bounds(admin: &signer, min_bids: u64, max_bids: u64, min_ext: u64, max_ext: u64) acquires AdminConfig {
        let addr = signer::address_of(admin);
        let cfg = borrow_global_mut<AdminConfig>(@fair_auction);
        assert!(addr == cfg.admin, E_NOT_ADMIN);
        assert!(min_bids <= max_bids && min_ext <= max_ext, E_INVALID_PARAM);
        cfg.min_max_bids = min_bids;
        cfg.max_max_bids = max_bids;
        cfg.min_max_ext = min_ext;
        cfg.max_max_ext = max_ext;
    }

    // ─── Getters (friend-accessible) ──────────────────────────────────────────

    public(friend) fun get_protocol_bounds(admin_addr: address): (u64, u64, u64, u64, u64, u64, u64, u64, u64, u64, u64, u64, u64, u64, u64) acquires AdminConfig {
        let cfg = borrow_global<AdminConfig>(admin_addr);
        (
            cfg.bid_fee_octas,
            cfg.min_bid_inc_bps, cfg.max_bid_inc_bps,
            cfg.min_bid_dec_bps, cfg.max_bid_dec_bps,
            cfg.min_cooldown_sec, cfg.max_cooldown_sec,
            cfg.min_max_bids, cfg.max_max_bids,
            cfg.min_max_ext, cfg.max_max_ext,
            cfg.min_speed_bump_sec, cfg.max_speed_bump_sec,
            cfg.min_ext_sec, cfg.max_ext_sec
        )
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    #[view]
    public fun get_admin(admin: address): address acquires AdminConfig {
        borrow_global<AdminConfig>(admin).admin
    }

    #[view]
    public fun get_bid_fee(admin: address): u64 acquires AdminConfig {
        borrow_global<AdminConfig>(admin).bid_fee_octas
    }
}
