"use strict";

require("./init.js");
const Discord = require("./classes.js");
const actions = require("./actions.js");
const pkg = require("./package.json");
const fs = require("fs");

/**
 * Validate client options.
 * @param {object} options Options to validate
 * @private
 */
function validateOptions(options) {
	if(typeof options.cacheChannels !== "boolean") {
		throw new TypeError("CLIENT_INVALID_OPTION", "cacheChannels", "a boolean");
	}
	if(typeof options.cacheGuilds !== "boolean") {
		throw new TypeError("CLIENT_INVALID_OPTION", "cacheGuilds", "a boolean");
	}
	if(typeof options.cachePresences !== "boolean") {
		throw new TypeError("CLIENT_INVALID_OPTION", "cachePresences", "a boolean");
	}
	if(typeof options.cacheRoles !== "boolean") {
		throw new TypeError("CLIENT_INVALID_OPTION", "cacheRoles", "a boolean");
	}
	if(typeof options.cacheOverwrites !== "boolean") {
		throw new TypeError("CLIENT_INVALID_OPTION", "cacheOverwrites", "a boolean");
	}
	if(typeof options.cacheEmojis !== "boolean") {
		throw new TypeError("CLIENT_INVALID_OPTION", "cacheEmojis", "a boolean");
	}
	if(typeof options.cacheMembers !== "boolean") {
		throw new TypeError("CLIENT_INVALID_OPTION", "cacheMembers", "a boolean");
	}
	if(!Array.isArray(options.disabledEvents)) {
		throw new TypeError("CLIENT_INVALID_OPTION", "disabledEvents", "an array");
	}
	if(options.hotReload && typeof options.hotReload === "object") {
		if (options.hotReload.sessionData && typeof options.hotReload.sessionData !== "object") {
			throw new TypeError("CLIENT_INVALID_OPTION", "sessionData", "an object");
		}
		if (options.hotReload.cacheData && typeof options.hotReload.cacheData !== "object") {
			throw new TypeError("CLIENT_INVALID_OPTION", "cacheData", "an object");
		}
		if (options.hotReload.onExit && typeof options.hotReload.onExit !== "function") {
			throw new TypeError("CLIENT_INVALID_OPTION", "onExit", "a function");
		}
	}
	else if(typeof options.hotReload !== "boolean") {
		throw new TypeError("CLIENT_INVALID_OPTION", "hotReload", "a boolean or an object");
	}
}

Discord.Client = class Client extends Discord.Client {
	constructor(_options = {}) {
		const options = {
			cacheChannels: false,
			cacheGuilds: true,
			cachePresences: false,
			cacheRoles: false,
			cacheOverwrites: false,
			cacheEmojis: false,
			cacheMembers: false,
			hotReload: false,
			disabledEvents: [],
			..._options
		};
		validateOptions(options);
		super(options);
		actions(this);
		if(options.hotReload) {
			this.on(Discord.Constants.Events.SHARD_RESUME, () => {
				if(!this.readyAt) { this.ws.checkShardsReady(); }
			});
			let dumped = false;
			for(const eventType of ["exit", "uncaughtException", "SIGINT", "SIGTERM"]) {
				process.on(eventType, async (...args) => {
					if(!dumped) {
						dumped = true;
						const cache = this.dumpCache();
						const sessions = this.dumpSessions();
						if(options.hotReload?.onExit) {
							await options.hotReload.onExit(sessions, cache).catch(() => {}); // async will not work on exit
						} else {
							this._storeData(sessions, cache);
						}
					}
					if(eventType === "uncaughtException") {
						console.error(...args);
					}
					if(eventType !== "exit") {
						process.exit(process.exitCode);
					}
				});
			}
		}
	}
	sweepUsers(_lifetime = 86400) {
		const lifetime = _lifetime * 1000;
		this.users.cache.sweep(t => t.id !== this.user.id && (!t.lastMessageID || Date.now() - Discord.SnowflakeUtil.deconstruct(t.lastMessageID).timestamp > lifetime));
		for(const guild of this.guilds.cache.values()) {
			guild.members.cache.sweep(t => !this.users.cache.has(t.id));
			guild.presences.cache.sweep(t => !this.users.cache.has(t.id) && !this.options.cachePresences);
		}
	}
	sweepChannels(_lifetime = 86400) {
		const lifetime = _lifetime * 1000;
		if(this.options.cacheChannels) { return; }
		const connections = this.voice ? this.voice.connections.map(t => t.channel.id) : [];
		this.channels.cache.sweep(t => !connections.includes(t.id) && (!t.lastMessageID || Date.now() - Discord.SnowflakeUtil.deconstruct(t.lastMessageID).timestamp > lifetime));
		for(const guild of this.guilds.cache.values()) {
			guild.channels.cache.sweep(t => !this.channels.cache.has(t.id));
		}
	}
	/**
 	 * Generates a complete dump of the current stored cache
	 * Only guild cache is dumped for now
 	 * @returns {object} Cache data
 	 */
	dumpCache() {
		return {
			guilds: this.guilds.cache.reduce((a, g) => {
				a[g.id] = g._unpatch();
				return a;
			}, {})
		}
	}
	/**
 	 * Generates a complete dump of the current stored cache
	 * @returns {object} Session data
 	 */
	dumpSessions() {
		return this.ws.shards.reduce((a, s) => {
			a[s.id] = {
				id: s.sessionID,
				sequence: s.sequence,
				lastConnected: Date.now()
			};
			return a;
		}, {});
	}
	/**
 	 * Loads the selected stored cache on disk into memory
	 * @returns {object} The stored cache
 	 * @private
 	 */
	_loadCache(cacheType, filter) {
		const cache = {};
		if(typeof cacheType !== "string" || !["guilds"].includes(cacheType.toLowerCase())) { return cache; } // to allow expanding in the future
		let files = [];
		try {
			files = fs.readdirSync(`${process.cwd()}/.sessions/${cacheType}`).filter(file => file.endsWith(".json"));
		} catch(e) { /* no-op */ }
		for(const file of files) {
			let name = file.slice(0, -5);
			if(typeof filter === "function" && !filter(name)) { continue; }
			try {
				const json = fs.readFileSync(`${process.cwd()}/.sessions/${cacheType}/${file}`, "utf8");
				const obj = JSON.parse(json);
				cache[name] = obj;
			} catch(e) { /* no-op */ }
		}
		return cache;
	}
	/**
 	 * Loads the selected stored sessions on disk into memory
 	 * @private
 	 */
	_loadSession(id) {
		let data = {};
		let files = [];
		try {
			files = fs.readdirSync(`${process.cwd()}/.sessions/websocket`).filter(file => file.endsWith(".json"));
		} catch (e) { /* no-op */ }
		if(Number(id) >= 0 && files.length) {
			const file = files.find(file => Number(file.slice(0, -5)) === id);
			if(file) {
				try {
					const json = fs.readFileSync(`${process.cwd()}/.sessions/websocket/${file}`, "utf8");
					data[id] = JSON.parse(json);
				} catch(e) { /* no-op */ }
			}
		} else if (files.length) {
			for(const file of files) {
				try {
					const json = fs.readFileSync(`${process.cwd()}/.sessions/websocket/${file}`, "utf8");
					const shard = Number(file.slice(0, -5));
					data[shard] = JSON.parse(json);
				} catch(e) { /* no-op */ }
			}
		}
		return data;
	}
	/**
 	 * Patches raw discord api objects into the discord.js cache
 	 * @private
 	 */
	_patchCache(data) {
		for(const [cache, items] of Object.entries(data)) {
			for(const item of items) {
				this[cache].add(item);
			}
		}
	}
	/**
 	 * Built-in cache storing
 	 * @private
 	 */
	_storeData(sessions, cache) {
		for(const [id, data] of Object.entries(sessions)) {
			if(!fs.existsSync(`${process.cwd()}/.sessions/websocket`)) { fs.mkdirSync(`${process.cwd()}/.sessions/websocket`, { recursive: true }); }
			fs.writeFileSync(`${process.cwd()}/.sessions/websocket/${id}.json`, JSON.stringify(data), "utf8");
		}
		for(const folder of Object.keys(cache)) {
			if(!fs.existsSync(`${process.cwd()}/.sessions/${folder}`)) { fs.mkdirSync(`${process.cwd()}/.sessions/${folder}`, { recursive: true }); }
			for(const [id, data] of Object.entries(cache[folder])) {
				fs.writeFileSync(`${process.cwd()}/.sessions/${folder}/${id}.json`, JSON.stringify(data), "utf8");
			}	
		}
	}
};

Discord.version = `${pkg.version} (${Discord.version})`;

module.exports = Discord;
