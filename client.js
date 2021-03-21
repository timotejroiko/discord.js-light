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
		this._validateOptionsLight();
		if (options.hotReload) {
			this.cacheFilePath = `${process.cwd()}/.sessions`;
			if (options.sessions && Object.keys(options.sessions).length) {
				this.ws._hotreload = options.sessions;
			}
			else {
				try {
					this.ws._hotreload = JSON.parse(fs.readFileSync(`${this.cacheFilePath}/sessions.json`, "utf8"));
				} catch(e) {
					this.ws._hotreload = {};
				}
			}

			if (options.cacheGuilds) {
				const discordGuildData = JSON.parse(fs.readFileSync(`${this.cacheFilePath}/guilds.json`, "utf8"));
				for (const guild of discordGuildData) {
					this.guilds.cache.set(guild.id, new Discord.Guild(this, guild));
				}
				this.user = new Discord.User(this, JSON.parse(fs.readFileSync(`${this.cacheFilePath}/guilds.json`, "utf8")));
			}
			this.on(Discord.Constants.Events.SHARD_RESUME, () => {
				if(!this.readyAt) { this.ws.checkShardsReady(); }
			});
			this.dumpCache = (sessions, client) => {
				if (!fs.existsSync(client.cacheFilePath)) { fs.mkdirSync(client.cacheFilePath); }
				try {
					client.ws._hotreload = JSON.parse(fs.readFileSync(`${client.cacheFilePath}/sessions.json`, "utf8"));
				} catch(e) {
					client.ws._hotreload = {};
				}
				client.ws._hotreload = {
					...client.ws._hotreload,
					...sessions
				};
				fs.writeFileSync(`${client.cacheFilePath}/sessions.json`, JSON.stringify(client.ws._hotreload));
				if (options.cacheGuilds) {
					const discordGuilds = client.guilds.cache.map(g => g._unpatch());
					fs.writeFileSync(`${client.cacheFilePath}/guilds.json`, JSON.stringify(discordGuilds));
					const discordMe = client.user._unpatch();
					fs.writeFileSync(`${client.cacheFilePath}/me.json`, JSON.stringify(discordMe));
				}
			};
			this._uncaughtExceptionOnExit = false;
			for (const eventType of options.exitEvents) {
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
			if (typeof options.hotReload.sessionData !== "object") {
				throw new TypeError("CLIENT_INVALID_OPTION", "sessionData", "an object");
			}
			if (typeof options.hotReload.cacheData !== "object") {
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
