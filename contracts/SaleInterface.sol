pragma solidity ^0.4.1;

contract SaleInterface {
  uint public soldTokens;
  mapping (address => uint) public balanceOf;
  function buyTokenFor(address buyer) payable;
  function getBuyers() constant returns(address []);
  function saleEnded() constant returns(bool);
}
