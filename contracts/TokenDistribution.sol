pragma solidity ^0.4.1;

import "SaleInterface.sol";
import "ERC20.sol";
import "owned.sol";

contract TokenDistribution is owned {
  SaleInterface public sale;
  ERC20 public token;
  bool public distributionStarted = false;
  uint public given = 0;

  mapping (address => uint) public givenTo;  // token given to each address

  event TokenGiven(address recipient, uint quantity);

  function TokenDistribution(SaleInterface _sale, ERC20 _token) {
    sale = _sale;
    token = _token;
  }

  function withdraw() {
    giveTo(msg.sender);
  }

  function giveTo(address recipient) {
    if (!distributionStarted) {
      if (!sale.saleEnded()) throw;
      if (token.balanceOf(this) != sale.soldTokens()) throw;
      distributionStarted = true;
    }

    var qty = sale.balanceOf(recipient) - givenTo[recipient];
    if (qty > 0) {
      givenTo[recipient] += qty;
      given += qty;
      if (!token.transfer(recipient, qty)) throw;
      TokenGiven(recipient, qty);
    }
  }
}
