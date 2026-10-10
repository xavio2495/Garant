// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {OutcomeSeries} from "../src/OutcomeSeries.sol";
import {CREResolver} from "../src/resolvers/CREResolver.sol";
import {CREFxResolver} from "../src/resolvers/CREFxResolver.sol";
import {Kind} from "../src/interfaces/IOutcomeSeries.sol";

interface IKuruRouter {
    function deployProxy(
        uint8 _type,
        address _base,
        address _quote,
        uint96 _sizePrecision,
        uint32 _pricePrecision,
        uint32 _tickSize,
        uint96 _minSize,
        uint96 _maxSize,
        uint256 _takerFeeBps,
        uint256 _makerFeeBps,
        uint96 _kuruAmmSpread
    ) external returns (address);
}

/// @notice Creates series with a Kuru PROTECT/AUSD market each and registers them on their resolver.
///         Reads deployments/<chainId>.json. env: DEPLOYER_PRIVATE_KEY; optional SEED_DELAY (seconds
///         until the short demo series expire, default 600) and SEED_BTC (also seed the BTC floor).
///
///   default:  forge script script/Seed.s.sol --rpc-url monad --broadcast
///   ad hoc:   --sig "fx(uint32,int64,int64,uint64,string)" 20261009 6250000000 6000000000 <expiry> "USD/PHP 62.50"
///             --sig "rain(int32,int32,uint32,int64,uint64,string)" 145995 1209842 20260910 1000 <expiry> "Manila rain"
///             --sig "pyth(bytes32,int64,int64,uint64,string)" <priceId> <K> <L> <expiry> "BTC floor"
contract Seed is Script {
    bytes32 constant USD_PHP = bytes32("USD/PHP");
    bytes32 constant BTC_USD = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    int32 constant MANILA_LAT = 145995;
    int32 constant MANILA_LON = 1209842;
    int64 constant RAIN_STRIKE = 1000; // 10 mm
    uint64 constant FIXING_20261109 = 1794240000; // 2026-11-09 16:00 UTC

    OutcomeSeries os;
    CREResolver weatherResolver;
    CREFxResolver fxResolver;
    address pythResolver;
    address router;
    address ausd;
    uint256 pk;

    function _load() internal {
        string memory json =
            vm.readFile(string.concat(vm.projectRoot(), "/../deployments/", vm.toString(block.chainid), ".json"));
        os = OutcomeSeries(vm.parseJsonAddress(json, ".outcomeSeries"));
        weatherResolver = CREResolver(vm.parseJsonAddress(json, ".creResolver"));
        fxResolver = CREFxResolver(vm.parseJsonAddress(json, ".creFxResolver"));
        pythResolver = vm.parseJsonAddress(json, ".pythResolver");
        router = vm.parseJsonAddress(json, ".kuruRouter");
        ausd = vm.parseJsonAddress(json, ".ausd");
        pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
    }

    /// @dev Pinned demo order; requires a fresh OutcomeSeries so the ids match.
    function run() external {
        _load();
        require(os.seriesCount() == 0, "seed expects no existing series");
        uint64 soon = uint64(block.timestamp + vm.envOr("SEED_DELAY", uint256(600)));

        vm.startBroadcast(pk);
        _fx(20261109, 62_50000000, 60_00000000, FIXING_20261109, "USD/PHP 62.50 floor 2026-11-09"); // 0
        _rain(MANILA_LAT, MANILA_LON, 20260910, RAIN_STRIKE, soon, "Manila rain 10mm 2026-09-10"); // 1
        _rain(MANILA_LAT, MANILA_LON, 20261001, RAIN_STRIKE, soon, "Manila rain 10mm 2026-10-01"); // 2
        _rain(MANILA_LAT, MANILA_LON, 20260911, RAIN_STRIKE, soon, "Manila rain 10mm 2026-09-11"); // 3
        _fx(20261009, 62_50000000, 60_00000000, soon, "USD/PHP 62.50 floor 2026-10-09"); // 4
        _fx(20261009, 63_00000000, 60_00000000, soon, "USD/PHP 63.00 floor 2026-10-09"); // 5
        if (vm.envOr("SEED_BTC", false)) {
            _pyth(BTC_USD, 80_000e8, 75_000e8, soon, "BTC/USD 80000 floor"); // 6
        }
        vm.stopBroadcast();
    }

    function fx(uint32 yyyymmdd, int64 strike, int64 lower, uint64 expiry, string calldata label) external {
        _load();
        vm.startBroadcast(pk);
        _fx(yyyymmdd, strike, lower, expiry, label);
        vm.stopBroadcast();
    }

    function rain(int32 lat1e4, int32 lon1e4, uint32 yyyymmdd, int64 strike, uint64 expiry, string calldata label)
        external
    {
        _load();
        vm.startBroadcast(pk);
        _rain(lat1e4, lon1e4, yyyymmdd, strike, expiry, label);
        vm.stopBroadcast();
    }

    function pyth(bytes32 priceId, int64 strike, int64 lower, uint64 expiry, string calldata label) external {
        _load();
        vm.startBroadcast(pk);
        _pyth(priceId, strike, lower, expiry, label);
        vm.stopBroadcast();
    }

    function _fx(uint32 yyyymmdd, int64 strike, int64 lower, uint64 expiry, string memory label) internal {
        uint256 id = _create(
            Kind.FX_FLOOR, address(fxResolver), keccak256(abi.encode(USD_PHP, yyyymmdd)), strike, lower, expiry, label
        );
        fxResolver.register(id, USD_PHP, yyyymmdd);
    }

    function _rain(int32 lat1e4, int32 lon1e4, uint32 yyyymmdd, int64 strike, uint64 expiry, string memory label)
        internal
    {
        uint256 id = _create(
            Kind.BINARY,
            address(weatherResolver),
            keccak256(abi.encode(lat1e4, lon1e4, yyyymmdd)),
            strike,
            0,
            expiry,
            label
        );
        weatherResolver.register(id, lat1e4, lon1e4, yyyymmdd);
    }

    function _pyth(bytes32 priceId, int64 strike, int64 lower, uint64 expiry, string memory label) internal {
        _create(Kind.FX_FLOOR, pythResolver, priceId, strike, lower, expiry, label);
    }

    function _create(
        Kind kind,
        address resolver,
        bytes32 oracleRef,
        int64 strike,
        int64 lower,
        uint64 expiry,
        string memory label
    ) internal returns (uint256 id) {
        id = os.createSeries(kind, resolver, oracleRef, strike, lower, expiry, label);
        // price unit 1e-4 AUSD, tick 0.001; size unit 1e-6 PROTECT, min 1; no fees
        address market =
            IKuruRouter(router).deployProxy(0, os.series(id).protect, ausd, 1e6, 1e4, 10, 1e6, 1e15, 0, 0, 100);
        os.setMarket(id, market);
        console.log(id, label, market);
    }
}
