module.exports = function(deployer) {
  const DECIMALPLACES = 15
  const PRICE = web3.toWei(0.1)  // the price has a precision of 10^(DECIMALPLACES-18)
  const TOKENS = 1000
  deployer.deploy(Sale, web3.toBigNumber(TOKENS).shift(DECIMALPLACES), web3.toBigNumber(PRICE).shift(-DECIMALPLACES))
  .then(() => Sale.deployed().newPromoter())
};
