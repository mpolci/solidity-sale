angular.module('tokenSaleApp', ['Transactions'])
.controller('TokenSaleController', function ($scope, $q) {
  var self = this
  var DECIMALPLACES = 15
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
  var eventListener = sale.TokensSold(function (err, event) {
    if (err) return error(err)
    console.log('sold', convertTokenNumber(event.args.tokens), 'tokens to:', event.args.buyer)
    $q.all([
      updateTotalTokensSold(),
      updateSaleEnded(),
    ]).catch(error)
    if (self.selectedAddress) updateSelectedBalance()
  })

  $scope.$on('$destroy', function () {
    eventListener.stopWatching()
  })

  /************************/

  function error (err) {
    console.error(err)
    alert(err.message || err)
  }

  function convertTokenNumber (value) {
    return value.shift(-DECIMALPLACES).toNumber()
  }

  function updatePromoters () {
    return sale.getPromoters()
      .then(function (value) {
        self.promoters = value
      })
  }

  function updateTotalTokensSold () {
    return sale.soldTokens()
      .then(function (value) {
        self.totalTokensSold = convertTokenNumber(value)
      })
  }

  function updateSaleEnded () {
    return sale.saleEnded()
      .then(function (value) {
        self.saleEnded = value
      })
  }

  function updateTokenData () {
    return $q.all([
      sale.maxTokens(),
      sale.tokenPrice(),
    ]).then(function (values) {
      self.maxTokens = convertTokenNumber(values[0])
      self.tokenPrice = web3.fromWei(values[1].shift(DECIMALPLACES)).toNumber()
    })
  }

  function updateSelectedBalance () {
    $q.when(sale.balanceOf(self.selectedAddress)).then(function (value) {
      self.balanceOfSelected = convertTokenNumber(value)
    }).catch(function(err) {
      self.balanceOfSelected = null
      error(err)
    })
  }
})

/**************************** Tools to create transactions for testing ****************************/
