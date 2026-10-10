// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockPyth} from "@pythnetwork/pyth-sdk-solidity/MockPyth.sol";
import {PythErrors} from "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";
import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {OutcomeSeries} from "../src/OutcomeSeries.sol";
import {PythResolver} from "../src/resolvers/PythResolver.sol";
import {Series, Kind, State} from "../src/interfaces/IOutcomeSeries.sol";
import {MockAUSD} from "./mocks/MockAUSD.sol";

contract PythResolverTest is Test {
    bytes32 constant PHP = 0x2bda7f268b52bfbc3f2e124c31445247647350db313caadc6771e6299e0a68c9;
    uint256 constant FEE = 1;

    MockPyth pyth;
    OutcomeSeries os;
    PythResolver pr;
    uint64 expiry;
    uint256 id;

    function setUp() public {
        pyth = new MockPyth(60, FEE);
        os = new OutcomeSeries(address(new MockAUSD()), address(this));
        pr = new PythResolver(os, IPyth(address(pyth)), 100); // 1% max conf
        expiry = uint64(block.timestamp + 30 days);
        // K = 58.00, L = 55.00
        id = os.createSeries(Kind.FX_FLOOR, address(pr), PHP, 58e8, 55e8, expiry, "USD/PHP 58");
    }

    // USD/PHP style feed: expo -5
    function _update(int64 price, uint64 conf, uint64 publishTime, uint64 prev) internal view returns (bytes[] memory u) {
        u = new bytes[](1);
        u[0] = pyth.createPriceFeedUpdateData(PHP, price, conf, -5, price, conf, publishTime, prev);
    }

    function _resolve(int64 price, uint64 publishTime) internal {
        vm.warp(publishTime + 1);
        pr.resolve{value: FEE}(id, _update(price, 0, publishTime, expiry - 1));
    }

    function test_payoutAboveStrike_isZero() public {
        _resolve(58_10000, expiry);
        Series memory s = os.series(id);
        assertEq(uint8(s.state), uint8(State.RESOLVED));
        assertEq(s.payout, 0);
    }

    function test_payoutBelowLower_isOne() public {
        _resolve(54_00000, expiry);
        assertEq(os.series(id).payout, 1e18);
    }

    function test_payoutLinearBetween() public {
        // S = 57.25 -> (58 - 57.25) / 3 = 0.25
        _resolve(57_25000, expiry + 3600);
        assertEq(os.series(id).payout, 0.25e18);
    }

    function test_emitsObservedIn8dp() public {
        vm.warp(expiry + 10);
        vm.expectEmit(address(os));
        emit OutcomeSeriesEvents.Resolved(id, 0.25e18, 57_25000000, expiry + 5);
        pr.resolve{value: FEE}(id, _update(57_25000, 0, expiry + 5, expiry - 1));
    }

    function test_rejectsPrintBeforeExpiry() public {
        vm.warp(expiry + 10);
        bytes[] memory u = _update(57e5, 0, expiry - 1, expiry - 2);
        vm.expectRevert(PythErrors.PriceFeedNotFoundWithinRange.selector);
        pr.resolve{value: FEE}(id, u);
    }

    function test_rejectsPrintAfterMaxDelay() public {
        uint64 t = expiry + pr.MAX_DELAY() + 1;
        vm.warp(t + 1);
        bytes[] memory u = _update(57e5, 0, t, expiry - 1);
        vm.expectRevert(PythErrors.PriceFeedNotFoundWithinRange.selector);
        pr.resolve{value: FEE}(id, u);
    }

    function test_rejectsNonFirstPrint() public {
        // previous print was already at/after expiry, so this is not the first one
        vm.warp(expiry + 100);
        bytes[] memory u = _update(57e5, 0, expiry + 50, expiry);
        vm.expectRevert(PythErrors.PriceFeedNotFoundWithinRange.selector);
        pr.resolve{value: FEE}(id, u);
    }

    function test_rejectsWideConfidence() public {
        vm.warp(expiry + 10);
        bytes[] memory u = _update(57_00000, 57_001, expiry, expiry - 1); // > 1%
        vm.expectRevert(PythResolver.WideConfidence.selector);
        pr.resolve{value: FEE}(id, u);
    }

    function test_rejectsBeforeExpiry() public {
        bytes[] memory u = _update(57e5, 0, uint64(block.timestamp), 0);
        vm.expectRevert(PythErrors.PriceFeedNotFoundWithinRange.selector);
        pr.resolve{value: FEE}(id, u);
    }

    function test_rejectsSecondResolve() public {
        _resolve(57e5, expiry);
        bytes[] memory u = _update(56e5, 0, expiry + 1, expiry - 1);
        vm.expectRevert(OutcomeSeries.NotOpen.selector);
        pr.resolve{value: FEE}(id, u);
    }

    function test_rejectsNonFxSeries() public {
        uint256 bin = os.createSeries(Kind.BINARY, address(pr), PHP, 1, 0, expiry, "x");
        vm.warp(expiry + 10);
        bytes[] memory u = _update(57e5, 0, expiry, expiry - 1);
        vm.expectRevert(PythResolver.NotFxSeries.selector);
        pr.resolve{value: FEE}(bin, u);
    }

    function test_refundsExcessFee() public {
        address caller = makeAddr("caller");
        vm.deal(caller, 1 ether);
        vm.warp(expiry + 10);
        bytes[] memory u = _update(57e5, 0, expiry, expiry - 1);
        vm.prank(caller);
        pr.resolve{value: 1 ether}(id, u);
        assertEq(caller.balance, 1 ether - FEE);
        assertEq(address(pr).balance, 0);
    }

    function testFuzz_payoutInRange(int64 price) public {
        price = int64(bound(price, 1, 1e12));
        _resolve(price, expiry);
        assertLe(os.series(id).payout, 1e18);
    }
}

interface OutcomeSeriesEvents {
    event Resolved(uint256 indexed id, uint256 payout, int64 observed, uint64 observedAt);
}
