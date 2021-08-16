"use strict";

const path = require("path");
const list = ["/discord.js/src/structures", "/discord.js/src/managers", "\\discord.js\\src\\structures", "\\discord.js\\src\\managers"];
const overrides = {};

function override(filepath, callback) {
	const fullPath = path.resolve(require.resolve("discord.js").replace("index.js", filepath));
	const original = require(fullPath);
	require.cache[fullPath].exports = callback(original);
	overrides[fullPath] = callback;
	const dependencies = Object.keys(require.cache).filter(key => list.some(l => key.includes(l)) && key !== fullPath);
	for(const dependency of dependencies) {
		delete require.cache[dependency];
		if(overrides[dependency]) {
			const old = require(dependency);
			require.cache[dependency].exports = overrides[dependency](old);
		} else {
			require(dependency);
		}
	}
}

// to override channel partials which are unreliable
function makePartial(obj) {
	Object.defineProperty(obj, "partial", {
		value: true,
		configurable: true,
		writable: true,
		enumerable: true
	});
}

function getOrCreateGuild(client, id, shardId) {
	let guild = client.guilds.cache.get(id);
	if(!guild) {
		guild = client.guilds._add({ id, shardId }, false);
		guild.partial = true;
	}
	return guild;
}

function getOrCreateChannel(client, id, guild) {
	let channel = client.channels.cache.get(id);
	if(!channel) {
		channel = client.channels._add({ id, type: guild ? 0 : 1 }, guild, { cache: false });
		makePartial(channel);
	}
	return channel;
}

function getOrCreateMessage(channel, id) {
	let message = channel.messages.cache.get(id);
	if(!message) {
		message = channel.messages._add({ id }, false); // nuilt in partial if content not a string
	}
	return message;
}

module.exports = {
	overrides,
	override,
	makePartial,
	getOrCreateGuild,
	getOrCreateChannel,
	getOrCreateMessage
};
