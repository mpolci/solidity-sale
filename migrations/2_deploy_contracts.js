module.exports = function(deployer) {
  deployer.deploy(Sale, 10000000, web3.toWei(0.1));
};
