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
				guilds: true,
			}
			exitEvents: ["exit", "uncaughtException", "SIGINT", "SIGTERM", ..._options.exitEvents]
		};
		super(options);
		actions(this);
		if(options.hotreload) {
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
			try {
				for (const toCache of options.restoreCache) {
					const data = JSON.parse(fs.readFileSync(`${this.cacheFilePath}/${toCache}.json`, "utf8"));
					switch (toCache) {
						case "guilds": {
							console.log("Created");
							data.cache.forEach(i => {
								console.log(i);
								this.guilds.cache.set(i.id, new Discord.Guild(this, i));
								console.log(i.id);
							});
							break;
						}
					}
				}
			} catch(e) {
				// Do nothing
			}
			this.on(Discord.Constants.Events.SHARD_RESUME, () => {
				if(!this.readyAt) { this.ws.checkShardsReady(); }
			});
			this.dumpCache = (sessions, client) => {
					}
			};
			this._uncaughtExceptionOnExit = false;
			for (const eventType of options.exitEvents) {
				process.on(eventType, async () => {
					if (eventType === "uncaughtException") {
						this._uncaughtExceptionOnExit = true;
					}
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
