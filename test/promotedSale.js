const NULL_ADDRESSES = ['', '0x0', '0x', '0x0000000000000000000000000000000000000000']

contract('PromotedSale', function (accounts) {
  const from0 = {from: accounts[0]}
  let sale
  before(done => {
    PromotedSaleTest.new(from0)
    .then(contract => {
      sale = contract
      done()
    })
    .catch(done)
  })

  it('should have no promoters', () => {
    return sale.promotersCount()
    .then(value => assert.equal(value, 0, 'promotersCount() should return 0'))
    .then(() => sale.promoters(0))
    .then(address => {
      assert.oneOf(address, NULL_ADDRESSES)
    })
    .catch(err => {
      assert.match(err.message, /invalid JUMP/, 'testRPC should throw "invalid JUMP"')
    })
  })
  it('creator account should not be in promotersData', () => {
    return sale.promotersData(from0.from)
    .then(data => {
      // call to Sale.promotersData(address) returns an array rapresenting the PromData struct:
      // data[0] -> PromData.owner
      // data[1] -> PromData.tokensSold
      // data[2] -> PromData.ethCollected
      assert.oneOf(data[0], NULL_ADDRESSES, 'owner should be zero address')
      assert.equal(data[1].toNumber(), 0, 'tokensSold should be 0')
      assert.equal(data[2].toNumber(), 0, 'ethCollected should be 0')
    })
  })
  ;[0,1].forEach(idx => {
    it(`newPromoter() should create a promoter ${idx}`, () => {
      let address
      return sale.newPromoter.call({from: accounts[idx]})
      .then(addr => address = addr)
      .then(() => sale.newPromoter({from: accounts[idx]}))
      .then(txid => sale.promotersCount())
      .then(count => {
        assert.equal(count.toNumber(), idx+1, 'promoters count')
        assert.notInclude(NULL_ADDRESSES, address, 'returned contract address')
      })
      .then(() => sale.promoters(idx))
      .then(value => assert.equal(value, address, 'new promoter should be in the promoters array'))

    })
    it(`the promoter ${idx} should have data initialized`, () => {
      return sale.promoters(idx)
      then(address => sale.promotersData(address))
      .then(data => {
        assert.equal(data[0], accounts[idx], 'owner')
        assert.equal(data[1].toNumber(), 0, 'tokensSold should be 0')
        assert.equal(data[2].toNumber(), 0, 'ethCollected should be 0')
      })
    })
  })
  it('updatePromotedBalances should be internal', () => {
    assert.isUndefined(sale.updatePromotedBalances)
  })
  it('updatePromotedBalances should update balances of related promoter', () => {
    return sale.promoters(1)
    .then(address => {
      return sale.updatePromotedBalancesT(address, 123456789, 100)
      .then(() => sale.promotersData(address))
      .then(data => {
        assert.equal(data[1].toNumber(), 100, 'tokensSold')
        assert.equal(data[2].toNumber(), 123456789, 'ethCollected')
      })
    })
    .then(() => sale.promoters(0))
    .then(address => sale.promotersData(address))
    .then(data => {
      assert.equal(data[1].toNumber(), 0, 'tokensSold')
      assert.equal(data[2].toNumber(), 0, 'ethCollected')
    })
  })
  it('updatePromotedBalances should add balances', () => {
    return sale.promoters(1)
    .then(address => {
      return sale.updatePromotedBalancesT(address, 1, 2)
      .then(() => sale.promotersData(address))
      .then(data => {
        assert.equal(data[1].toNumber(), 102, 'tokensSold')
        assert.equal(data[2].toNumber(), 123456790, 'ethCollected')
      })
    })
  })

})
