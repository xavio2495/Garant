// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {IOutcomeSeries, Series, Kind} from "../interfaces/IOutcomeSeries.sol";
import {IPythResolver} from "../interfaces/IResolvers.sol";

/// @notice Settles FX_FLOOR series from the first Pyth print at or after expiry.
///         payout = clamp((K - S) / (K - L), 0, 1), all prices at 8 decimals.
contract PythResolver is IPythResolver, ReentrancyGuard {
    uint64 public constant MAX_DELAY = 72 hours;
    int32 private constant SCALE_EXPO = -8;

    IOutcomeSeries public immutable outcomeSeries;
    IPyth public immutable pyth;
    uint256 public immutable maxConfBps;

    error NotFxSeries();
    error BadPrice();
    error WideConfidence();
    error RefundFailed();

    constructor(IOutcomeSeries outcomeSeries_, IPyth pyth_, uint256 maxConfBps_) {
        outcomeSeries = outcomeSeries_;
        pyth = pyth_;
        maxConfBps = maxConfBps_;
    }

    function resolve(uint256 id, bytes[] calldata updateData) external payable nonReentrant {
        Series memory s = outcomeSeries.series(id);
        if (s.kind != Kind.FX_FLOOR || s.resolver != address(this)) revert NotFxSeries();

        bytes32[] memory ids = new bytes32[](1);
        ids[0] = s.oracleRef;
        uint256 fee = pyth.getUpdateFee(updateData);
        PythStructs.Price memory p =
            pyth.parsePriceFeedUpdatesUnique{value: fee}(updateData, ids, s.expiry, s.expiry + MAX_DELAY)[0].price;

        if (p.price <= 0) revert BadPrice();
        if (uint256(p.conf) * 10_000 > uint256(uint64(p.price)) * maxConfBps) revert WideConfidence();

        int64 spot = _toScale(p.price, p.expo);
        outcomeSeries.settle(id, _payout(s.strike, s.lower, spot), spot, uint64(p.publishTime));

        if (msg.value > fee) {
            (bool ok,) = msg.sender.call{value: msg.value - fee}("");
            if (!ok) revert RefundFailed();
        }
    }

    function _toScale(int64 price, int32 expo) private pure returns (int64) {
        int256 v = price;
        if (expo < SCALE_EXPO) v /= int256(10 ** uint32(SCALE_EXPO - expo));
        else v *= int256(10 ** uint32(expo - SCALE_EXPO));
        return SafeCast.toInt64(v);
    }

    function _payout(int64 strike, int64 lower, int64 spot) private pure returns (uint256) {
        if (spot >= strike) return 0;
        if (spot <= lower) return 1e18;
        return (uint256(int256(strike) - spot) * 1e18) / uint256(int256(strike) - lower);
    }
}
