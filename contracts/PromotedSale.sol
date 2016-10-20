pragma solidity ^0.4.0;

//import "SaleInterface.sol";
import "Promoter.sol";

contract PromotedSale {
  struct PromData {
    address owner;       // this address is used only to identify the promoter
    uint tokensSold;
    uint ethCollected;
  }
  address [] public promoters;
  mapping (address => PromData) public promotersData;
  event PromoterRegistered(uint index, address saleAddress, address ownerAddress);

  function getPromotersCount() constant returns(uint) {
    return promoters.length;
  }

  function getPromoters() constant returns(address []) {
    return promoters;
  }

  function createPromoter(address owner) internal returns(address) {
    Promoter created = new Promoter();
    var data = promotersData[created];
    data.owner = owner;
    var idx = promoters.push(address(created));
    PromoterRegistered(idx, created, owner);
    return created;
  }

  function newPromoter() returns(address) {
    return createPromoter(msg.sender);
  }

  function updatePromotedBalances(address source, uint eth, uint tokens) internal {
    var data = promotersData[source];
    if (data.owner != 0) {
      data.tokensSold += tokens;
      data.ethCollected += eth;
    }
  }

}
