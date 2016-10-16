pragma solidity ^0.4.1;

// inspired by IntegerSet at https://github.com/ethereum/wiki/wiki/Solidity-Features#internal-types-for-libraries
// but unlike it AddressSet don't waste the first element of the items array
library AddressSet {
  struct data {
    /// Mapping item => index+1 (0 if not present)
    mapping(address => uint) sindex;
    /// Items by index
    address[] items;
    /// Number of stored items.
    uint size;
  }

  function insert(data storage self, address value) returns (uint8 result) {
    uint sindex = self.sindex[value];
    if (sindex > 0)
      return 1;
    else
    {
      self.items.push(value);
      sindex = self.items.length;
      self.sindex[value] = sindex;
      self.size++;
      return 2;
    }
  }

  function remove(data storage self, address value) returns (bool success) {
    uint sindex = self.sindex[value];
    if (sindex == 0)
      return false;
    delete self.sindex[value];
    delete self.items[sindex-1];
    self.size --;
    return true;
  }

  function contains(data storage self, address value) constant returns (bool) {
    return self.sindex[value] > 0;
  }

  function first_valid(data storage self, uint index) private constant returns (uint r_index) {
    while (iterate_valid(self, index) && self.sindex[self.items[index]] != index+1)
      index++;
    return index;
  }

  function iterate_start(data storage self) constant returns (uint index) {
    return first_valid(self, 0);
  }

  function iterate_valid(data storage self, uint index) constant returns (bool) {
    return index < self.items.length;
  }

  function iterate_advance(data storage self, uint index) constant returns (uint r_index) {
    index++;
    return first_valid(self, index);
  }

  function iterate_get(data storage self, uint index) constant returns (address value) {
      return self.items[index];
  }
}
