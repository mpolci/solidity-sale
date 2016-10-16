pragma solidity ^0.4.1;

import "owned.sol";
import "PromotedSale.sol";
import "AddressSet.sol";
import "SaleInterface.sol";

contract Sale is owned, PromotedSale, SaleInterface {
    uint public tokenPrice;
    uint public maxTokens;

    uint public soldTokens = 0;

    mapping (address => uint) public balanceOf;

    using AddressSet for AddressSet.data;
    AddressSet.data buyers;

    function Sale (uint _maxTokens, uint _price) {
        maxTokens = _maxTokens;
        tokenPrice = _price;
    }

    function getBuyers() constant returns(address []) {
        return buyers.items;
    }

    function registerPromoter(address id) onlyOwner returns(address saleAddress){
      return createPromoter(id);
    }

    // Pay attention calling this function from another contract. This function could terminate with a address.call.value()
    function buyTokenFor(address buyer) payable {
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
        buyers.insert(buyer);
        balanceOf[buyer] += qty;
        updatePromotedBalances({source: msg.sender, eth: toSpend, tokens: qty});
        if (toRefund > 0) {
            if (!buyer.call.value(toRefund)()) throw;
        }
    }

    function () payable {
        buyTokenFor(msg.sender);
    }

    function withdraw(uint amount) onlyOwner {
        msg.sender.call.value(amount);
    }

    function saleEnded() constant returns(bool) {
      return false; // TODO
    }
}
