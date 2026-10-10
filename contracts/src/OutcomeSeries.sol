// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IOutcomeSeries, Series, Kind, State} from "./interfaces/IOutcomeSeries.sol";
import {OutcomeToken} from "./OutcomeToken.sol";

/// @notice Holds all AUSD collateral. Each unit of AUSD backs one PROTECT + one BACK of a series;
///         after resolution PROTECT pays `payout` and BACK pays `1e18 - payout` (1e18 scale).
contract OutcomeSeries is IOutcomeSeries, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant ONE = 1e18;
    uint256 public constant RESOLVE_DEADLINE = 7 days;

    IERC20 private immutable _ausd;
    Series[] private _series;

    error BadParams();
    error NotOpen();
    error NotSettled();
    error Expired();
    error NotExpired();
    error OnlyResolver();
    error ZeroAmount();

    constructor(address ausd_, address owner_) Ownable(owner_) {
        _ausd = IERC20(ausd_);
    }

    // ---------------------------------------------------------------- admin

    function createSeries(
        Kind kind,
        address resolver,
        bytes32 oracleRef,
        int64 strike,
        int64 lower,
        uint64 expiry,
        string calldata label
    ) external onlyOwner returns (uint256 id) {
        if (resolver == address(0) || expiry <= block.timestamp) revert BadParams();
        if (kind == Kind.FX_FLOOR ? (lower <= 0 || lower >= strike) : lower != 0) revert BadParams();

        id = _series.length;
        string memory n = Strings.toString(id);
        address protect = address(new OutcomeToken(string.concat(label, " PROTECT"), string.concat("gPRT-", n)));
        address back = address(new OutcomeToken(string.concat(label, " BACK"), string.concat("gBCK-", n)));

        _series.push(
            Series({
                kind: kind,
                state: State.OPEN,
                resolver: resolver,
                oracleRef: oracleRef,
                strike: strike,
                lower: lower,
                expiry: expiry,
                protect: protect,
                back: back,
                market: address(0),
                payout: 0
            })
        );
        emit SeriesCreated(id, kind, resolver, oracleRef, strike, lower, expiry, protect, back, label);
    }

    function setMarket(uint256 id, address market) external onlyOwner {
        _series[id].market = market;
        emit MarketSet(id, market);
    }

    // ---------------------------------------------------------------- users

    function mint(uint256 id, uint256 amount, address to) external nonReentrant {
        Series storage s = _series[id];
        if (amount == 0) revert ZeroAmount();
        if (s.state != State.OPEN) revert NotOpen();
        if (block.timestamp >= s.expiry) revert Expired();

        _ausd.safeTransferFrom(msg.sender, address(this), amount);
        OutcomeToken(s.protect).mint(to, amount);
        OutcomeToken(s.back).mint(to, amount);
        emit Minted(id, to, amount);
    }

    function redeemSet(uint256 id, uint256 amount, address to) external nonReentrant {
        Series storage s = _series[id];
        if (amount == 0) revert ZeroAmount();

        OutcomeToken(s.protect).burn(msg.sender, amount);
        OutcomeToken(s.back).burn(msg.sender, amount);
        _ausd.safeTransfer(to, amount);
        emit SetRedeemed(id, msg.sender, amount);
    }

    function redeem(uint256 id, address to) external nonReentrant {
        Series storage s = _series[id];
        if (s.state == State.OPEN) revert NotSettled();

        uint256 protectIn = IERC20(s.protect).balanceOf(msg.sender);
        uint256 backIn = IERC20(s.back).balanceOf(msg.sender);
        if (protectIn + backIn == 0) revert ZeroAmount();
        uint256 out = _claim(protectIn, backIn, s.payout);

        if (protectIn > 0) OutcomeToken(s.protect).burn(msg.sender, protectIn);
        if (backIn > 0) OutcomeToken(s.back).burn(msg.sender, backIn);
        if (out > 0) _ausd.safeTransfer(to, out);
        emit Redeemed(id, msg.sender, protectIn, backIn, out);
    }

    // ---------------------------------------------------------------- resolution

    function settle(uint256 id, uint256 payout, int64 observed, uint64 observedAt) external {
        Series storage s = _resolvable(id);
        if (payout > ONE) revert BadParams();
        s.state = State.RESOLVED;
        s.payout = uint128(payout);
        emit Resolved(id, payout, observed, observedAt);
    }

    function voidByResolver(uint256 id) external {
        _void(_resolvable(id), id);
    }

    function voidExpired(uint256 id) external {
        Series storage s = _series[id];
        if (s.state != State.OPEN) revert NotOpen();
        if (block.timestamp < s.expiry + RESOLVE_DEADLINE) revert NotExpired();
        _void(s, id);
    }

    // ---------------------------------------------------------------- views

    function series(uint256 id) external view returns (Series memory) {
        return _series[id];
    }

    function seriesCount() external view returns (uint256) {
        return _series.length;
    }

    function ausd() external view returns (address) {
        return address(_ausd);
    }

    // ---------------------------------------------------------------- internal

    function _resolvable(uint256 id) private view returns (Series storage s) {
        s = _series[id];
        if (msg.sender != s.resolver) revert OnlyResolver();
        if (s.state != State.OPEN) revert NotOpen();
        if (block.timestamp < s.expiry) revert NotExpired();
    }

    /// @dev Matched PROTECT+BACK pairs pay exactly 1; only the unmatched remainder is rounded down.
    function _claim(uint256 protectIn, uint256 backIn, uint256 payout) private pure returns (uint256) {
        uint256 sets = protectIn < backIn ? protectIn : backIn;
        return sets + ((protectIn - sets) * payout) / ONE + ((backIn - sets) * (ONE - payout)) / ONE;
    }

    function _void(Series storage s, uint256 id) private {
        s.state = State.VOIDED;
        s.payout = uint128(ONE / 2);
        emit Voided(id);
    }
}
