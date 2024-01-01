const MUtils = require('./utils/mgspUtils.js');
const fs = require('fs');
const crypto = require('crypto');

class configManager {
    config;
    configHash;
    serverAddresses;
    settings;

    static serversFile = 'config/servers.json';
    static settingsFile = 'config/settings.json';
    static timeoutFile = 'config/serverStatus/on_timeout.json';
    static serverStatusFolder = 'config/serverStatus';
    static serversDefaults = '{"hosts":[]}';
    static settingsDefaults = '{"max-concurrent-connections": 20, "ping-on-proxy-visibility": true, "server-offline-visibility": true, "server-offline-status": "on_timeout.json", "server-not-found-visibility": true, "server-not-found-status": "not_found.json", "auto-complete-passthrough-server-status": true, "hide-max-concurrent-connections-message": true}';
    static timeoutFileDefaults = '{"version":{"name":"MGSP Proxy","protocol":764},"enforcesSecureChat":true,"description":{"extra":[{"color":"red","text":"This server is offline."}],"text":""},"players":{"max":0,"online":0}}';
    static notfoundDefaults = '{"version":{"name":"MGSP Proxy","protocol":764},"enforcesSecureChat":true,"description":{"extra":[{"color":"red","text":"Server not found."}],"text":""},"players":{"max":0,"online":0}}';
    static notfoundFile = 'config/serverStatus/not_found.json'
    static configUpdatesInterval = 10000;

    static getServersHash() {
        const fileBuffer = fs.readFileSync(configManager.serversFile);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);

        return hashSum.digest('hex');
    }

    constructor() {
        this.validateFileStructure();
        this.loadServers(true);
        this.loadSettings();
        this.startConfigUpdates();
    }

    loadServers(serverStart = false) {
        try {
            this.config = JSON.parse(fs.readFileSync(configManager.serversFile, 'UTF-8'));
        } catch (e) {
            if (serverStart) {
                console.error("Failed to parse config file. Server can't start.")
                console.error(e);
                process.exit(1);
            } else {
                return false;
            }
        }
        if (this.config.hosts.length == 0) {
            if (serverStart) {
                console.error("Can't start with empty servers.json file.");
                process.exit(1);
            }
        }
        this.serverAddresses = this.config.hosts.map(a => a.address);
        this.configHash = configManager.getServersHash();
    }

    loadSettings() {
        try {
            this.settings = JSON.parse(fs.readFileSync(configManager.settingsFile, 'UTF-8'));
        } catch (e) {
            console.error("Failed to parse settings. Server can't start.")
            console.error(e);
            process.exit(1);
        }
    }

    startConfigUpdates() {
        const that = this;
        setInterval(() => { that.updateConfig() }, configManager.configUpdatesInterval);
    }

    updateConfig() {
        const hashA = this.configHash;
        const hashB = configManager.getServersHash();
        const that = this;
        if (hashA != hashB) {
            MUtils.log("Config has changed. Reading new config.");
            if (that.loadServers() === false) {
                console.error("Failed to read new config. Try fixing it, otherwise the server may not start again.");
            };
            that.configHash = hashB;
        }
    }

    validateFileStructure() {
        if (!fs.existsSync("config")) {
            fs.mkdirSync("config");
        }

        if (!fs.existsSync(configManager.serverStatusFolder)) {
            fs.mkdirSync(configManager.serverStatusFolder);
        }

        MUtils.writeJsonFile(configManager.serversFile, configManager.serversDefaults);
        MUtils.writeJsonFile(configManager.settingsFile, configManager.settingsDefaults);
        MUtils.writeJsonFile(configManager.timeoutFile, configManager.timeoutFileDefaults);
        MUtils.writeJsonFile(configManager.notfoundFile, configManager.notfoundDefaults);
    }
}

module.exports = configManager;
