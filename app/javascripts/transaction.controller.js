angular.module('Transactions', [])
.controller('TransactionController', function ($scope) {
  var self = this
  angular.extend(this, {
    accounts: [],
    selectedAccount: '',
    selectedBalance: null,
    sendAmountInput: null,
    destinationAddressInput: null,
    message: null,

    sendTransaction: sendTransaction,
    canSendTransaction: canSendTransaction,
  })

  web3.eth.getAccounts(function (err, accounts) {
    if (err) return console.error(err)
    self.accounts = accounts
    $scope.$apply()
  })
  $scope.$watch(function () {
    return self.selectedAccount
  }, refreshSelectedBalance)

  /*********************************************************/

  function refreshSelectedBalance () {
    if (!self.selectedAccount) return
    web3.eth.getBalance(self.selectedAccount, function (err, value) {
      if (err) return console.error(err)
      self.selectedBalance = web3.fromWei(value).toNumber()
      $scope.$apply()
    })
  }

  function sendTransaction () {
    web3.eth.sendTransaction({
      from: self.selectedAccount,
      to: self.destinationAddressInput,
      value: web3.toWei(self.sendAmountInput),
      gas: 500000
    }, function (err, txid) {
      if (err) {
        console.error(err)
        self.message = err.toString()
      } else {
        var msg = 'new transaction: ' + txid
        console.log(msg)
        self.message = msg
      }
      $scope.$apply()
    })
  }

  function canSendTransaction () {
    function check (val) {
      return val && angular.isString(val) && val.length > 0
    }
    return check(self.selectedAccount) && check(self.destinationAddressInput) && check(self.sendAmountInput)
  }

})