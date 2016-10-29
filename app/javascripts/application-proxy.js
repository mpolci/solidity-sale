angular.module('tokenSaleApp', ['ngResource'])
.controller('TokenSaleController', function ($scope, $q, $interval, $http) {
  var self = this
  var DECIMALPLACES = 15
  var PROXY = 'http://localhost:3001'
  angular.extend(this, {
    promoters: [],
    saleAddress: null,
    totalTokensSold: 0,
    maxTokens: 0,
    tokenPrice: 0,
    saleEnded: false,

    selectedAddress: null,
    balanceOfSelected: 0,
    updateSelectedBalance: updateSelectedBalance,
  })
  var sale = Sale.deployed()
  self.saleAddress = sale.address;

  $q.all([
    updatePromoters(),
    updateTotalTokensSold(),
    updateSaleEnded(),
    updateTokenData()
  ]).catch(error)

  // catch event of tokens sold
  // var eventListener = sale.TokensSold(function (err, event) {
  //   if (err) return error(err)
  //   console.log('sold', convertTokenNumber(event.args.tokens), 'tokens to:', event.args.buyer)
  //   $q.all([
  //     updateTotalTokensSold(),
  //     updateSaleEnded(),
  //   ]).catch(error)
  //   if (self.selectedAddress) updateSelectedBalance()
  // })

  //polling state
  var timer = $interval(function() {
    $q.all([
      updateTotalTokensSold(),
      updateSaleEnded(),
      updateSelectedBalance()
    ]).catch(error)
  }, 10000)

  $scope.$on('$destroy', function () {
    // eventListener.stopWatching()
    $interval.cancel(timer)
  })

  /************************/

  function error (err) {
    console.error(err)
    alert(err.message || err)
  }

  function convertTokenNumber (value) {
    return web3.toBigNumber(value).shift(-DECIMALPLACES).toNumber()
  }

  /* GET   /sale/promoters                 get promoters list (array of addresses)
   * GET   /sale/tokens/sold               get the number of tokens sold
   * GET   /sale/ended                     get the state of sale (boolean)
   * GET   /sale/tokens/max                get the max number of tokens for sale
   * GET   /sale/tokens/price              get the price for each token
   * GET   /sale/buyer/:id/balance
   */

  function updatePromoters () {
    // return sale.getPromoters()
    return $http.get(PROXY + '/api/sale/promoters')
      .then(function (res) {
        self.promoters = res.data
      })
  }

  function updateTotalTokensSold () {
    // return sale.soldTokens()
    return $http.get(PROXY + '/api/sale/tokens/sold')
      .then(function (res) {
        self.totalTokensSold = convertTokenNumber(res.data)
      })
  }

  function updateSaleEnded () {
    // return sale.saleEnded()
    return $http.get(PROXY + '/api/sale/ended')
      .then(function (res) {
        self.saleEnded = res.data
      })
  }

  function updateTokenData () {
    return $q.all([
      // sale.maxTokens(),
      // sale.tokenPrice(),
      $http.get(PROXY + '/api/sale/tokens/max'),
      $http.get(PROXY + '/api/sale/tokens/price')
    ]).then(function (res) {
      self.maxTokens = convertTokenNumber(res[0].data)
      self.tokenPrice = web3.fromWei(web3.toBigNumber(res[1].data).shift(DECIMALPLACES)).toNumber()
    })
  }

  function updateSelectedBalance () {
    if (!self.selectedAddress) return
    $http.get(PROXY + '/api/sale/buyer/' + self.selectedAddress + '/balance')
    .then(function (res) {
      self.balanceOfSelected = convertTokenNumber(res.data)
    })
    .catch(function(err) {
      self.balanceOfSelected = null
      error(err)
    })
  }
})

/**************************** Tools to create transactions for testing ****************************/
