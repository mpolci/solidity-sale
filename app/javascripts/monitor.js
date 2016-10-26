angular.module('tokenSaleMonitorApp', ['Transactions'])
  .controller('MonitorController', function ($scope, $q) {
    var self = this
    var DECIMALPLACES = 15
    angular.extend(this, {
      address: null,
      events: [],
    })
    var sale = Sale.deployed()
    self.saleAddress = sale.address;

    //address indexed buyer, address indexed promoter, uint tokens, uint payed, uint change);

    function convertTokenNumber (value) {
      return web3.toBigNumber(value).shift(-DECIMALPLACES).toNumber()
    }

    function convertToEth(value) {
      return web3.fromWei(web3.toBigNumber(value)).toNumber()
    }

    var extractTokensSold = function (event) {
      return {
        type: event.event,
        txid: event.transactionHash,
        buyer: event.args.buyer,
        promoter: event.args.promoter !== event.args.buyer ? event.args.promoter : null,
        tokens: convertTokenNumber(event.args.tokens),
        payed: convertToEth(event.args.payed),
        change: convertToEth(event.args.change)
      }
    }

    function logTokensSoldEvent (err, ev) {
      if (err) return error(err)
      console.log("event:", ev)
      var evData;
      if (ev.event === 'TokensSold') {
        evData = extractTokensSold(ev)
      } else {
        evData = {
          type: ev.name,
          txid: ev.transactionHash,
          args: ev.args
        }
      }
      self.events.unshift(evData)
      // console.log('sold', evData.tokens, 'tokens to:', evData.buyer)
      $scope.$apply()
    }
    // catch event of tokens sold
    var eventListener = sale.TokensSold(null, {fromBlock: 0}, logTokensSoldEvent)

    $scope.$on('$destroy', function () {
      eventListener.stopWatching()
    })
    //
    // /************************/
    //
    // function error (err) {
    //   console.error(err)
    //   alert(err.message || err)
    // }
    //
    // function convertTokenNumber (value) {
    //   return value.shift(-DECIMALPLACES).toNumber()
    // }
    //
    // function updatePromoters () {
    //   return sale.getPromoters()
    //     .then(function (value) {
    //       self.promoters = value
    //     })
    // }
    //
    // function updateTotalTokensSold () {
    //   return sale.soldTokens()
    //     .then(function (value) {
    //       self.totalTokensSold = convertTokenNumber(value)
    //     })
    // }
    //
    // function updateSaleEnded () {
    //   return sale.saleEnded()
    //     .then(function (value) {
    //       self.saleEnded = value
    //     })
    // }
    //
    // function updateTokenData () {
    //   return $q.all([
    //     sale.maxTokens(),
    //     sale.tokenPrice(),
    //   ]).then(function (values) {
    //     self.maxTokens = convertTokenNumber(values[0])
    //     self.tokenPrice = web3.fromWei(values[1].shift(DECIMALPLACES)).toNumber()
    //   })
    // }
    //
    // function updateSelectedBalance () {
    //   $q.when(sale.balanceOf(self.selectedAddress)).then(function (value) {
    //     self.balanceOfSelected = convertTokenNumber(value)
    //   }).catch(function(err) {
    //     self.balanceOfSelected = null
    //     error(err)
    //   })
    // }
  })