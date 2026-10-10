// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {OutcomeSeries} from "../src/OutcomeSeries.sol";
import {OutcomeToken} from "../src/OutcomeToken.sol";
import {Series, Kind, State} from "../src/interfaces/IOutcomeSeries.sol";
import {MockAUSD} from "./mocks/MockAUSD.sol";

contract OutcomeSeriesTest is Test {
    OutcomeSeries os;
    MockAUSD ausd;
    address resolver = makeAddr("resolver");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    uint64 expiry;
    uint256 id;

    function setUp() public {
        ausd = new MockAUSD();
        os = new OutcomeSeries(address(ausd), address(this));
        expiry = uint64(block.timestamp + 1 days);
        id = os.createSeries(Kind.FX_FLOOR, resolver, bytes32("php"), 58e8, 55e8, expiry, "USD/PHP 58");
        ausd.mint(alice, 1_000e6);
        vm.prank(alice);
        ausd.approve(address(os), type(uint256).max);
    }

    function _mint(uint256 amount) internal {
        vm.prank(alice);
        os.mint(id, amount, alice);
    }

    function test_createSeries_storesFields() public view {
        Series memory s = os.series(id);
        assertEq(uint8(s.kind), uint8(Kind.FX_FLOOR));
        assertEq(uint8(s.state), uint8(State.OPEN));
        assertEq(s.resolver, resolver);
        assertEq(s.strike, 58e8);
        assertEq(s.lower, 55e8);
        assertEq(s.expiry, expiry);
        assertEq(OutcomeToken(s.protect).name(), "USD/PHP 58 PROTECT");
        assertEq(OutcomeToken(s.back).name(), "USD/PHP 58 BACK");
        assertEq(OutcomeToken(s.protect).decimals(), 6);
        assertEq(os.seriesCount(), 1);
        assertEq(os.ausd(), address(ausd));
    }

    function test_createSeries_rejectsBadParams() public {
        vm.expectRevert(OutcomeSeries.BadParams.selector);
        os.createSeries(Kind.FX_FLOOR, resolver, 0, 55e8, 58e8, expiry, "x"); // L >= K
        vm.expectRevert(OutcomeSeries.BadParams.selector);
        os.createSeries(Kind.BINARY, resolver, 0, 1250, 1, expiry, "x"); // BINARY lower != 0
        vm.expectRevert(OutcomeSeries.BadParams.selector);
        os.createSeries(Kind.BINARY, resolver, 0, 1250, 0, uint64(block.timestamp), "x"); // expiry not in future
        vm.expectRevert(OutcomeSeries.BadParams.selector);
        os.createSeries(Kind.BINARY, address(0), 0, 1250, 0, expiry, "x");
    }

    function test_adminOnly() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        os.createSeries(Kind.BINARY, resolver, 0, 1250, 0, expiry, "x");
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        os.setMarket(id, alice);
        vm.stopPrank();
        os.setMarket(id, bob);
        assertEq(os.series(id).market, bob);
    }

    function test_tokensOnlyMintableByIssuer() public {
        OutcomeToken t = OutcomeToken(os.series(id).protect);
        vm.expectRevert(OutcomeToken.OnlyIssuer.selector);
        t.mint(alice, 1);
        vm.expectRevert(OutcomeToken.OnlyIssuer.selector);
        t.burn(alice, 1);
    }

    function test_mint_locksCollateral() public {
        _mint(100e6);
        Series memory s = os.series(id);
        assertEq(ausd.balanceOf(address(os)), 100e6);
        assertEq(OutcomeToken(s.protect).balanceOf(alice), 100e6);
        assertEq(OutcomeToken(s.back).balanceOf(alice), 100e6);
    }

    function test_mint_rejectsAtExpiryAndZero() public {
        vm.expectRevert(OutcomeSeries.ZeroAmount.selector);
        _mint(0);
        vm.warp(expiry);
        vm.expectRevert(OutcomeSeries.Expired.selector);
        _mint(1e6);
    }

    // invariant 3: redeemSet always allowed, including after resolution and void
    function test_redeemSet_alwaysAllowed() public {
        _mint(100e6);
        vm.prank(alice);
        os.redeemSet(id, 10e6, bob);
        assertEq(ausd.balanceOf(bob), 10e6);

        vm.warp(expiry);
        vm.prank(resolver);
        os.settle(id, 0.3e18, 56e8, expiry);
        vm.prank(alice);
        os.redeemSet(id, 10e6, bob);
        assertEq(ausd.balanceOf(bob), 20e6);
    }

    // invariant 3: no redeem before resolution or void
    function test_redeem_revertsWhileOpen() public {
        _mint(100e6);
        vm.prank(alice);
        vm.expectRevert(OutcomeSeries.NotSettled.selector);
        os.redeem(id, alice);
        vm.warp(expiry + 1 days);
        vm.prank(alice);
        vm.expectRevert(OutcomeSeries.NotSettled.selector);
        os.redeem(id, alice);
    }

    // invariant 2: only the series resolver, only once, only after expiry, payout <= 1e18
    function test_settle_guards() public {
        vm.expectRevert(OutcomeSeries.OnlyResolver.selector);
        os.settle(id, 1e18, 0, 0);

        vm.startPrank(resolver);
        vm.expectRevert(OutcomeSeries.NotExpired.selector);
        os.settle(id, 1e18, 0, 0);
        vm.warp(expiry);
        vm.expectRevert(OutcomeSeries.BadParams.selector);
        os.settle(id, 1e18 + 1, 0, 0);
        os.settle(id, 1e18, 54e8, expiry);
        vm.expectRevert(OutcomeSeries.NotOpen.selector);
        os.settle(id, 0, 0, 0);
        vm.expectRevert(OutcomeSeries.NotOpen.selector);
        os.voidByResolver(id);
        vm.stopPrank();

        assertEq(os.series(id).payout, 1e18);
        assertEq(uint8(os.series(id).state), uint8(State.RESOLVED));
    }

    function test_redeem_paysBothSides() public {
        _mint(100e6);
        Series memory s = os.series(id);
        vm.prank(alice);
        OutcomeToken(s.protect).transfer(bob, 100e6);

        vm.warp(expiry);
        vm.prank(resolver);
        os.settle(id, 0.25e18, 0, 0);

        vm.prank(bob);
        os.redeem(id, bob);
        vm.prank(alice);
        os.redeem(id, alice);
        assertEq(ausd.balanceOf(bob), 25e6);
        assertEq(ausd.balanceOf(alice), 1_000e6 - 100e6 + 75e6);
        assertEq(ausd.balanceOf(address(os)), 0);
        assertEq(OutcomeToken(s.protect).totalSupply(), 0);
        assertEq(OutcomeToken(s.back).totalSupply(), 0);

        vm.prank(alice);
        vm.expectRevert(OutcomeSeries.ZeroAmount.selector);
        os.redeem(id, alice);
    }

    // invariant 4: void redeems a complete set at exactly 1
    function test_voidExpired_setRedeemsAtOne() public {
        _mint(100e6);
        vm.warp(expiry + 7 days - 1);
        vm.expectRevert(OutcomeSeries.NotExpired.selector);
        os.voidExpired(id);
        vm.warp(expiry + 7 days);
        os.voidExpired(id);
        assertEq(uint8(os.series(id).state), uint8(State.VOIDED));
        assertEq(os.series(id).payout, 0.5e18);
        vm.expectRevert(OutcomeSeries.NotOpen.selector);
        os.voidExpired(id);

        vm.prank(alice);
        os.redeem(id, alice);
        assertEq(ausd.balanceOf(alice), 1_000e6);
    }

    function test_voidByResolver() public {
        _mint(10e6);
        vm.prank(alice);
        vm.expectRevert(OutcomeSeries.OnlyResolver.selector);
        os.voidByResolver(id);
        vm.warp(expiry);
        vm.prank(resolver);
        os.voidByResolver(id);
        vm.prank(alice);
        os.redeem(id, alice);
        assertEq(ausd.balanceOf(alice), 1_000e6);
    }

    function testFuzz_redeemConservesCollateral(uint256 payout, uint96 a, uint96 b) public {
        payout = bound(payout, 0, 1e18);
        uint256 total = uint256(a) + b;
        vm.assume(total > 0);
        ausd.mint(alice, total);
        _mint(total);
        Series memory s = os.series(id);
        vm.startPrank(alice);
        OutcomeToken(s.protect).transfer(bob, a);
        OutcomeToken(s.back).transfer(bob, b);
        vm.stopPrank();

        vm.warp(expiry);
        vm.prank(resolver);
        os.settle(id, payout, 0, 0);
        vm.prank(alice);
        os.redeem(id, alice);
        vm.prank(bob);
        os.redeem(id, bob);
        // each holder rounds down at most 1 unit per leg
        assertLe(ausd.balanceOf(address(os)), 4);
        assertGe(ausd.balanceOf(alice) + ausd.balanceOf(bob), 1_000e6 + total - 4);
    }
}
