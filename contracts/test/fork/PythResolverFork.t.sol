// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {PythErrors} from "@pythnetwork/pyth-sdk-solidity/PythErrors.sol";
import {OutcomeSeries} from "../../src/OutcomeSeries.sol";
import {PythResolver} from "../../src/resolvers/PythResolver.sol";
import {Series, Kind, State} from "../../src/interfaces/IOutcomeSeries.sol";
import {MockAUSD} from "../mocks/MockAUSD.sol";

/// @dev Real Pyth contract on Monad testnet, real signed update (BTC/USD, publishTime 1791667333,
///      price 82987.80) taken from keeper tx 0x85ec7cab...e1a7.
contract PythResolverForkTest is Test {
    IPyth constant PYTH = IPyth(0x2880aB155794e7179c9eE2e38200202908C17B43);
    bytes32 constant BTC = 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43;
    uint64 constant PUBLISH = 1791667333;
    bytes constant UPDATE = hex"504e415501000000012401000000010301072715782a471ae82aae1b106975da580ff6c46917fb2dfd46932d07932603a13c17a4b2e85a59b56a929d519db056f90b288aba742f4c9f55f671d964c3aefd0102593328607c8b3bc9891aab8b6ab3a2e1d3b97c50f762a82fa806edd93d57717e611c144880763ff63804f70175f3c1a1c57e7b91fef146fa062d1b896874b8a20104c9328d85df8ca45172419973c711d9e6bfa9e07e636059c5c54252c99822333f2ba192f4e37b579bd53f54d7eb863fc1c4382371a9724c2f32b37833ebc5fddd016acaac8500000000001a507974686e6574507974686e6574507974686e6574507974686e6574507974680000000857d57a640041555756000000000857d57a6400000000bb02c92a8a44210bf6234732fc2d01604bf9a35205005500e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b430000078c35d57f000000000146a22a00fffffff8000000006acaac85000000006acaac840000078c16c33df00000000165eb5ced0c5e7d34d7724165be4bc03ff5a5c558220b85e8db7412fff35ee16cd8330cac6a6c6eab312b591994280030da2ff50b6847cc321d95e2d750cdaa608fda2755e944d2ac1c5659fc725887033e43b7d40cb88d0b6c44b21f6f16985529c3a94abc2f417599906081b65df8c68496efd07dc24e2ab835780846b86301e39f8a0308f6ddb6d5ffdd702f8dfe240ba3d1211072d7bb581cd1c19e2360b339bdeb1d20c9167773e0e2d323c4dd4296173bc24c28277d22057d812234565e998c9dd133419fc8f7b069d464d789d5df4e7943ac1e43edd1b33a90725ac90b841d7750fd152143d4d5c6eb81ce0576b9c566eaa5005500ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace0000003a654149c4000000000b692a90fffffff8000000006acaac85000000006acaac840000003a645dc8b8000000000b24a7020c30d6baeafcf68e6713ab8daf3e3f99f378682b8e7412fff35ee16cd8330cac6a6c6eab312b591994280030da2ff50b6847cc321d95e2d750cdaa608fda2755e944d2ac1c5659fc725887033e43b7d40cb88d0b6c44b21f6f16985529c3a94abc2f417599906081b65df8c68496efd07dc24e2ab835780846b86301e39f8a0308f6ddb6d5ffdd702f8dfe240ba3d1211072d7bb581cd1c19e2360b339bdeb1d20c9167773e0e2d323c4dd4296173bc24c28277d22057d812234565e998c9dd133419fc8f7b069d464d789d5df4e7943ac1e43edd1b33a90725ac90b841d7750fd152143d4d5c6eb81ce0576b9c566eaa5005500ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d0000000290f6ed4c0000000000366ef8fffffff8000000006acaac85000000006acaac84000000029146169c00000000002f0a9a0c4d4070f5456e9eb6d80ec9eae6f25b74121a9e989e802f06bfa6757cccc53e845345d37ce4e746230e8df347235c240f1de83810eec0e168d7191c98da2755e944d2ac1c5659fc725887033e43b7d40cb88d0b6c44b21f6f16985529c3a94abc2f417599906081b65df8c68496efd07dc24e2ab835780846b86301e39f8a0308f6ddb6d5ffdd702f8dfe240ba3d1211072d7bb581cd1c19e2360b339bdeb1d20c9167773e0e2d323c4dd4296173bc24c28277d22057d812234565e998c9dd133419fc8f7b069d464d789d5df4e7943ac1e43edd1b33a90725ac90b841d7750fd152143d4d5c6eb81ce0576b9c566eaa500550031491744e2dbf6df7fcf4ac0820d18a609b49076d45066d3568424e62f686cd10000000000267b540000000000000414fffffff8000000006acaac85000000006acaac8400000000002651a700000000000004160ca2e11dbfcec36a17423883d81afa52135b9e926b9b2b9408d64633c9ada9285e5bc38bc6026160abe58b8f1242940d364b52a6a6d5ea690e763add035d79b3292079e3a74d6d14995c6b765e5c54f68c86b0ed91343c770b00970a4f0f48be8ece94dbdda14297e3fb752576b84669a247a6c76f77e64be08361eb4c16bb4e3d742ecdbc828e122d6a21058f14eaa54d62d725a282cd13859db506ddf975087a85826e567606b1331e1dbc492c74b919dadb50efe7a123d27bf203db00e9d4e6b1304d96ab5b0520854b7c197171e5659f23562bd62e92fcc8b9f6ff1d7750fd152143d4d5c6eb81ce0576b9c566eaa50055004279e31cc369bbcc2faf022b382b080e32a8e689ff20fbc530d2a603eb6cd98b00000001fcf48ca20000000000619e34fffffff8000000006acaac85000000006acaac8400000001fcafd5f30000000000701f2e0c3b98a67160e043c02d8b322b2e23f053e494891df668f13e264407b966506234a36e2de512e3e3892779787829eedc36fa2c4101fd5e022affe4a34af2e059ac762619f41fa68d5918f169a829d8f008e5855ca55a9efca6a1252fbfd506d08574abe803fcd379629417b569efb158c052a08d1743710a792d708ec0d2989eab865afd9162a616825a19cae6a3d1211072d7bb581cd1c19e2360b339bdeb1d20c9167773e0e2d323c4dd4296173bc24c28277d22057d812234565e998c9dd133419fc8f7b069d464d789d5df4e7943ac1e43edd1b33a90725ac90b841d7750fd152143d4d5c6eb81ce0576b9c566eaa5";

    OutcomeSeries os;
    PythResolver pr;

    function setUp() public {
        vm.createSelectFork("monad");
        os = new OutcomeSeries(address(new MockAUSD()), address(this));
        pr = new PythResolver(os, PYTH, 100);
    }

    receive() external payable {}

    function _series(uint64 expiry, int64 strike, int64 lower) internal returns (uint256 id) {
        vm.warp(expiry - 1 hours);
        id = os.createSeries(Kind.FX_FLOOR, address(pr), BTC, strike, lower, expiry, "BTC test");
        vm.warp(PUBLISH + 60);
    }

    function _u() internal pure returns (bytes[] memory u) {
        u = new bytes[](1);
        u[0] = UPDATE;
    }

    function test_resolvesWithRealUpdate() public {
        // K = 84000, L = 80000, S = 82987.80 -> payout = 1012.2 / 4000
        uint256 id = _series(PUBLISH, 84_000e8, 80_000e8);
        uint256 fee = PYTH.getUpdateFee(_u());
        pr.resolve{value: fee + 1 ether}(id, _u());

        Series memory s = os.series(id);
        assertEq(uint8(s.state), uint8(State.RESOLVED));
        assertEq(s.payout, (uint256(84_000e8 - 8298780000000) * 1e18) / 4000e8);
        assertEq(address(pr).balance, 0);
    }

    function test_rejectsPrintBeforeExpiry() public {
        uint256 id = _series(PUBLISH + 1, 84_000e8, 80_000e8);
        bytes[] memory u = _u();
        vm.expectRevert(PythErrors.PriceFeedNotFoundWithinRange.selector);
        pr.resolve{value: 5}(id, u);
    }

    function test_rejectsWideConfidence() public {
        // conf 54.80 on 82987.80 is ~6.6 bps; a 5 bps cap rejects it
        PythResolver strict = new PythResolver(os, PYTH, 5);
        vm.warp(PUBLISH - 1 hours);
        uint256 id = os.createSeries(Kind.FX_FLOOR, address(strict), BTC, 84_000e8, 80_000e8, PUBLISH, "BTC strict");
        vm.warp(PUBLISH + 60);
        bytes[] memory u = _u();
        vm.expectRevert(PythResolver.WideConfidence.selector);
        strict.resolve{value: 5}(id, u);
    }
}
