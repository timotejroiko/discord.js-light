"use strict";

require("./init.js");
const Discord = require("./classes.js");
const actions = require("./actions.js");
const pkg = require("./package.json");
const fs = require("fs");

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
			disabledEvents: [],
			hotReload: false,
			..._options
		};
		super(options);
		actions(this);
		this._validateOptionsLight(options);
		if (options.hotReload) {
			this.on(Discord.Constants.Events.SHARD_RESUME, () => {
				if (!this.readyAt) { this.ws.checkShardsReady(); }
			});
			this.cacheFilePath = `${process.cwd()}/.sessions`;
			this.ws._hotreload = {};
			if (options.hotReload.sessionData && Object.keys(options.hotReload.sessionData).length) {
				this.ws._hotreload = options.hotReload.sessionData;
			}
			else {
				this._loadSessions();
			}
			this.onUnload = (sessions, cache) => {
				this._makeDir(this.cacheFilePath);
				this._makeDir(`${this.cacheFilePath}/sessions`);
				this._loadSessions();
				this.ws._hotreload = {
					...this.ws._hotreload,
					...sessions
				};
				this._unLoadSessions();
				if (options.cacheGuilds) {
					this._makeDir(`${this.cacheFilePath}/guilds`);
				}
				if (options.cacheChannels) {
					this._makeDir(`${this.cacheFilePath}/channels`);
				}
				if (options.cacheMembers) {
					this._makeDir(`${this.cacheFilePath}/users`);
				}
			};
			this._uncaughtExceptionOnExit = false;
			for (const eventType of ["exit", "uncaughtException", "SIGINT", "SIGTERM"]) {
				process.on(eventType, async () => {
					if (eventType === "uncaughtException") {
						this._uncaughtExceptionOnExit = true;
					}
					if (!this._uncaughtExceptionOnExit) {
						Object.assign(this.ws._hotreload, ...this.ws.shards.map(s => {
							s.connection.close();
							return {
								[s.id]: {
									id: s.sessionID,
									seq: s.sequence
								}
							};
						}));
						if (eventType !== "exit") {
							await this.dumpCache(this.ws._hotreload, this);
							process.exit();
						}
					}
					else {
						console.error("There was an uncaughtException inside your exit loop causing an infinite loop. Your exit function was not run");
						process.exit(1);
					}

				});
			}
		}
	}
	/**
 	 * Loads all of the stored caches on disk into memory
	 * @returns {object} All of the stored cache
 	 * @private
 	 */
	_loadCache() {
		const allCache = {};
		for (const cache of ["guilds", "channels", "users"]) {
			try {
				const cachedFiles = fs.readdirSync(`${this.cacheFilePath}/${cache}`)
					.filter(file => file.endsWith(".json"))
					.map(c => c.substr(0, c.lastIndexOf(".")));
				if (cachedFiles.length) { continue; }
				allCache[cache] = [];
				for (const id of cachedFiles) {
					allCache[cache].push(JSON.parse(fs.readFileSync(`${this.cacheFilePath}/sessions/${id}.json`, "utf8")));
				}
			} catch (d) {
				// Do nothing
			}
		}
		return allCache;
	}
	/**
 	 * Loads all of the stored sessions on disk into memory
 	 * @private
 	 */
	_loadSessions() {
		try {
			const shards = fs.readdirSync(`${this.cacheFilePath}/sessions`)
				.filter(file => file.endsWith(".json"))
				.map(shardSession => shardSession.substr(0, shardSession.lastIndexOf(".")));
			for (const shardID of shards) {
				this.ws._hotreload[shardID] = JSON.parse(fs.readFileSync(`${this.cacheFilePath}/sessions/${shardID}.json`, "utf8"));
			}
		} catch (e) {
			this.ws._hotreload = {};
		}
	}
	/**
 	 * Unloads all of the stored sessions in memory onto disk
 	 * @private
 	 */
	_unLoadSessions() {
		for (const [shardID, session] of this.ws._hotreload) {
			fs.writeFileSync(`${this.cacheFilePath}/sessions/${shardID}.json`, JSON.stringify(session));
		}
	}
	/**
 	 * Creates a directory if it does not already exist
 	 * @private
 	 */
	_makeDir(dir) {
		if (!fs.existsSync(dir)) { fs.mkdirSync(dir); }
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
 	 * Validates the client options.
 	 * @param {object} options Options to validate
 	 * @private
 	 */
	_validateOptionsLight(options) {
		if (typeof options.cacheChannels !== "boolean") {
			throw new TypeError("CLIENT_INVALID_OPTION", "cacheChannels", "a boolean");
		}
		if (typeof options.cacheGuilds !== "boolean") {
			throw new TypeError("CLIENT_INVALID_OPTION", "cacheGuilds", "a boolean");
		}
		if (typeof options.cachePresences !== "boolean") {
			throw new TypeError("CLIENT_INVALID_OPTION", "cachePresences", "a boolean");
		}
		if (typeof options.cacheRoles !== "boolean") {
			throw new TypeError("CLIENT_INVALID_OPTION", "cacheRoles", "a boolean");
		}
		if (typeof options.cacheOverwrites !== "boolean") {
			throw new TypeError("CLIENT_INVALID_OPTION", "cacheOverwrites", "a boolean");
		}
		if (typeof options.cacheEmojis !== "boolean") {
			throw new TypeError("CLIENT_INVALID_OPTION", "cacheEmojis", "a boolean");
		}
		if (typeof options.cacheMembers !== "boolean") {
			throw new TypeError("CLIENT_INVALID_OPTION", "cacheMembers", "a boolean");
		}
		if (!Array.isArray(options.disabledEvents)) {
			throw new TypeError("CLIENT_INVALID_OPTION", "disabledEvents", "an array");
		}
		if (options.hotReload) {
			if (options.hotReload.sessionData && typeof options.hotReload.sessionData !== "object") {
				throw new TypeError("CLIENT_INVALID_OPTION", "sessionData", "an object");
			}
			if (options.hotReload.cacheData && typeof options.hotReload.cacheData !== "object") {
				throw new TypeError("CLIENT_INVALID_OPTION", "cacheData", "a object");
			}
			if (options.hotReload.onUnload && typeof options.hotReload.onUnload !== "function") {
				throw new TypeError("CLIENT_INVALID_OPTION", "onUnload", "a function");
			}
		}
	}
};

Discord.version = `${pkg.version} (${Discord.version})`;

module.exports = Discord;
