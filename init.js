"use strict";

const { resolve } = require("path");
const Permissions = require(resolve(require.resolve("discord.js").replace("index.js","/util/Permissions.js")));
const Constants = require(resolve(require.resolve("discord.js").replace("index.js","/util/Constants.js")));
const Intents = require(resolve(require.resolve("discord.js").replace("index.js","/util/Intents.js")));

const SHPath = resolve(require.resolve("discord.js").replace("index.js","/client/websocket/WebSocketShard.js"));
const SH = require(SHPath);
require.cache[SHPath].exports = class WebSocketShard extends SH {
	async emitReady() {
		let c = this.manager.client;
		if(c.options.fetchAllMembers && (!c.options.ws.intents || (c.options.ws.intents & Intents.FLAGS.GUILD_MEMBERS))) {
			let guilds = c.guilds.cache.filter(g => g.shardID === this.id);
			for(let guild of guilds.values()) {
				if(!guild.available) {
					this.manager.debug(`Failed to fetch all members for guild ${guild.id}! Guild not avalable`);
					continue;
				}
				await guild.members.fetch().catch(err => {
					this.manager.debug(`Failed to fetch all members for guild ${guild.id}! ${err}\n${err.stack}`);
				});
			}
		}
		this.status = Constants.Status.READY;
		this.emit(Constants.ShardEvents.ALL_READY, this.expectedGuilds.size ? this.expectedGuilds : void 0);
	}
	checkReady() {
		if(this.readyTimeout) {
			this.manager.client.clearTimeout(this.readyTimeout);
			this.readyTimeout = void 0;
		}
		if(!this.expectedGuilds.size) {
			this.debug("Shard received all its guilds. Marking as fully ready.");
			this.emitReady();
			return;
		}
		this.readyTimeout = this.manager.client.setTimeout(() => {
			this.debug(`Shard did not receive any more guild packets in 15 seconds. Unavailable guild count: ${this.expectedGuilds.size}`);
			this.readyTimeout = void 0;
			this.emitReady();
		}, 15000);
	}
}

const VCPath = resolve(require.resolve("discord.js").replace("index.js","/client/voice/VoiceConnection.js"));
const VC = require(VCPath);
require.cache[VCPath].exports = class VoiceConnection extends VC {
	constructor(voiceManager, channel) {
		super(voiceManager);
		this._channel = channel;
		Object.defineProperty(this, "channel", {
			enumerable: false,
			get: function() {
				return this.client.channels.cache.get(this._channel.id) || this._channel;
			}
		});
	}
	updateChannel(channel) {
		this._channel = channel;
		this.sendVoiceStateUpdate();
	}
}

const ALPath = resolve(require.resolve("discord.js").replace("index.js","/structures/GuildAuditLogs.js"));
const AL = require(ALPath);
AL.Entry = class GuildAuditLogsEntry extends AL.Entry {
	constructor(logs, guild, data) {
		super(logs,guild,data);
		if(!this.executor) { this.executor = guild.client.users.add(logs._users.find(t => t.id === data.user_id), false); }
		let c = logs.constructor;
		let target = c.targetType(data.action_type);
		if((target === c.Targets.USER || (target === c.Targets.MESSAGE && data.action_type !== c.Actions.MESSAGE_BULK_DELETE)) && data.target_id && !this.target) {
			this.target = guild.client.users.add(logs._users.find(t => t.id === data.target_id), false);
		} else if(target === c.Targets.GUILD && !this.target) {
			this.target = guild.client.guilds.add({ id: data.target_id }, false);
		}
	}
}
require.cache[ALPath].exports = class GuildAuditLogs extends AL {
	constructor(guild, data) {
		let o = {}
		for(let i in data) {
			if(!["users","audit_log_entries"].includes(i)) { o[i] = data[i]; }
		}
		o.audit_log_entries = [];
		super(guild,o);
		this._users = data.users;
		for(const item of data.audit_log_entries) {
			const entry = new this.constructor.Entry(this, guild, item);
			this.entries.set(entry.id, entry);
		}
	}
	static build(...args) {
		let logs = new this(...args);
		return Promise.all(logs.entries.map(e => e.target)).then(() => logs);
	}
}

const GCPath = resolve(require.resolve("discord.js").replace("index.js","/structures/GuildChannel.js"));
const GC = require(GCPath);
require.cache[GCPath].exports = class GuildChannel extends GC {
	constructor(guild, data) {
		super({client: guild.client}, data);
		if(this.client.options.cacheGuilds) {
			this.guild = guild;
		} else {
			this._guildID = guild.id;
			this._shardID = guild.shardID;
			Object.defineProperty(this, "guild", {
				enumerable: false,
				get: function() {
					return this.client.guilds.cache.get(this._guildID) || this.client.guilds.add({id:this._guildID,shardID:this._shardID}, false);
				}
			});
		}
	}
	get deletable() {
		return this.guild.roles.cache.size && this.permissionOverwrites.size ? this.permissionsFor(this.client.user).has(Permissions.FLAGS.MANAGE_CHANNELS, false) : false;
	}
}

const RMPath = resolve(require.resolve("discord.js").replace("index.js","/managers/ReactionManager.js"));
const RM = require(RMPath);
require.cache[RMPath].exports = class ReactionManager extends RM {
	forge(id) {
		let emoji = {};
		if(isNaN(id)) {
			emoji.name = id;
		} else {
			emoji.id = id;
		}
		return this.add({emoji},false);
	}
}

const Action = require(resolve(require.resolve("discord.js").replace("index.js","/client/actions/Action.js")));
Action.prototype.getPayload = function(data, manager, id, partialType, cache) {
	return manager.cache.get(id) || manager.add(data, cache);
}
