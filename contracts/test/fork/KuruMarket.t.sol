// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IKuruRouter {
    event MarketRegistered(
        address baseAsset, address quoteAsset, address market, address vaultAddress, uint32 pricePrecision,
        uint96 sizePrecision, uint32 tickSize, uint96 minSize, uint96 maxSize, uint256 takerFeeBps,
        uint256 makerFeeBps, uint96 kuruAmmSpread
    );

    function deployProxy(
        uint8 _type, address _base, address _quote, uint96 _sizePrecision, uint32 _pricePrecision, uint32 _tickSize,
        uint96 _minSize, uint96 _maxSize, uint256 _takerFeeBps, uint256 _makerFeeBps, uint96 _kuruAmmSpread
    ) external returns (address);
}

interface IKuruOrderBook {
    function addSellOrder(uint32 price, uint96 size, bool postOnly) external;
    function placeAndExecuteMarketBuy(uint96 quoteSize, uint256 minAmountOut, bool isMargin, bool isFillOrKill)
        external
        payable
        returns (uint256);
    function bestBidAsk() external view returns (uint256, uint256);
    function getL2Book() external view returns (bytes memory);
}

interface IKuruMarginAccount {
    function deposit(address user, address token, uint256 amount) external payable;
    function withdraw(uint256 amount, address token) external;
    function getBalance(address user, address token) external view returns (uint256);
}

contract Dummy is ERC20("Dummy PROTECT", "dPROT") {
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 a) external {
        _mint(to, a);
    }
}

contract KuruMarketForkTest is Test {
    IKuruRouter constant ROUTER = IKuruRouter(0x7EFbE105Ca7415dE98F96622173458ac1c054630);
    IKuruMarginAccount constant MARGIN = IKuruMarginAccount(0xd029C2D98ff85D8F64799017fE00a59B1159CE02);
    address constant AUSD = 0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC;

    function setUp() public {
        vm.createSelectFork("monad");
    }

    function test_createMarketPostAskMarketBuy() public {
        Dummy base = new Dummy();
        address maker = makeAddr("maker");
        address taker = makeAddr("taker");

        // price unit 1e-4 AUSD, tick 0.001 AUSD; size unit 1e-6 PROTECT, min 1 PROTECT
        address market = ROUTER.deployProxy(0, address(base), AUSD, 1e6, 1e4, 10, 1e6, 1e15, 0, 0, 100);
        console.log("market", market);

        // maker posts an ask: 100 PROTECT @ 0.0500 AUSD from the margin account
        base.mint(maker, 100e6);
        vm.startPrank(maker);
        base.approve(address(MARGIN), 100e6);
        MARGIN.deposit(maker, address(base), 100e6);
        IKuruOrderBook(market).addSellOrder(500, 100e6, true);
        vm.stopPrank();
        (uint256 bid, uint256 ask) = IKuruOrderBook(market).bestBidAsk();
        console.log("bestBid", bid, "bestAsk", ask);
        // L2 layout: blockNumber, (price, size)* bids, 0, (price, size)* asks; price in pricePrecision units
        (, uint256 noBids, uint256 askPrice, uint256 askSize) =
            abi.decode(IKuruOrderBook(market).getL2Book(), (uint256, uint256, uint256, uint256));
        assertEq(noBids, 0);
        assertEq(askPrice, 500);
        assertEq(askSize, 100e6);

        // taker market-buys with 2 AUSD from the wallet
        // AUSD packs the balance above an 8-bit flag field, so deal() cannot locate it
        vm.store(AUSD, 0x7894f2682f1c6b551d816a5345ce6198d6f3526abbcc203aba98bd85f4aa64cc, bytes32(uint256(10e6) << 8));
        vm.startPrank(taker);
        ERC20(AUSD).approve(market, type(uint256).max);
        uint256 out = IKuruOrderBook(market).placeAndExecuteMarketBuy(2e4, 0, false, false);
        vm.stopPrank();
        console.log("baseOut", out);
        console.log("taker PROTECT", base.balanceOf(taker));
        console.log("taker AUSD", ERC20(AUSD).balanceOf(taker));
        console.log("maker AUSD in margin", MARGIN.getBalance(maker, AUSD));
        assertEq(base.balanceOf(taker), 40e6);
        assertEq(ERC20(AUSD).balanceOf(taker), 8e6);

        vm.prank(maker);
        MARGIN.withdraw(2e6, AUSD);
        assertEq(ERC20(AUSD).balanceOf(maker), 2e6);
    }
}
