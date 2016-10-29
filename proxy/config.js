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
    }
};

module.exports = config;
