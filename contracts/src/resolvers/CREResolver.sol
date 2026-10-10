// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IOutcomeSeries, Series, Kind, State} from "../interfaces/IOutcomeSeries.sol";
import {ICREResolver} from "../interfaces/IResolvers.sol";

/// @dev Chainlink CRE receiver interface; the forwarder checks ERC-165 support before delivering.
interface IReceiver {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

/// @notice Settles BINARY weather series from CRE reports, after a challenge window in which
///         the guardian may void.
contract CREResolver is ICREResolver, IReceiver, IERC165, Ownable {
    uint8 public constant NO = 0;
    uint8 public constant YES = 1;
    uint8 public constant VOID = 2;

    struct Spec {
        int32 lat1e4;
        int32 lon1e4;
        uint32 yyyymmdd;
        bool registered;
    }

    struct Report {
        uint8 outcome;
        int64 observedA;
        int64 observedB;
        uint64 receivedAt;
        uint64 finalizeAfter; // zero = no report
        bool done;
    }

    IOutcomeSeries public immutable outcomeSeries;
    address public forwarder;
    address public immutable guardian;
    uint64 public immutable challengeWindow;

    mapping(uint256 => Spec) private _specs;
    mapping(uint256 => Report) public reports;

    event ForwarderUpdated(address forwarder);

    error NotBinarySeries();
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

    constructor(IOutcomeSeries outcomeSeries_, address forwarder_, address guardian_, uint64 challengeWindow_, address owner_)
        Ownable(owner_)
    {
        outcomeSeries = outcomeSeries_;
        forwarder = forwarder_;
        guardian = guardian_;
        challengeWindow = challengeWindow_;
    }

    function register(uint256 id, int32 lat1e4, int32 lon1e4, uint32 yyyymmdd) external onlyOwner {
        Series memory s = outcomeSeries.series(id);
        if (s.kind != Kind.BINARY || s.resolver != address(this)) revert NotBinarySeries();
        if (s.oracleRef != keccak256(abi.encode(lat1e4, lon1e4, yyyymmdd))) revert RefMismatch();
        if (_specs[id].registered) revert AlreadyRegistered();
        _specs[id] = Spec(lat1e4, lon1e4, yyyymmdd, true);
        emit WeatherRegistered(id, lat1e4, lon1e4, yyyymmdd);
    }

    function setForwarder(address forwarder_) external onlyOwner {
        forwarder = forwarder_;
        emit ForwarderUpdated(forwarder_);
    }

    /// @param report abi.encode(uint256 id, uint8 outcome, int64 observedA, int64 observedB)
    function onReport(bytes calldata, bytes calldata report) external override(ICREResolver, IReceiver) {
        if (msg.sender != forwarder) revert OnlyForwarder();
        (uint256 id, uint8 outcome, int64 a, int64 b) = abi.decode(report, (uint256, uint8, int64, int64));
        if (!_specs[id].registered) revert NotRegistered();
        if (reports[id].finalizeAfter != 0) revert AlreadyReported();

        Series memory s = outcomeSeries.series(id);
        if (s.state != State.OPEN) revert NotOpen();
        if (block.timestamp < s.expiry) revert NotExpired();
        // VOID is always accepted; YES/NO must agree with both observations.
        if (outcome != VOID) {
            bool hitA = a >= s.strike;
            if (hitA != (b >= s.strike) || outcome != (hitA ? YES : NO)) revert BadOutcome();
        }

        uint64 finalizeAfter = uint64(block.timestamp) + challengeWindow;
        reports[id] = Report(outcome, a, b, uint64(block.timestamp), finalizeAfter, false);
        emit ReportReceived(id, outcome, a, b, finalizeAfter);
    }

    function finalize(uint256 id) external {
        Report storage r = _pending(id);
        if (block.timestamp < r.finalizeAfter) revert WindowOpen();
        r.done = true;
        if (r.outcome == VOID) outcomeSeries.voidByResolver(id);
        else outcomeSeries.settle(id, r.outcome == YES ? 1e18 : 0, r.observedA, r.receivedAt);
    }

    function guardianVoid(uint256 id) external {
        if (msg.sender != guardian) revert OnlyGuardian();
        Report storage r = _pending(id);
        if (block.timestamp >= r.finalizeAfter) revert WindowClosed();
        r.done = true;
        outcomeSeries.voidByResolver(id);
    }

    function spec(uint256 id) external view returns (int32, int32, uint32, bool) {
        Spec memory sp = _specs[id];
        return (sp.lat1e4, sp.lon1e4, sp.yyyymmdd, sp.registered);
    }

    /// @notice A report has been received and is neither finalized nor voided.
    function pending(uint256 id) external view returns (bool, uint8, uint64) {
        Report memory r = reports[id];
        return (r.finalizeAfter != 0 && !r.done, r.outcome, r.finalizeAfter);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    function _pending(uint256 id) private view returns (Report storage r) {
        r = reports[id];
        if (r.finalizeAfter == 0 || r.done) revert NoReport();
    }
}
