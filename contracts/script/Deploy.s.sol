// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/NFTEscrow.sol";
import "../src/LendingPool.sol";
import "../src/LiquidationAuction.sol";
import "../src/LoanManager.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        NFTEscrow escrow       = new NFTEscrow();
        LendingPool pool       = new LendingPool();
        LiquidationAuction auc = new LiquidationAuction(address(escrow));
        LoanManager manager    = new LoanManager(address(escrow), address(pool), address(auc));

        escrow.setLoanManager(address(manager));
        pool.setLoanManager(address(manager));
        auc.setLoanManager(address(manager));

        vm.stopBroadcast();

        console.log("NFTEscrow:          ", address(escrow));
        console.log("LendingPool:        ", address(pool));
        console.log("LiquidationAuction: ", address(auc));
        console.log("LoanManager:        ", address(manager));
    }
}