"use strict";

require("./init.js");
const Discord = require("./classes.js");
const handlers = require("./actions.js");
const pkg = require("./package.json");

Discord.Client = class Client extends Discord.Client {
	constructor(options = {}) {
		options = Object.assign(
			{
				cacheChannels:false,
				cacheGuilds:true,
				cachePresences:false,
				cacheRoles:false,
				cacheOverwrites:false,
				cacheEmojis:false
			},
			options
		);
		super(options);
		handlers(this);
	}
	sweepUsers(lifetime = 86400) {
		lifetime *= 1000;
		this.users.cache.sweep(t => t.id !== this.user.id && (!t.lastMessageID || Date.now() - Discord.SnowflakeUtil.deconstruct(t.lastMessageID).timestamp > lifetime));
		for(let guild of this.guilds.cache.values()) {
			guild.members.cache.sweep(t => !this.users.cache.has(t.id));
			guild.presences.cache.sweep(t => !this.users.cache.has(t.id) && !this.options.cachePresences);
		}
	}
	sweepChannels(lifetime = 86400) {
		lifetime *= 1000;
		if(this.options.cacheChannels) { return; }
		let connections = this.voice.connections.map(t => t.channel.id);
		this.channels.cache.sweep(t => !connections.includes(t.id) && (!t.lastMessageID || Date.now() - Discord.SnowflakeUtil.deconstruct(t.lastMessageID).timestamp > lifetime));
		for(let guild of this.guilds.cache.values()) {
			guild.channels.cache.sweep(t => !this.channels.cache.has(t.id));
		}
	}
	incrementMaxListeners() {
		const maxListeners = this.getMaxListeners();
		if(maxListeners !== 0) {
			this.setMaxListeners(maxListeners + 1);
		}
	}
	decrementMaxListeners() {
		const maxListeners = this.getMaxListeners();
		if(maxListeners !== 0) {
			this.setMaxListeners(maxListeners - 1);
		}
	}
}

Discord.version = `${pkg.version} (${Discord.version})`;

module.exports = Discord;
