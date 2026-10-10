// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {OutcomeSeries} from "../src/OutcomeSeries.sol";
import {CREResolver, IReceiver} from "../src/resolvers/CREResolver.sol";
import {Series, Kind, State} from "../src/interfaces/IOutcomeSeries.sol";
import {MockAUSD} from "./mocks/MockAUSD.sol";

contract CREResolverTest is Test {
    int32 constant LAT = 146_000; // 14.6
    int32 constant LON = 1_209_800; // 120.98
    uint32 constant DAY = 20261012;
    int64 constant STRIKE = 1250; // 12.5 mm
    uint64 constant WINDOW = 600;

    OutcomeSeries os;
    CREResolver cr;
    address forwarder = makeAddr("forwarder");
    address guardian = makeAddr("guardian");
    uint64 expiry;
    uint256 id;

    function setUp() public {
        os = new OutcomeSeries(address(new MockAUSD()), address(this));
        cr = new CREResolver(os, forwarder, guardian, WINDOW, address(this));
        expiry = uint64(block.timestamp + 2 days);
        id = os.createSeries(Kind.BINARY, address(cr), keccak256(abi.encode(LAT, LON, DAY)), STRIKE, 0, expiry, "Manila rain");
        cr.register(id, LAT, LON, DAY);
    }

    function _report(uint8 outcome, int64 a, int64 b) internal {
        vm.prank(forwarder);
        cr.onReport("", abi.encode(id, outcome, a, b));
    }

    function test_register() public {
        (int32 lat, int32 lon, uint32 day, bool reg) = cr.spec(id);
        assertEq(lat, LAT);
        assertEq(lon, LON);
        assertEq(day, DAY);
        assertTrue(reg);

        vm.expectRevert(CREResolver.AlreadyRegistered.selector);
        cr.register(id, LAT, LON, DAY);

        uint256 other = os.createSeries(Kind.BINARY, address(cr), bytes32("nope"), STRIKE, 0, expiry, "x");
        vm.expectRevert(CREResolver.RefMismatch.selector);
        cr.register(other, LAT, LON, DAY);

        vm.prank(guardian);
        vm.expectRevert();
        cr.register(other, LAT, LON, DAY);
    }

    function test_supportsReceiverInterface() public view {
        assertTrue(cr.supportsInterface(0x805f2132));
        assertTrue(cr.supportsInterface(type(IReceiver).interfaceId));
        assertTrue(cr.supportsInterface(0x01ffc9a7));
        assertFalse(cr.supportsInterface(0xffffffff));
    }

    // invariant 6: non-forwarder rejected
    function test_rejectsNonForwarder() public {
        vm.warp(expiry);
        vm.expectRevert(CREResolver.OnlyForwarder.selector);
        cr.onReport("", abi.encode(id, uint8(1), int64(2000), int64(2000)));
    }

    function test_rejectsReportBeforeExpiry() public {
        vm.expectRevert(CREResolver.NotExpired.selector);
        _report(1, 2000, 2000);
    }

    function test_rejectsInconsistentOutcome() public {
        vm.warp(expiry);
        vm.expectRevert(CREResolver.BadOutcome.selector);
        _report(1, 2000, 1000); // sources disagree but YES
        vm.expectRevert(CREResolver.BadOutcome.selector);
        _report(0, 2000, 2000); // both above but NO
        vm.expectRevert(CREResolver.BadOutcome.selector);
        _report(3, 2000, 2000);
    }

    // invariant 6: double report rejected
    function test_rejectsDoubleReport() public {
        vm.warp(expiry);
        _report(1, 2000, 1300);
        vm.expectRevert(CREResolver.AlreadyReported.selector);
        _report(0, 100, 100);
    }

    // invariant 6: finalize before window rejected
    function test_finalizeYesAfterWindow() public {
        vm.warp(expiry);
        (bool exists,,) = cr.pending(id);
        assertFalse(exists);
        _report(1, 2000, 1300);
        (bool ex, uint8 outcome, uint64 finalizeAfter) = cr.pending(id);
        assertTrue(ex);
        assertEq(outcome, 1);
        assertEq(finalizeAfter, expiry + WINDOW);
        vm.warp(expiry + WINDOW - 1);
        vm.expectRevert(CREResolver.WindowOpen.selector);
        cr.finalize(id);
        vm.warp(expiry + WINDOW);
        cr.finalize(id);
        Series memory s = os.series(id);
        assertEq(uint8(s.state), uint8(State.RESOLVED));
        assertEq(s.payout, 1e18);
        (exists,,) = cr.pending(id);
        assertFalse(exists);
        vm.expectRevert(CREResolver.NoReport.selector);
        cr.finalize(id);
    }

    function test_finalizeNo() public {
        vm.warp(expiry);
        _report(0, 100, 1249);
        vm.warp(expiry + WINDOW);
        cr.finalize(id);
        assertEq(os.series(id).payout, 0);
        assertEq(uint8(os.series(id).state), uint8(State.RESOLVED));
    }

    function test_finalizeVoid() public {
        vm.warp(expiry);
        _report(2, 2000, 100);
        vm.warp(expiry + WINDOW);
        cr.finalize(id);
        assertEq(uint8(os.series(id).state), uint8(State.VOIDED));
        assertEq(os.series(id).payout, 0.5e18);
    }

    function test_guardianVoid() public {
        vm.warp(expiry);
        vm.prank(guardian);
        vm.expectRevert(CREResolver.NoReport.selector);
        cr.guardianVoid(id);

        _report(1, 2000, 2000);
        vm.expectRevert(CREResolver.OnlyGuardian.selector);
        cr.guardianVoid(id);
        vm.prank(guardian);
        cr.guardianVoid(id);
        assertEq(uint8(os.series(id).state), uint8(State.VOIDED));

        vm.warp(expiry + WINDOW);
        vm.expectRevert(CREResolver.NoReport.selector);
        cr.finalize(id);
    }

    function test_guardianVoidAfterWindowRejected() public {
        vm.warp(expiry);
        _report(1, 2000, 2000);
        vm.warp(expiry + WINDOW);
        vm.prank(guardian);
        vm.expectRevert(CREResolver.WindowClosed.selector);
        cr.guardianVoid(id);
    }

    function test_rejectsUnregistered() public {
        uint256 other = os.createSeries(Kind.BINARY, address(cr), bytes32("x"), STRIKE, 0, expiry, "x");
        vm.warp(expiry);
        vm.prank(forwarder);
        vm.expectRevert(CREResolver.NotRegistered.selector);
        cr.onReport("", abi.encode(other, uint8(2), int64(0), int64(0)));
    }

    function test_rejectsReportAfterExpiredVoid() public {
        vm.warp(expiry + 7 days);
        os.voidExpired(id);
        vm.expectRevert(CREResolver.NotOpen.selector);
        _report(1, 2000, 2000);
    }
}
