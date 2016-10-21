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

function checkEthBalance(address, expected, msg) {
  assert.equal(web3.eth.getBalance(address).toString(), expected, msg)
}

function newDeferred() {
  let value
  let resolve = null
  let reject = null

  let promise = new Promise((res, rej) => {
    if (resolve) res(value)
    else if (reject) rej(value)
    else {
      resolve = res
      reject = rej
    }
  })

  return {
    getPromise: () => promise,
    resolve: (resVal) => {
      if (resolve) resolve(resVal)
      else {
        resolve = true
        value = resVal
      }
    },
    reject: (rejVal) => {
      if (reject) reject(value)
      else {
        reject = true
        value = rejVal
      }
    }
  }
}

contract('Sale', function (accounts) {
  const TOKENS = 1000
  const PRICE = web3.toWei(0.01)
  let sale, eventFilter
  before(done => {
    Sale.new(TOKENS, PRICE, {from: accounts[0]})
    .then(contract => {
      sale = contract
      done()
    })
    .catch(done)
  })
  afterEach(() => {
    if (eventFilter) {
      eventFilter.stopWatching()
      eventFilter = null
      // workaround to create a new block on testRPC to avoid repeated events
      web3.eth.sendTransaction({from: accounts[0], to: accounts[1], value: web3.toWei(1, 'finney')})
    }
  })

  it('should be owned', () => {
    return sale.owner()
    .then(address => assert.equal(address, accounts[0]))
  })
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
  function testBuyTokenFor({buyer, amount, newBuyer=true, emitTokenSold=true, expContractBalance, expBuyerTokenBalance, expSoldTokens, expSaleEnded}) {
    let expectedBuyers

    let rejectTimeout
    let eventDeferred = newDeferred()
    eventFilter = sale.TokensSold((error, result) => {
      if (error) throw error
      let eventData = result.args
      if (eventData.buyer === '0x') return
      // console.log('### event tx:',result.transactionHash, 'data:', eventData.buyer, eventData.payed.toString(), eventData.change.toString())
      assert.equal(eventData.buyer, buyer, 'TokensSold event (buyer)')
      // assert.equal(eventData.promoter, xxxx, 'TokensSold event (promoter)')
      // assert.equal(eventData.tokens, xxxx, 'TokensSold event (tokens)')
      // assert.equal(eventData.payed, xxxxx, 'TokensSold event (payed)')
      // assert.equal(eventData.change, xxxxx, 'TokensSold event (change)')
      //TODO: check all event fields
      clearTimeout(rejectTimeout)
      eventDeferred.resolve()
    })
    return sale.getBuyers().then(value => expectedBuyers = newBuyer ? [...value, buyer] : value)
      .then(() => sale.buyTokenFor(buyer, {from: buyer, value: amount}))
      .then(() => checkNumber(sale.balanceOf(buyer), expBuyerTokenBalance, 'balance of buyer'))
      .then(() => checkNumber(sale.soldTokens(), expSoldTokens, 'soldTokens'))
      .then(() => checkDeepEqual(sale.getBuyers(), expectedBuyers, 'buyer added to the array of buyers'))
      .then(() => checkEqual(sale.saleEnded(), expSaleEnded, 'saleEnded'))
      .then(() => checkEthBalance(sale.address, expContractBalance, 'contract balance'))
      .then(() => {
        rejectTimeout = setTimeout(() => eventDeferred.reject(), 1000)
        return eventDeferred.getPromise()
      })
  }
  it('buyTokenFor should update balances', () => {
    const buyer = accounts[2]
    const amount = web3.toWei(0.105)
    const CHANGE = amount % PRICE
    return testBuyTokenFor({buyer, amount,
      expBuyerTokenBalance: 10,
      expSoldTokens: 10,
      expContractBalance: amount - CHANGE,
      expSaleEnded: false
    })
  })
  it('buyTokenFor without change', () => {
    const buyer = accounts[3]
    const amount = web3.toWei(0.10)
    return testBuyTokenFor({buyer, amount,
      expBuyerTokenBalance: 10,
      expSoldTokens: 10 + 10,
      expContractBalance: web3.eth.getBalance(sale.address).plus(amount),
      expSaleEnded: false
    })
  })
  it('buyTokenFor with change lower than 1 finney', () => {
    const buyer = accounts[3]
    const amount = web3.toWei(0.10099)
    return testBuyTokenFor({buyer, amount, newBuyer: false,
      expBuyerTokenBalance: 10 + 10,
      expSoldTokens: 20 + 10,
      expContractBalance: web3.eth.getBalance(sale.address).plus(amount),
      expSaleEnded: false
    })
  })
  it('buyTokenFor with few amount', () => {
    const buyer = accounts[4]
    const amount = web3.toWei(0.009999)
    return testBuyTokenFor({buyer, amount,
      expBuyerTokenBalance: 0,
      expSoldTokens: 30,
      expContractBalance: web3.eth.getBalance(sale.address),
      expSaleEnded: false
    })
    .catch(err => assert.match(err.message, /invalid JUMP/, 'testRPC should throw "invalid JUMP"'))
  })
  it('buy using a promoter', () => {
    const BUYER = accounts[1]
    const AMOUNT = web3.toWei(0.02)
    const EXPECTED_BALANCE = web3.eth.getBalance(sale.address).plus(AMOUNT)
    return sale.promoters(0)
    .then(address => {
      //console.log(web3.eth.estimateGas({from: BUYER, to: address, value: AMOUNT}))
      web3.eth.sendTransaction({from: BUYER, to: address, value: AMOUNT, gas: 180000})
      checkEthBalance(address, 0, 'Promoter balance')
      return sale.promotersData(address)
      .then(data => {
        assert.equal(data[1].toNumber(), 2, 'tokensSold')
        assert.equal(data[2].toNumber(), AMOUNT, 'ethCollected')
      })
      .then(() => checkNumber(sale.balanceOf(BUYER), 2))
      .then(() => checkEthBalance(sale.address, EXPECTED_BALANCE, 'Sale contract balance'))
    })
  })
  it('stopSale() only from owner', () => {
    return sale.stopSale(true, {from: accounts[1]})
    .then(() => checkEqual(sale.saleStopped(), false, 'saleStopped'))
    .then(() => checkEqual(sale.saleEnded(), fakse, 'saleEnded'))
    .catch(err => assert.match(err.message, /invalid JUMP/, 'testRPC should throw "invalid JUMP"'))
  })
  it('stopSale() should stop sale', () => {
    return sale.stopSale(true, {from: accounts[0]})
      .then(() => checkEqual(sale.saleStopped(), true, 'saleStopped'))
      .then(() => checkEqual(sale.saleEnded(), true, 'saleEnded'))
      .catch(err => assert.match(err.message, /invalid JUMP/, 'testRPC should throw "invalid JUMP"'))
  })
  it('buyTokenFor() if stopped sale should fail', () => {
    const buyer = accounts[5]
    const amount = web3.toWei(0.1)
    return testBuyTokenFor({buyer, amount,
      expBuyerTokenBalance: 0,
      expSoldTokens: TOKENS,
      expContractBalance: web3.eth.getBalance(sale.address),
      expSaleEnded: true
    })
    .catch(err => assert.match(err.message, /invalid JUMP/, 'testRPC should throw "invalid JUMP"'))
  })
  it('stopSale() should resume sale', () => {
    return sale.stopSale(false, {from: accounts[0]})
    .then(() => checkEqual(sale.saleStopped(), false, 'saleStopped'))
    .then(() => checkEqual(sale.saleEnded(), false, 'saleEnded'))
    .catch(err => assert.match(err.message, /invalid JUMP/, 'testRPC should throw "invalid JUMP"'))
  })
  it('buyTokenFor() buy all remaining tokens', () => {
    const buyer = accounts[5]
    const amount = TOKENS * PRICE
    const EXPECTED_TOKENS = TOKENS - 32
    const CHANGE = amount - EXPECTED_TOKENS*PRICE
    var EXPECTED_CONTRACT_BALANCE = web3.eth.getBalance(sale.address).plus(amount).minus(CHANGE);
    return testBuyTokenFor({buyer, amount,
      expBuyerTokenBalance: EXPECTED_TOKENS,
      expSoldTokens: TOKENS,
      expContractBalance: EXPECTED_CONTRACT_BALANCE.toString(),
      expSaleEnded: true
    })
  })
  it('buyTokenFor after end should fail', () => {
    const buyer = accounts[6]
    const amount = web3.toWei(0.1)
    return testBuyTokenFor({buyer, amount,
      expBuyerTokenBalance: 0,
      expSoldTokens: TOKENS,
      expContractBalance: web3.eth.getBalance(sale.address),
      expSaleEnded: true
    })
    .catch(err => assert.match(err.message, /invalid JUMP/, 'testRPC should throw "invalid JUMP"'))
  })
  it('withdraw() only by owner', () => {
    let saleBalance = web3.eth.getBalance(sale.address)
    return sale.withdraw(1, {from: accounts[1]})
      .then(() => {
        checkEqual(web3.eth.getBalance(sale.address), saleBalance, 'balance')
      })
      .catch(err => assert.match(err.message, /invalid JUMP/, 'testRPC should throw "invalid JUMP"'))
  })
  it('withdraw() should transfer ethers', () => {
    const account = accounts[0]
    const gasPrice = web3.toBigNumber(web3.toWei(25, 'Gwei'))
    let saleBalance = web3.eth.getBalance(sale.address)
    let initialAccBal = web3.eth.getBalance(account)
    let fees
    return sale.withdraw.estimateGas(saleBalance, {from: account, gasPrice})
      .then(gas => fees = gasPrice.mul(gas))
      .then(() => sale.withdraw(saleBalance, {from: account, gasPrice}))
      .then(() => {
        assert.equal(web3.eth.getBalance(sale.address).toNumber(), 0, 'sale balance')
        const expected = initialAccBal.plus(saleBalance).minus(fees)
        const error = expected.minus(web3.eth.getBalance(account)).absoluteValue().div(expected).toNumber()
        assert.isBelow(error, 0.00001, 'transfered amount rate')
        // assert.equal(web3.eth.getBalance(account).toString(), expected.toString(), 'account balance')
      })
  })
})
