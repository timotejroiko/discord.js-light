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
			sessions: {},
			..._options,
			restoreCache: {
				channels: false,
				guilds: true,
				presences: false,
				roles: false,
				overwrites: false,
				emojis: false,
				members: false,
				..._options.restoreCache
			},
			exitEvents: ["exit", "uncaughtException", "SIGINT", "SIGTERM", ..._options.exitEvents]
		};
		super(options);
		actions(this);
		if (options.hotreload) {
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

			if (options.restoreCache.guilds) {
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
				if (options.restoreCache.guilds) {
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
};

Discord.version = `${pkg.version} (${Discord.version})`;

module.exports = Discord;
