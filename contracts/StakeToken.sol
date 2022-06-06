//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract StakeToken is ERC20, Ownable {
    constructor() ERC20("StakeToken", "ST") {
    }


    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }

    function burn(address _to, uint256 _amount) public onlyOwner {
        _burn(_to, _amount);
    }

}