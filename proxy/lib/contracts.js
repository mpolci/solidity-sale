const _ = require('lodash')
const Web3 = require('web3')
const config = require('../config')

const endpoint = _.get(config, 'ethereum.httpProvider', 'http://localhost:8545')
const networkId = _.get(config, 'ethereum.networkId', 'default')

let web3 = new Web3(new Web3.providers.HttpProvider(endpoint))

let contracts = {
  Sale: require('../../build/contracts/Sale.sol')
}

Object.keys(contracts).forEach(key => {
  let C = contracts[key]
  C.setProvider(web3.currentProvider)
  C.setNetwork(networkId)
})

module.exports = Object.assign({ web3 }, contracts)