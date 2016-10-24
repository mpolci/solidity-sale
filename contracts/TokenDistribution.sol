pragma solidity ^0.4.1;

import "SaleInterface.sol";
import "ERC20.sol";
import "owned.sol";

contract TokenDistribution is owned {
  SaleInterface public sale;
  ERC20 public token;
  address holder;  // the address owning the tokens to be distributed, it should approve a transfer of a number of tokens equals to the sale
  bool public distributionStarted = false;
  uint public given = 0;

  mapping (address => uint) public givenTo;  // token given to each address

  event TokenGiven(address recipient, uint quantity);

  function TokenDistribution(SaleInterface _sale, ERC20 _token, address _holder) {
    sale = _sale;
    token = _token;
    holder = _holder;
  }

  function withdraw() {
    giveTo(msg.sender);
  }

  function giveTo(address recipient) {
    if (!distributionStarted) {
      if (!sale.saleEnded()) throw;
      if (token.allowance(holder, this) != sale.soldTokens()) throw;
      distributionStarted = true;
    }

    var qty = sale.balanceOf(recipient) - givenTo[recipient];
    if (qty > 0) {
      givenTo[recipient] += qty;
      given += qty;
      if (!token.transferFrom(holder, recipient, qty)) throw;
      TokenGiven(recipient, qty);
    }
  }
}
