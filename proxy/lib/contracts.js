const _ = require('lodash')
const Web3 = require('web3')
const config = require('../config')

const endpoint = _.get(config, 'ethereum.httpProvider', 'http://localhost:8545')

let web3 = new Web3(new Web3.providers.HttpProvider(endpoint))

let contracts = {
  Sale: require('../../build/contracts/Sale.sol')
}

Object.keys(contracts).forEach(key => {
  contracts[key].web3 = web3
})

module.exports = Object.assign({ web3 }, contracts)