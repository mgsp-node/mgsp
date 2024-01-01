#!/usr/bin/node
const ConfigManager = require('./classes/configManager.js');
const ServerHandler = require('./classes/serverHandler.js');

const configManager = new ConfigManager();
const serverHandler = new ServerHandler(configManager);

serverHandler.startServer();
