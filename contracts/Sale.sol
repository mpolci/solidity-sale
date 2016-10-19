pragma solidity ^0.4.1;

import "owned.sol";
import "PromotedSale.sol";
import "SaleInterface.sol";

contract Sale is owned, PromotedSale, SaleInterface {
    uint public tokenPrice;
    uint public maxTokens;

    uint public soldTokens = 0;
    bool public saleStopped = false;
    mapping (address => uint) public balanceOf;
    address[] buyers;

    event TokensSold(address indexed buyer, address indexed promoter, uint tokens, uint payed, uint change);

    function Sale (uint _maxTokens, uint _price) {
        maxTokens = _maxTokens;
        tokenPrice = _price;
    }

    function stopSale(bool stop) onlyOwner {
      saleStopped = stop;
    }

    function getBuyers() constant returns(address []) {
        return buyers;
    }

    function saleEnded() constant returns(bool) {
      return soldTokens >= maxTokens || saleStopped;
    }

    function registerPromoter(address id) onlyOwner returns(address saleAddress){
      return createPromoter(id);
    }

    // Pay attention calling this function from another contract. This function could terminate with a address.call.value()
    function buyTokenFor(address buyer) payable {
        if (saleStopped) throw;
        uint qty = msg.value / tokenPrice;
        uint availableTokens = maxTokens - soldTokens;
        if (qty == 0) throw;
        if (availableTokens == 0) throw;
        if (qty > availableTokens) {
          qty = availableTokens;
        }
        uint toSpend = qty * tokenPrice;
        uint toRefund = msg.value - toSpend;

        soldTokens += qty;
        if (balanceOf[buyer] == 0)
            buyers.push(buyer);
        balanceOf[buyer] += qty;
        updatePromotedBalances({source: msg.sender, eth: toSpend, tokens: qty});
        if (toRefund >= 1 finney) {
            if (!buyer.call.value(toRefund)()) throw;
        }
        TokensSold({buyer: buyer, promoter: msg.sender, tokens: qty, payed: toSpend, change: toRefund});
    }

    function () payable {
        buyTokenFor(msg.sender);
    }

    function withdraw(uint amount) onlyOwner {
        msg.sender.call.value(amount);
    }

}
