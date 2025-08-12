const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

defaultConfig.resolver.assetExts.push('mp3'); // 👈 Add this line

module.exports = mergeConfig(defaultConfig, {});
