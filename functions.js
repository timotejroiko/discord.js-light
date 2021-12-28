"use strict";

const path = require("path");
const overrides = {};

// fix weird circular dependencies, thanks discord.js >.>
require(path.resolve(require.resolve("discord.js").replace("index.js", "/structures/GuildChannel")));
require(path.resolve(require.resolve("discord.js").replace("index.js", "/managers/MessageManager")));

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
		message = channel.messages._add({
			id,
			channel_id: channel.id,
			guild_id: channel.guild?.id
		}, false); // built in partial if content not a string
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
