// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {OutcomeSeries} from "../src/OutcomeSeries.sol";
import {CREFxResolver} from "../src/resolvers/CREFxResolver.sol";
import {IReceiver} from "../src/resolvers/CREResolver.sol";
import {Series, Kind, State} from "../src/interfaces/IOutcomeSeries.sol";
import {MockAUSD} from "./mocks/MockAUSD.sol";

contract CREFxResolverTest is Test {
    bytes32 constant PAIR = bytes32("USD/PHP");
    uint32 constant DAY = 20261009;
    int64 constant K = 62_50000000;
    int64 constant L = 60_00000000;
    uint64 constant WINDOW = 600;

    OutcomeSeries os;
    CREFxResolver fx;
    address forwarder = makeAddr("forwarder");
    address guardian = makeAddr("guardian");
    uint64 expiry;
    uint256 id;

    function setUp() public {
        os = new OutcomeSeries(address(new MockAUSD()), address(this));
        fx = new CREFxResolver(os, forwarder, guardian, WINDOW, 50, address(this));
        expiry = uint64(block.timestamp + 1 hours);
        id = os.createSeries(Kind.FX_FLOOR, address(fx), keccak256(abi.encode(PAIR, DAY)), K, L, expiry, "USD/PHP 62.50");
        fx.register(id, PAIR, DAY);
    }

    function _report(uint8 outcome, int64 a, int64 b) internal {
        vm.prank(forwarder);
        fx.onReport("", abi.encode(id, outcome, a, b));
    }

    function _settleWith(int64 a, int64 b) internal returns (Series memory) {
        vm.warp(expiry);
        _report(0, a, b);
        vm.warp(expiry + WINDOW);
        fx.finalize(id);
        return os.series(id);
    }

    function test_register() public {
        (bytes32 pair, uint32 day, bool reg) = fx.spec(id);
        assertEq(pair, PAIR);
        assertEq(day, DAY);
        assertTrue(reg);

        vm.expectRevert(CREFxResolver.AlreadyRegistered.selector);
        fx.register(id, PAIR, DAY);

        uint256 other = os.createSeries(Kind.FX_FLOOR, address(fx), bytes32("x"), K, L, expiry, "x");
        vm.expectRevert(CREFxResolver.RefMismatch.selector);
        fx.register(other, PAIR, DAY);

        uint256 bin = os.createSeries(Kind.BINARY, address(fx), keccak256(abi.encode(PAIR, DAY)), 1, 0, expiry, "x");
        vm.expectRevert(CREFxResolver.NotFxSeries.selector);
        fx.register(bin, PAIR, DAY);

        vm.prank(guardian);
        vm.expectRevert();
        fx.register(other, PAIR, DAY);
    }

    function test_supportsReceiverInterface() public view {
        assertTrue(fx.supportsInterface(0x805f2132));
        assertTrue(fx.supportsInterface(type(IReceiver).interfaceId));
        assertTrue(fx.supportsInterface(0x01ffc9a7));
        assertFalse(fx.supportsInterface(0xffffffff));
    }

    function test_rejectsNonForwarder() public {
        vm.warp(expiry);
        vm.expectRevert(CREFxResolver.OnlyForwarder.selector);
        fx.onReport("", abi.encode(id, uint8(0), int64(62e8), int64(62e8)));
    }

    function test_rejectsBeforeExpiry() public {
        vm.expectRevert(CREFxResolver.NotExpired.selector);
        _report(0, 62e8, 62e8);
    }

    function test_rejectsBadOutcomeAndRates() public {
        vm.warp(expiry);
        vm.expectRevert(CREFxResolver.BadOutcome.selector);
        _report(1, 62e8, 62e8);
        vm.expectRevert(CREFxResolver.BadOutcome.selector);
        _report(0, 0, 62e8);
        vm.expectRevert(CREFxResolver.BadOutcome.selector);
        _report(0, 62e8, -1);
    }

    function test_rejectsDoubleReport() public {
        vm.warp(expiry);
        _report(0, 62_82100000, 62_79000000);
        vm.expectRevert(CREFxResolver.AlreadyReported.selector);
        _report(2, 0, 0);
    }

    // 2026-10-09 fixings: A 62.821, B 62.790 -> mid 62.8055 >= K 62.50 -> payout 0
    function test_realFixing_strike6250_paysZero() public {
        Series memory s = _settleWith(62_82100000, 62_79000000);
        assertEq(uint8(s.state), uint8(State.RESOLVED));
        assertEq(s.payout, 0);
    }

    // K 63.00: (63 - 62.8055) / 3 = 0.06483...
    function test_realFixing_strike6300_paysAboutSixPercent() public {
        uint256 id63 = os.createSeries(Kind.FX_FLOOR, address(fx), keccak256(abi.encode(PAIR, DAY)), 63e8, L, expiry, "x");
        fx.register(id63, PAIR, DAY);
        vm.warp(expiry);
        vm.prank(forwarder);
        fx.onReport("", abi.encode(id63, uint8(0), int64(62_82100000), int64(62_79000000)));
        vm.warp(expiry + WINDOW);
        fx.finalize(id63);
        assertEq(os.series(id63).payout, (uint256(63e8 - 62_80550000) * 1e18) / 3e8);
    }

    function test_belowLower_paysOne() public {
        assertEq(_settleWith(59e8, 59e8).payout, 1e18);
    }

    function test_emitsMidAsObserved() public {
        vm.warp(expiry);
        _report(0, 61_00000000, 61_10000000);
        vm.warp(expiry + WINDOW);
        vm.expectEmit(address(os));
        emit Resolved(id, (uint256(int256(K - 61_05000000)) * 1e18) / uint256(int256(K - L)), 61_05000000, expiry);
        fx.finalize(id);
    }

    // tolerance: 50 bps of mid
    function test_disagreementBeyondTolerance_voids() public {
        vm.warp(expiry);
        _report(0, 62e8, 62e8 + 62e8 * 51 / 10_000);
        (bool exists, uint8 outcome,) = fx.pending(id);
        assertTrue(exists);
        assertEq(outcome, 2);
        vm.warp(expiry + WINDOW);
        fx.finalize(id);
        assertEq(uint8(os.series(id).state), uint8(State.VOIDED));
        assertEq(os.series(id).payout, 0.5e18);
    }

    function test_disagreementWithinTolerance_settles() public {
        Series memory s = _settleWith(62e8, 62e8 + 62e8 * 49 / 10_000);
        assertEq(uint8(s.state), uint8(State.RESOLVED));
    }

    function test_explicitVoid() public {
        vm.warp(expiry);
        _report(2, 0, 0);
        vm.warp(expiry + WINDOW);
        fx.finalize(id);
        assertEq(uint8(os.series(id).state), uint8(State.VOIDED));
    }

    function test_finalizeWindowAndPending() public {
        vm.warp(expiry);
        (bool exists,,) = fx.pending(id);
        assertFalse(exists);
        _report(0, 62e8, 62e8);
        (bool ex, uint8 outcome, uint64 finalizeAfter) = fx.pending(id);
        assertTrue(ex);
        assertEq(outcome, 0);
        assertEq(finalizeAfter, expiry + WINDOW);

        vm.warp(expiry + WINDOW - 1);
        vm.expectRevert(CREFxResolver.WindowOpen.selector);
        fx.finalize(id);
        vm.warp(expiry + WINDOW);
        fx.finalize(id);
        (exists,,) = fx.pending(id);
        assertFalse(exists);
        vm.expectRevert(CREFxResolver.NoReport.selector);
        fx.finalize(id);
    }

    function test_guardianVoid() public {
        vm.warp(expiry);
        vm.prank(guardian);
        vm.expectRevert(CREFxResolver.NoReport.selector);
        fx.guardianVoid(id);

        _report(0, 62e8, 62e8);
        vm.expectRevert(CREFxResolver.OnlyGuardian.selector);
        fx.guardianVoid(id);
        vm.prank(guardian);
        fx.guardianVoid(id);
        assertEq(uint8(os.series(id).state), uint8(State.VOIDED));
    }

    function test_guardianVoidAfterWindowRejected() public {
        vm.warp(expiry);
        _report(0, 62e8, 62e8);
        vm.warp(expiry + WINDOW);
        vm.prank(guardian);
        vm.expectRevert(CREFxResolver.WindowClosed.selector);
        fx.guardianVoid(id);
    }

    function test_rejectsUnregisteredAndClosed() public {
        uint256 other = os.createSeries(Kind.FX_FLOOR, address(fx), bytes32("x"), K, L, expiry, "x");
        vm.warp(expiry);
        vm.prank(forwarder);
        vm.expectRevert(CREFxResolver.NotRegistered.selector);
        fx.onReport("", abi.encode(other, uint8(0), int64(62e8), int64(62e8)));

        vm.warp(expiry + 7 days);
        os.voidExpired(id);
        vm.expectRevert(CREFxResolver.NotOpen.selector);
        _report(0, 62e8, 62e8);
    }

    function testFuzz_payoutInRange(int64 a, uint16 spreadBps) public {
        a = int64(bound(a, 1, 1e12));
        int64 b = a + int64(int256((uint256(int256(a)) * bound(spreadBps, 0, 49)) / 10_000));
        Series memory s = _settleWith(a, b);
        assertLe(s.payout, 1e18);
        assertEq(uint8(s.state), uint8(State.RESOLVED));
    }

    event Resolved(uint256 indexed id, uint256 payout, int64 observed, uint64 observedAt);

    function test_setForwarder() public {
        address next = makeAddr("next");
        vm.prank(guardian);
        vm.expectRevert();
        fx.setForwarder(next);

        vm.expectEmit(address(fx));
        emit CREFxResolver.ForwarderUpdated(next);
        fx.setForwarder(next);
        assertEq(fx.forwarder(), next);

        vm.warp(expiry);
        vm.expectRevert(CREFxResolver.OnlyForwarder.selector);
        _report(0, 62e8, 62e8);
        vm.prank(next);
        fx.onReport("", abi.encode(id, uint8(0), int64(62e8), int64(62e8)));
        (bool exists,,) = fx.pending(id);
        assertTrue(exists);
    }
}
