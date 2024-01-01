const MUtils = require('./utils/mgspUtils.js');

class concurrentConnectionManager {
    maxConcurrentConnections = {};
    settings;

    constructor(configManager) {
        this.settings = configManager.settings;
    }

    enforceConcurrentLimitations(socket, maxConcurrentConnectionsLimit) {
        if (this.maxConcurrentConnections[socket.remoteAddress]) {
            if (this.maxConcurrentConnections[socket.remoteAddress] >= maxConcurrentConnectionsLimit) {
                socket.end();
                return true;
            } else {
                return false;
            }
        }
    }

    handleConnect(socket, maxConcurrentConnectionsLimit) {
        if (this.maxConcurrentConnections[socket.remoteAddress] >= maxConcurrentConnectionsLimit) {
            return true;
        } else {
            if (!this.maxConcurrentConnections[socket.remoteAddress]) {
                this.maxConcurrentConnections[socket.remoteAddress] = 1;
            } else {
                this.maxConcurrentConnections[socket.remoteAddress] += 1;
            }

            if (this.settings["hide-max-concurrent-connections-message"] === false) {
                if (this.maxConcurrentConnections[socket.remoteAddress] == maxConcurrentConnectionsLimit) {
                    MUtils.log(`${socket.remoteAddress} reached max-concurrent-connections limit of ${maxConcurrentConnectionsLimit} (${this.maxConcurrentConnections[socket.remoteAddress]}).`);
                }
            }

            return false;
        }
    }

    handleDisconnect(socket) {
        if (this.maxConcurrentConnections[socket.remoteAddress]) {
            if (this.maxConcurrentConnections[socket.remoteAddress] == 1) {
                this.maxConcurrentConnections[socket.remoteAddress] = undefined;
            } else {
                this.maxConcurrentConnections[socket.remoteAddress] -= 1;
            }
        }
    }
}

module.exports = concurrentConnectionManager;
