function getValues(contract, propArray) {
  Promise.all(propArray.map(name => contract[name]()))
  .then(results => {

    let obj = {}
    for (i = 0; i < propArray.length; i++) {
      obj[propArray[i]] = results[i]
    }
    return obj
  })
}

function checkNumber(promise, expected, desc) {
  return promise.then(value => assert.equal(value.toNumber(), expected, desc))
}

function checkEqual(promise, expected, desc) {
  return promise.then(value => assert.equal(value, expected, desc))
}

function checkDeepEqual(promise, expected, desc) {
  return promise.then(value => assert.deepEqual(value, expected, desc))
}

function checkFailOrNullAddress(promise) {
  return promise
  .then(address => assert.oneOf(address, NULL_ADDRESSES))
  .catch(err => assert.match(err.message, /invalid JUMP/, 'testRPC should throw "invalid JUMP"'))
}

contract('Sale', function (accounts) {
  const TOKENS = 1000^6
  const PRICE = web3.toWei(0.01)
  let sale
  before(done => {
    Sale.new(TOKENS, PRICE, {from: accounts[0]})
    .then(contract => {
      sale = contract
      done()
    })
    .catch(done)
  })

  it('should be owned', () => {
    return sale.owner()
    .then(address => assert.equal(address, accounts[0]))
  })
  // it('should be initialized', () => {
  //   return sale.soldTokens().then(value =>
  //     assert.equal(value.toNumber(), 0, 'soldTokens'))
  //   .then(() => sale.tokenPrice()).then(value =>
  //     assert.equal(value.toNumber(), PRICE, 'tokenPrice'))
  //   .then(() => sale.maxTokens()).then(value =>
  //     assert.equal(value.toNumber(), TOKENS, 'maxTokens'))
  //   .then(() => sale.balanceOf(accounts[0])).then(value =>
  //     assert.equal(value.toNumber(), 0, 'balance of creator'))
  //   .then(() => sale.getBuyers()).then(value =>
  //     assert.deepEqual(value, [], 'buyers array'))
  //   .then(() => sale.saleEnded()).then(value =>
  //     assert.equal(value, false, 'saleEnded'))
  // })
  it('should be initialized', () => {
    return checkNumber(sale.soldTokens(), 0, 'soldTokens')
    .then(() => checkNumber(sale.tokenPrice(), PRICE, 'tokenPrice'))
    .then(() => checkNumber(sale.maxTokens(), TOKENS, 'maxTokens'))
    .then(() => checkNumber(sale.balanceOf(accounts[0]), 0, 'balance of creator'))
    .then(() => checkDeepEqual(sale.getBuyers(), [], 'buyers array'))
    .then(() => checkEqual(sale.saleEnded(), false, 'saleEnded'))
    .then(() => assert.equal(web3.eth.getBalance(sale.address).toNumber(), 0, 'contract balance'))
  })
  it('should register a promoter', () => {
    return sale.registerPromoter.call(accounts[1], {from: accounts[0]})
    .then(address => {
      return sale.registerPromoter(accounts[1])
      .then(() => checkEqual(sale.promoters(0), address))
    })
  })
  it('only owner could register a promoter', () => {
    return checkFailOrNullAddress(sale.registerPromoter.call(accounts[2], {from: accounts[1]}))
  })
  it('buyTokenFor should update balances', () => {
    const BUYER = accounts[2]
    const AMOUNT = web3.toWei(0.105)
    const CHANGE = AMOUNT % PRICE
    // console.log('Initial balance:', web3.eth.getBalance(sale.address).toString(), 'amount to send:', AMOUNT)
    return sale.buyTokenFor(BUYER, {from: BUYER, value: AMOUNT})
    // .then(() => console.log('new balance:', web3.eth.getBalance(sale.address).toString()))
    .then(() => checkNumber(sale.balanceOf(BUYER), 10, 'balance of buyer'))
    .then(() => checkNumber(sale.soldTokens(), 10, 'soldTokens'))
    .then(() => checkDeepEqual(sale.getBuyers(), [BUYER]))
    .then(() => checkEqual(sale.saleEnded(), false, 'saleEnded'))
    .then(() => assert.equal(web3.eth.getBalance(sale.address).toString(), AMOUNT - CHANGE, 'contract balance'))
  })
  it('buy using a promoter', () => {
    const BUYER = accounts[1]
    const AMOUNT = web3.toWei(0.02)
    return sale.promoters(0)
    .then(address => {
      //console.log(web3.eth.estimateGas({from: BUYER, to: address, value: AMOUNT}))
      web3.eth.sendTransaction({from: BUYER, to: address, value: AMOUNT, gas: 180000})
      return sale.promotersData(address)
      .then(data => {
        assert.equal(data[1].toNumber(), 2, 'tokensSold')
        assert.equal(data[2].toNumber(), AMOUNT, 'ethCollected')
      })
      .then(() => checkNumber(sale.balanceOf(BUYER), 2))
    })
  })
  // it('should be initialized', () => {
  //   //return sale.
  // })
  // it('should be initialized', () => {
  //   //return sale.
  // })
  // it('should be initialized', () => {
  //   //return sale.
  // })
})
