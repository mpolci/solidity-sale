pragma solidity ^0.4.0;

import "PromotedSale.sol";

contract PromotedSaleTest is PromotedSale {
  function updatePromotedBalancesT (address source, uint eth, uint tokens) {
    updatePromotedBalances(source, eth, tokens);
  }
}
