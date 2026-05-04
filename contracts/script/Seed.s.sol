// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/LendingPool.sol";

contract Seed is Script {
    function run() external {
        address poolAddr = vm.envAddress("LENDING_POOL_ADDRESS");
        uint256 key = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(key);
        LendingPool pool = LendingPool(poolAddr);
        pool.createOffer{value: 0.5 ether}(500, 7);
        pool.createOffer{value: 1 ether}(1000, 30);
        pool.createOffer{value: 2 ether}(800, 14);
        vm.stopBroadcast();
        console.log("Seeded 3 lending offers");
    }
}       