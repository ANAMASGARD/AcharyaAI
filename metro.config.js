const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('sql');
// Keep local signed builds responsive on the development laptop.
if (process.env.ACHARYA_METRO_WORKERS === '2') config.maxWorkers = 2;

module.exports = config;
