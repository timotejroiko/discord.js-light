"use strict";

const path = require("path");
const overrides = {};

function override(filepath, callback) {
	const fullPath = path.resolve(require.resolve("discord.js").replace("index.js", filepath));
	const original = require(fullPath);
	const modified = callback(original);
	require.cache[fullPath].exports = overrides[fullPath] = modified;
	const dependencies = Object.keys(require.cache).filter(key => require.cache[key].children?.find(child => child.id === fullPath));
	for(const dependency of dependencies) {
		if(!overrides[dependency]) {
			delete require.cache[dependency];
			require(dependency);
		}
	}
}

exports.overrides = overrides;
exports.override = override;
