// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice PROTECT or BACK leg of a series. Only the issuing OutcomeSeries can mint and burn.
contract OutcomeToken is ERC20 {
    address public immutable issuer;

    error OnlyIssuer();

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        issuer = msg.sender;
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != issuer) revert OnlyIssuer();
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        if (msg.sender != issuer) revert OnlyIssuer();
        _burn(from, amount);
    }
}
