// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

enum Kind {
    BINARY,
    FX_FLOOR
}

enum State {
    OPEN,
    RESOLVED,
    VOIDED
}

struct Series {
    Kind kind;
    State state;
    address resolver; // PythResolver (FX_FLOOR) or CREResolver (BINARY)
    bytes32 oracleRef; // Pyth price id for FX_FLOOR; keccak256(abi.encode(lat1e4, lon1e4, yyyymmdd)) for BINARY
    int64 strike; // FX: K (8 dp). BINARY weather: threshold (mm*100); event = observed >= strike
    int64 lower; // FX: L (8 dp), L < K. BINARY: 0
    uint64 expiry; // unix seconds
    address protect; // ERC-20, 6 dp, mint/burn only by OutcomeSeries
    address back; // ERC-20, 6 dp
    address market; // PROTECT/AUSD market; zero until set
    uint128 payout; // PROTECT payout, 1e18 scale; BACK gets 1e18 - payout. Void = 0.5e18
}

interface IOutcomeSeries {
    event SeriesCreated(
        uint256 indexed id,
        Kind kind,
        address resolver,
        bytes32 oracleRef,
        int64 strike,
        int64 lower,
        uint64 expiry,
        address protect,
        address back,
        string label
    );
    event MarketSet(uint256 indexed id, address market);
    event Minted(uint256 indexed id, address indexed account, uint256 amount);
    event SetRedeemed(uint256 indexed id, address indexed account, uint256 amount);
    event Resolved(uint256 indexed id, uint256 payout, int64 observed, uint64 observedAt);
    event Voided(uint256 indexed id);
    event Redeemed(uint256 indexed id, address indexed account, uint256 protectIn, uint256 backIn, uint256 ausdOut);

    function createSeries(
        Kind kind,
        address resolver,
        bytes32 oracleRef,
        int64 strike,
        int64 lower,
        uint64 expiry,
        string calldata label
    ) external returns (uint256 id);
    function setMarket(uint256 id, address market) external;

    function mint(uint256 id, uint256 amount, address to) external;
    function redeemSet(uint256 id, uint256 amount, address to) external;
    function redeem(uint256 id, address to) external;

    function settle(uint256 id, uint256 payout, int64 observed, uint64 observedAt) external;
    function voidByResolver(uint256 id) external;
    function voidExpired(uint256 id) external;

    function series(uint256 id) external view returns (Series memory);
    function seriesCount() external view returns (uint256);
    function ausd() external view returns (address);
}
