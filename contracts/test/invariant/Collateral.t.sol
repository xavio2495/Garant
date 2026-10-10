// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {OutcomeSeries} from "../../src/OutcomeSeries.sol";
import {OutcomeToken} from "../../src/OutcomeToken.sol";
import {Series, Kind, State} from "../../src/interfaces/IOutcomeSeries.sol";
import {MockAUSD} from "../mocks/MockAUSD.sol";

/// @dev Random mint / redeemSet / transfer / settle / void / redeem sequences over two series.
contract Handler is Test {
    OutcomeSeries public os;
    MockAUSD public ausd;
    address public resolver;
    address[3] public actors;

    uint256 public ghostIn;
    uint256 public ghostOut;
    mapping(uint256 => uint256) public settleCount;

    constructor(OutcomeSeries os_, MockAUSD ausd_, address resolver_) {
        os = os_;
        ausd = ausd_;
        resolver = resolver_;
        for (uint256 i; i < 3; i++) {
            actors[i] = makeAddr(string.concat("actor", vm.toString(i)));
            vm.prank(actors[i]);
            ausd.approve(address(os), type(uint256).max);
        }
    }

    function _s(uint256 seed) internal view returns (uint256 id, Series memory s) {
        id = seed % os.seriesCount();
        s = os.series(id);
    }

    function mint(uint256 a, uint256 seed, uint256 amount) external {
        (uint256 id, Series memory s) = _s(seed);
        if (s.state != State.OPEN || block.timestamp >= s.expiry) return;
        address who = actors[a % 3];
        amount = bound(amount, 1, 1e12);
        ausd.mint(who, amount);
        vm.prank(who);
        os.mint(id, amount, who);
        ghostIn += amount;
    }

    function redeemSet(uint256 a, uint256 seed, uint256 amount) external {
        (uint256 id, Series memory s) = _s(seed);
        address who = actors[a % 3];
        uint256 p = OutcomeToken(s.protect).balanceOf(who);
        uint256 b = OutcomeToken(s.back).balanceOf(who);
        uint256 max = p < b ? p : b;
        if (max == 0) return;
        amount = bound(amount, 1, max);
        vm.prank(who);
        os.redeemSet(id, amount, who);
        ghostOut += amount;
    }

    function transfer(uint256 a, uint256 to, uint256 seed, bool protect, uint256 amount) external {
        (, Series memory s) = _s(seed);
        address who = actors[a % 3];
        OutcomeToken t = OutcomeToken(protect ? s.protect : s.back);
        uint256 bal = t.balanceOf(who);
        if (bal == 0) return;
        vm.prank(who);
        t.transfer(actors[to % 3], bound(amount, 1, bal));
    }

    function warp(uint256 dt) external {
        vm.warp(block.timestamp + bound(dt, 1, 3 days));
    }

    function settle(uint256 seed, uint256 payout) external {
        (uint256 id, Series memory s) = _s(seed);
        if (s.state != State.OPEN || block.timestamp < s.expiry) return;
        vm.prank(resolver);
        os.settle(id, bound(payout, 0, 1e18), 0, 0);
        settleCount[id]++;
    }

    function voidExpired(uint256 seed) external {
        (uint256 id, Series memory s) = _s(seed);
        if (s.state != State.OPEN || block.timestamp < s.expiry + 7 days) return;
        os.voidExpired(id);
    }

    function redeem(uint256 a, uint256 seed) external {
        (uint256 id, Series memory s) = _s(seed);
        address who = actors[a % 3];
        if (s.state == State.OPEN) return;
        if (OutcomeToken(s.protect).balanceOf(who) + OutcomeToken(s.back).balanceOf(who) == 0) return;
        uint256 before = ausd.balanceOf(who);
        vm.prank(who);
        os.redeem(id, who);
        ghostOut += ausd.balanceOf(who) - before;
    }

    function claimOf(uint256 id, address who) public view returns (uint256) {
        Series memory s = os.series(id);
        uint256 p = OutcomeToken(s.protect).balanceOf(who);
        uint256 b = OutcomeToken(s.back).balanceOf(who);
        if (s.state == State.OPEN) return p < b ? p : b; // only complete sets are claimable while open
        uint256 sets = p < b ? p : b;
        return sets + ((p - sets) * s.payout) / 1e18 + ((b - sets) * (1e18 - s.payout)) / 1e18;
    }
}

contract CollateralInvariantTest is Test {
    OutcomeSeries os;
    MockAUSD ausd;
    Handler h;

    function setUp() public {
        ausd = new MockAUSD();
        os = new OutcomeSeries(address(ausd), address(this));
        address resolver = makeAddr("resolver");
        os.createSeries(Kind.FX_FLOOR, resolver, bytes32("a"), 58e8, 55e8, uint64(block.timestamp + 2 days), "A");
        os.createSeries(Kind.BINARY, resolver, bytes32("b"), 1250, 0, uint64(block.timestamp + 5 days), "B");
        h = new Handler(os, ausd, resolver);
        targetContract(address(h));
    }

    // invariant 1: AUSD held equals minted minus paid out, and covers every holder's claim
    function invariant_collateralCoversClaims() public view {
        uint256 held = ausd.balanceOf(address(os));
        assertEq(held, h.ghostIn() - h.ghostOut());

        uint256 claims;
        for (uint256 id; id < os.seriesCount(); id++) {
            Series memory s = os.series(id);
            if (s.state == State.OPEN) {
                // while open every outstanding PROTECT is matched by a BACK
                assertEq(OutcomeToken(s.protect).totalSupply(), OutcomeToken(s.back).totalSupply());
                claims += OutcomeToken(s.protect).totalSupply();
                continue;
            }
            for (uint256 i; i < 3; i++) claims += h.claimOf(id, h.actors(i));
        }
        assertGe(held, claims);
    }

    // invariant 2: payout within range, settled at most once
    function invariant_payoutBoundedAndSettledOnce() public view {
        for (uint256 id; id < os.seriesCount(); id++) {
            assertLe(os.series(id).payout, 1e18);
            assertLe(h.settleCount(id), 1);
        }
    }
}
