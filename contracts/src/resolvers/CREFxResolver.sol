// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IOutcomeSeries, Series, Kind, State} from "../interfaces/IOutcomeSeries.sol";
import {ICREFxResolver} from "../interfaces/IResolvers.sol";
import {IReceiver} from "./CREResolver.sol";

/// @notice Settles FX_FLOOR series from two daily FX fixings delivered by CRE. If the two rates differ
///         by more than `tolBps` of their mid the series voids; otherwise S = mid and
///         payout = clamp((K - S) / (K - L), 0, 1). Settlement waits out a challenge window in which
///         the guardian may void.
contract CREFxResolver is ICREFxResolver, IReceiver, IERC165, Ownable {
    uint8 public constant OK = 0;
    uint8 public constant VOID = 2;

    struct Spec {
        bytes32 pair;
        uint32 yyyymmdd;
        bool registered;
    }

    struct Report {
        uint8 outcome;
        int64 rateA;
        int64 rateB;
        uint64 receivedAt;
        uint64 finalizeAfter; // zero = no report
        bool done;
    }

    IOutcomeSeries public immutable outcomeSeries;
    address public forwarder;
    address public immutable guardian;
    uint64 public immutable challengeWindow;
    uint256 public immutable tolBps;

    mapping(uint256 => Spec) private _specs;
    mapping(uint256 => Report) public reports;

    event ForwarderUpdated(address forwarder);

    error NotFxSeries();
    error RefMismatch();
    error AlreadyRegistered();
    error NotRegistered();
    error OnlyForwarder();
    error OnlyGuardian();
    error BadOutcome();
    error NotExpired();
    error NotOpen();
    error AlreadyReported();
    error NoReport();
    error WindowOpen();
    error WindowClosed();

    constructor(
        IOutcomeSeries outcomeSeries_,
        address forwarder_,
        address guardian_,
        uint64 challengeWindow_,
        uint256 tolBps_,
        address owner_
    ) Ownable(owner_) {
        outcomeSeries = outcomeSeries_;
        forwarder = forwarder_;
        guardian = guardian_;
        challengeWindow = challengeWindow_;
        tolBps = tolBps_;
    }

    function register(uint256 id, bytes32 pair, uint32 yyyymmdd) external onlyOwner {
        Series memory s = outcomeSeries.series(id);
        if (s.kind != Kind.FX_FLOOR || s.resolver != address(this)) revert NotFxSeries();
        if (s.oracleRef != keccak256(abi.encode(pair, yyyymmdd))) revert RefMismatch();
        if (_specs[id].registered) revert AlreadyRegistered();
        _specs[id] = Spec(pair, yyyymmdd, true);
        emit FxRegistered(id, pair, yyyymmdd);
    }

    function setForwarder(address forwarder_) external onlyOwner {
        forwarder = forwarder_;
        emit ForwarderUpdated(forwarder_);
    }

    /// @param report abi.encode(uint256 id, uint8 outcome, int64 rateA, int64 rateB), rates at 8 dp
    function onReport(bytes calldata, bytes calldata report) external override(ICREFxResolver, IReceiver) {
        if (msg.sender != forwarder) revert OnlyForwarder();
        (uint256 id, uint8 outcome, int64 a, int64 b) = abi.decode(report, (uint256, uint8, int64, int64));
        if (!_specs[id].registered) revert NotRegistered();
        if (reports[id].finalizeAfter != 0) revert AlreadyReported();

        Series memory s = outcomeSeries.series(id);
        if (s.state != State.OPEN) revert NotOpen();
        if (block.timestamp < s.expiry) revert NotExpired();
        if (outcome == OK) {
            if (a <= 0 || b <= 0) revert BadOutcome();
            if (!_agree(a, b)) outcome = VOID;
        } else if (outcome != VOID) {
            revert BadOutcome();
        }

        uint64 finalizeAfter = uint64(block.timestamp) + challengeWindow;
        reports[id] = Report(outcome, a, b, uint64(block.timestamp), finalizeAfter, false);
        emit FxReportReceived(id, outcome, a, b, finalizeAfter);
    }

    function finalize(uint256 id) external {
        Report storage r = _pending(id);
        if (block.timestamp < r.finalizeAfter) revert WindowOpen();
        r.done = true;
        if (r.outcome == VOID) {
            outcomeSeries.voidByResolver(id);
        } else {
            Series memory s = outcomeSeries.series(id);
            int64 mid = int64((int256(r.rateA) + r.rateB) / 2);
            outcomeSeries.settle(id, _payout(s.strike, s.lower, mid), mid, r.receivedAt);
        }
    }

    function guardianVoid(uint256 id) external {
        if (msg.sender != guardian) revert OnlyGuardian();
        Report storage r = _pending(id);
        if (block.timestamp >= r.finalizeAfter) revert WindowClosed();
        r.done = true;
        outcomeSeries.voidByResolver(id);
    }

    function spec(uint256 id) external view returns (bytes32, uint32, bool) {
        Spec memory sp = _specs[id];
        return (sp.pair, sp.yyyymmdd, sp.registered);
    }

    /// @notice A report has been received and is neither finalized nor voided.
    function pending(uint256 id) external view returns (bool, uint8, uint64) {
        Report memory r = reports[id];
        return (r.finalizeAfter != 0 && !r.done, r.outcome, r.finalizeAfter);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    function _agree(int64 a, int64 b) private view returns (bool) {
        uint256 diff = a > b ? uint256(int256(a) - b) : uint256(int256(b) - a);
        uint256 mid = (uint256(int256(a)) + uint256(int256(b))) / 2;
        return diff * 10_000 <= tolBps * mid;
    }

    function _payout(int64 strike, int64 lower, int64 spot) private pure returns (uint256) {
        if (spot >= strike) return 0;
        if (spot <= lower) return 1e18;
        return (uint256(int256(strike) - spot) * 1e18) / uint256(int256(strike) - lower);
    }

    function _pending(uint256 id) private view returns (Report storage r) {
        r = reports[id];
        if (r.finalizeAfter == 0 || r.done) revert NoReport();
    }
}
