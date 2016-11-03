var config = {
    basePath: '/api',
    disableLogs: false,
    port: 3001,

    logOpts: {
        bunyanStreams: [
            {
                level: 'debug',
                stream: process.stdout
            }
        ]
    },
    ethereum: {
        httpProvider: 'http://localhost:8545',
        networkId: 'default'                      // 'default' or the number id of the network
    }
};

module.exports = config;
