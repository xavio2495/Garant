// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {OutcomeSeries} from "../src/OutcomeSeries.sol";
import {PythResolver} from "../src/resolvers/PythResolver.sol";
import {CREResolver} from "../src/resolvers/CREResolver.sol";

/// @notice Deploys OutcomeSeries + both resolvers on Monad testnet and writes deployments/10143.json.
///         env: DEPLOYER_PRIVATE_KEY; optional CRE_FORWARDER (defaults to the simulation forwarder).
contract Deploy is Script {
    address constant AUSD = 0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC;
    address constant PYTH = 0x2880aB155794e7179c9eE2e38200202908C17B43;
    address constant KURU_ROUTER = 0x7EFbE105Ca7415dE98F96622173458ac1c054630;
    address constant CRE_SIM_FORWARDER = 0xB9F79d863261869B234c481D1f9A7af84AeAd192;
    uint256 constant MAX_CONF_BPS = 100;
    uint64 constant CHALLENGE_WINDOW = 600;

    function run() external {
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address forwarder = vm.envOr("CRE_FORWARDER", CRE_SIM_FORWARDER);
        uint256 startBlock = block.number;

        vm.startBroadcast(pk);
        OutcomeSeries os = new OutcomeSeries(AUSD, deployer);
        PythResolver pr = new PythResolver(os, IPyth(PYTH), MAX_CONF_BPS);
        CREResolver cr = new CREResolver(os, forwarder, deployer, CHALLENGE_WINDOW, deployer);
        vm.stopBroadcast();

        string memory k = "d";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeUint(k, "startBlock", startBlock);
        vm.serializeAddress(k, "ausd", AUSD);
        vm.serializeAddress(k, "pyth", PYTH);
        vm.serializeAddress(k, "outcomeSeries", address(os));
        vm.serializeAddress(k, "pythResolver", address(pr));
        vm.serializeAddress(k, "creResolver", address(cr));
        vm.serializeAddress(k, "creForwarder", forwarder);
        vm.serializeString(k, "marketMode", "kuru");
        vm.serializeAddress(k, "kuruRouter", KURU_ROUTER);
        string memory json = vm.serializeAddress(k, "kuruMarginAccount", 0xd029C2D98ff85D8F64799017fE00a59B1159CE02);
        vm.writeJson(json, string.concat(vm.projectRoot(), "/../deployments/", vm.toString(block.chainid), ".json"));
    }
}
