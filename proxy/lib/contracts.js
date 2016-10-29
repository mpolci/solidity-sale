var Web3 = require('web3')

let web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'))

let contracts = {
  Sale: require('../../build/contracts/Sale.sol')
}

Object.keys(contracts).forEach(key => {
  contracts[key].web3 = web3
})

module.exports = Object.assign({ web3 }, contracts)