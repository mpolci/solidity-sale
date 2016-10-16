pragma solidity ^0.4.1;

import "SaleInterface.sol";

contract Promoter {
  SaleInterface sale;
  function Promoter () {
    sale = SaleInterface(msg.sender);
  }

  function () payable {
    sale.buyTokenFor.value(msg.value)(msg.sender);
  }
}
