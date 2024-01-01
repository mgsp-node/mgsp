const net = require('net');
const ConcurrentConnectionManager = require('./concurrentConnectionManager.js');
const MUtils = require('./utils/mgspUtils.js');
const GUtils = require('./utils/genericUtils.js');
const ConfigManager = require('./configManager.js');
const { version } = require('../../package.json');
const port = process.env.PORT || 25565;

class serverHandler {
    static proxyTimeout = 3000;
    static maxInactivityTime = 5000;

    constructor(configManager) {
        this.configManager = configManager;
        this.concurrentConnectionManager = new ConcurrentConnectionManager(configManager);
    }

    static createProxy(target, socket) {
        socket.startedProxy = true;
        return net.createConnection({ host: GUtils.getHost(target), port: GUtils.getPort(target), timeout: serverHandler.proxyTimeout });
    }

    static handleInactivity(socket) {
        socket.end();
    }

    static startInactivityTimer(socket) {
        return setTimeout(() => {
            serverHandler.handleInactivity(socket);
        }, serverHandler.maxInactivityTime);
    }

    startServer() {
        const that = this;

        const server = net.createServer({ keepAlive: true }, socket => {
            socket.expectPing = false;
            socket.startedGameSession = false;
            socket.startedProxy = false;
            socket.initialPackages = [];
            socket.inactivityTimer = serverHandler.startInactivityTimer(socket);

            let socket2;
            let target = false;
            let targetData = false;

            const blocked = that.concurrentConnectionManager.handleConnect(socket, that.configManager.settings["max-concurrent-connections"]);
            if (blocked) {
                socket.on('error', () => { });
                socket.on('end', () => { });
                socket.end();
                return;
            }

            socket.on('data', clientData => {
                clearTimeout(socket.inactivityTimer);
                socket.inactivityTimer = serverHandler.startInactivityTimer(socket);

                if (socket.startedGameSession === false) {
                    socket.initialPackages.push(clientData);
                }

                if (socket.expectPing) {
                    if (clientData.toString('hex').startsWith("0901")) {
                        socket.write(clientData, 'utf8', () => {
                            socket.end();
                            return;
                        });
                    }
                }

                const handshakeData = MUtils.parseHandshake(clientData);

                if (handshakeData) {
                    if (socket.startedGameSession) {
                        return;
                    }

                    for (let address of that.configManager.serverAddresses) {
                        if (handshakeData["hostname"] == address) {
                            targetData = that.configManager.config.hosts.find(o => o.address == address);
                            break;
                        }
                    }

                    if (targetData === false) {
                        if (that.configManager.settings["server-not-found-visibility"]) {
                            if (handshakeData.doLogin === true) {
                                socket.end();
                                return;
                            }
                            const notFoundStatus = MUtils.pickServerStatus(this.configManager.settings["server-not-found-status"]);
                            socket.write(Buffer.from(MUtils.getServerStatusData(ConfigManager.serverStatusFolder + '/' + notFoundStatus), 'hex'), 'utf8', () => {
                                if (that.configManager.settings["ping-on-proxy-visibility"]) {
                                    socket.expectPing = true;
                                } else {
                                    socket.end();
                                }
                            });
                        } else {
                            socket.end();
                        }
                        return;
                    }

                    if (handshakeData.doLogin) {
                        MUtils.log(`Connecting ${socket.remoteAddress} to ${targetData["name"]}.`);
                        target = serverHandler.createProxy(targetData.target, socket);
                    } else if (handshakeData.getStatus) {
                        if (targetData["passthroughPlayerCount"] && targetData["serverStatus"]) {
                            let stream = "";
                            let expectedLength = false;
                            let index = 0;

                            const forgedHandshake = MUtils.forgeHandshake(GUtils.getHost(targetData.target), GUtils.getPort(targetData.target));

                            socket2 = new net.Socket();

                            const socket2Timeout = setTimeout(()=>{
                                socket.end();
                                socket.destroy();
                            }, serverHandler.proxyTimeout);

                            socket2.connect({ host: GUtils.getHost(targetData.target), port: GUtils.getPort(targetData.target)}, () => {
                                clearTimeout(socket2Timeout);
                                socket2.write(Buffer.from(forgedHandshake, 'hex'), 'utf8', () => {});
                            });

                            socket2.on('data', data => {
                                const streamData = Buffer.from(data, 'utf8').toString('hex');
                                stream += streamData;

                                if (expectedLength === false) {
                                    if (expectedLength === false) {
                                        if (streamData.charAt(2) == "0" && streamData.charAt(3) == "0") {
                                            expectedLength = GUtils.decodeVarIntFromHex(streamData.slice(0, 2));
                                            index = 2;
                                        } else if (streamData.charAt(4) == "0" && streamData.charAt(5) == "0") {
                                            expectedLength = GUtils.decodeVarIntFromHex(streamData.slice(0, 4)) + 2;
                                            index = 4;
                                        } else if (streamData.charAt(6) == "0" && streamData.charAt(7) == "0") {
                                            expectedLength = GUtils.decodeVarIntFromHex(streamData.slice(0, 6)) + 2;
                                            index = 6;
                                        }
                                    }
                                }
                                if (expectedLength === false) {
                                    socket2.end();
                                }
                                if (stream.length/2 == expectedLength) {
                                    socket2.end();
                                }
                            });

                            socket2.on('end', () => {
                                let o = false;
                                let p = false;
                                let serverStatus;

                                const JSONStart = (index*2)+2;
                                const JSONSlice = stream.slice(JSONStart);
                                const JSONData = Buffer.from(JSONSlice, 'hex').toString('utf8');

                                try {
                                    o = JSON.parse(JSONData);
                                } catch (e) {
                                    socket.end();
                                }

                                try {
                                    serverStatus = MUtils.pickServerStatus(targetData["serverStatus"]);
                                    p = JSON.parse(MUtils.getServerStatusData(ConfigManager.serverStatusFolder + '/' + serverStatus, true));
                                } catch (e) {
                                    socket.end();
                                }
                                
                                if (p === false) {
                                    MUtils.log(`Error parsing '${serverStatus}' for ${targetData["name"]}, please assure it exists and is properly formatted.`);
                                    return;
                                }

                                if (o === false) {
                                    return;
                                }

                                if (that.configManager.settings["auto-complete-passthrough-server-status"]) {
                                    const q = {};
                                    const keyOrder = ["version", "favicon", "enforcesSecureChat", "description", "players"];
                                    for (const key of keyOrder) {
                                        if (!p[key]) {
                                            q[key] = o[key];
                                        } else {
                                            q[key] = p[key];
                                        }
                                    }
                                    p = q;
                                } else {
                                    p.players = o.players
                                }

                                const JSONString = JSON.stringify(p);
                                const hexData = MUtils.getServerStatusHexPrefix(JSONString) + Buffer.from(JSONString, 'utf8').toString('hex');

                                socket.write(Buffer.from(hexData, 'hex'), 'utf8', () => {
                                    if (that.configManager.settings["ping-on-proxy-visibility"]) {
                                        socket.expectPing = true;
                                    } else {
                                        socket.end();
                                    }
                                });
                            });

                            socket2.on('error', (err) => {
                                MUtils.log(`${socket.remoteAddress} threw error code '${err.code}' (socket2).`);
                                that.timeoutClient(handshakeData, socket, targetData);
                            });
                        } else {
                            if (targetData["serverStatus"]) {
                                let serverStatus = MUtils.pickServerStatus(targetData["serverStatus"]);
                                socket.write(Buffer.from(MUtils.getServerStatusData(ConfigManager.serverStatusFolder + '/' + serverStatus), 'hex'), 'utf8', () => {
                                    if (that.configManager.settings["ping-on-proxy-visibility"]) {
                                        socket.expectPing = true;
                                    } else {
                                        socket.end();
                                    }
                                });
                            } else {
                                target = serverHandler.createProxy(targetData.target, socket);
                            }
                        }
                    }

                    if (target === false) {
                        return;
                    }

                    target.on('connect', () => {
                        if (socket.startedGameSession === false) { 
                            for (let packageData of socket.initialPackages) {
                                target.write(packageData, 'utf8');
                            }
                            socket.startedGameSession = true;
                        }
                        socket.pipe(target);
                        target.pipe(socket);
                    });

                    target.on('end', () => {
                        socket.end();
                    });

                    target.on('error', err => {
                        if (targetData.getStatus) {
                            switch (err.code) {
                                case 'ECONNREFUSED':
                                    that.timeoutClient(handshakeData, socket, targetData);
                                    break;
                                case 'EHOSTUNREACH':
                                    that.timeoutClient(handshakeData, socket, targetData);
                                    break;
                                case 'ETIMEDOUT':
                                    that.timeoutClient(handshakeData, socket, targetData);
                                    break;
                                default:
                                    MUtils.log(`${socket.remoteAddress} threw error code '${err.code}' (target).`);
                            }
                        } else if (targetData.doLogin) {
                            MUtils.log(`${socket.remoteAddress} threw error code '${err.code}' (${targetData})`);
                        }
                    });

                    target.on('timeout', () => {
                        that.timeoutClient(handshakeData, socket, targetData);
                    });
                } else {
                    if (!socket.expectPing && !socket.startedProxy && !socket2) {
                        socket.end();
                    }

                }

            });

            socket.on('error', error => {
                switch (error.code) {
                    case 'ECONNRESET':
                        if (targetData) {
                            MUtils.log(`${socket.remoteAddress} disconnected abruptly from ${targetData.name}.`);
                        }
                        break;
                    default:
                        console.error(error);
                }
                that.concurrentConnectionManager.handleDisconnect(socket);
                clearTimeout(socket.inactivityTimer);
            });

            socket.on('end', () => {
                if (socket2) {
                    socket2.end();
                }
                that.concurrentConnectionManager.handleDisconnect(socket);
                clearTimeout(socket.inactivityTimer);
            });

        });

        server.listen(port, () => {
            console.log(`[MGSP ${version}] running on Port ${port}`);
        });
    }

    timeoutClient(handshakeData, socket, targetData) {
        if (handshakeData.doLogin === true) { 
            socket.end();
            return;
        }
        MUtils.log(`${targetData.name} timed out for ${socket.remoteAddress}.`);
        if (this.configManager.settings["server-offline-visibility"] === true) {
            if (handshakeData.doLogin === true) {
                socket.end();
                return;
            }
            const offlineStatus = MUtils.pickServerStatus(this.configManager.settings["server-offline-status"]);
            socket.write(Buffer.from(MUtils.getServerStatusData(ConfigManager.serverStatusFolder + '/' + offlineStatus), 'hex'), 'utf8', () => {
                if (this.configManager.settings["ping-on-proxy-visibility"]) {
                    socket.expectPing = true;
                } else {
                    socket.end();
                }
            });
        } else {
            socket.end();
        }
    }
}

module.exports = serverHandler;
