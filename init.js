"use strict";

const { resolve } = require("path");
const Permissions = require(resolve(require.resolve("discord.js").replace("index.js","/util/Permissions.js")));
const Constants = require(resolve(require.resolve("discord.js").replace("index.js","/util/Constants.js")));
const Intents = require(resolve(require.resolve("discord.js").replace("index.js","/util/Intents.js")));
const APIMessage = require(resolve(require.resolve("discord.js").replace("index.js","/structures/APIMessage.js")));

const RHPath = resolve(require.resolve("discord.js").replace("index.js","/rest/APIRequest.js"));
const RH = require(RHPath);
require.cache[RHPath].exports = class APIRequest extends RH {
	async make() {
		let response = await super.make();
		if(this.client.listenerCount("rest")) {
			this.client.emit("rest",{
				path: this.path,
				method: this.method,
				response: this.client.restEventIncludeBuffer ? response.clone().buffer() : null
			});
		}
		return response;
	}
}

const SHPath = resolve(require.resolve("discord.js").replace("index.js","/client/websocket/WebSocketShard.js"));
const SH = require(SHPath);
require.cache[SHPath].exports = class WebSocketShard extends SH {
	async emitReady() {
		let c = this.manager.client;
		if(c.options.fetchAllMembers && (!c.options.ws.intents || (c.options.ws.intents & Intents.FLAGS.GUILD_MEMBERS))) {
			this.debug(`Attempting to fetch all members`);
			let guilds = c.guilds.cache.filter(g => g.shardID === this.id);
			let n = 0;
			let g = 0;
			let limited = false;
			let progress = c.setInterval(() => {
				if(!limited) { this.debug(`Fetching progress: ${g} guilds / ${n} members`); }
			}, 5000);
			for(let guild of guilds.values()) {
				if(!guild.available) {
					this.debug(`Skipped guild ${guild.id}! Guild not available`);
					continue;
				}
				if(this.ratelimit.remaining < 3) {
					let left = Math.ceil((this.ratelimit.timer._idleStart + this.ratelimit.timer._idleTimeout) - process.uptime() * 1000);
					this.debug(`Gateway ratelimit reached, continuing in ${left}ms`);
					limited = true;
					await new Promise(r => setTimeout(r, left));
					limited = false;
				}
				try {
					let m = await guild.members.fetch({time: 15000});
					n += m.size;
					g++;
				} catch(err) {
					this.debug(`Failed to fetch all members for guild ${guild.id}! ${err}`);
				}
			}
			c.clearInterval(progress);
			this.debug(`Fetched ${guilds.reduce((a,t) => a + t.members.cache.size, 0)} members`);
		}
		this.debug(`Ready`);
		this.status = Constants.Status.READY;
		this.emit(Constants.ShardEvents.ALL_READY, this.expectedGuilds.size ? this.expectedGuilds : void 0);
	}
	checkReady() {
		if(this.readyTimeout) {
			this.manager.client.clearTimeout(this.readyTimeout);
			this.readyTimeout = void 0;
		}
		if(!this.expectedGuilds.size) {
			this.debug("Shard received all its guilds, marking as ready.");
			this.emitReady();
			return;
		}
		this.readyTimeout = this.manager.client.setTimeout(() => {
			this.debug(`Shard did not receive any more guilds in 15 seconds, marking as ready. ${this.expectedGuilds.size} guilds are unavailable`);
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
		if(!this.executor) { this.executor = guild.client.users.add(logs._users.find(t => t.id === data.user_id) || {id:data.user_id}, false); }
		let c = logs.constructor;
		let target = c.targetType(data.action_type);
		if((target === c.Targets.USER || (target === c.Targets.MESSAGE && data.action_type !== c.Actions.MESSAGE_BULK_DELETE)) && data.target_id && !this.target) {
			this.target = guild.client.users.add(logs._users.find(t => t.id === data.target_id) || { id: data.target_id }, false);
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

const TXPath = resolve(require.resolve("discord.js").replace("index.js","/structures/interfaces/TextBasedChannel.js"));
const TX = require(TXPath);
require.cache[TXPath].exports = class TextBasedChannel extends TX {
	async send(content, options) {
		if (this.constructor.name === "User" || this.constructor.name === "GuildMember") {
			return this.createDM().then(dm => dm.send(content, options));
		}
		let apiMessage;
		if (content instanceof APIMessage) {
			apiMessage = content.resolveData();
		} else {
			apiMessage = APIMessage.create(this, content, options).resolveData();
			if (Array.isArray(apiMessage.data.content)) {
				return Promise.all(apiMessage.split().map(this.send.bind(this)));
			}
		}
		const { data, files } = await apiMessage.resolveFiles();
		return this.client.api.channels[this.id].messages.post({ data, files }).then(d => {
			if(this.guild) { d.guild_id = this.guild.id; }
			return this.client.actions.MessageCreate.handle(d).message;
		});
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
		if(this.deleted) { return false; }
		if(!this.client.options.cacheRoles && !this.guild.roles.cache.size) { return false; }
		return this.permissionsFor(this.client.user).has(Permissions.FLAGS.MANAGE_CHANNELS, false);
	}
}

const Action = require(resolve(require.resolve("discord.js").replace("index.js","/client/actions/Action.js")));
Action.prototype.getPayload = function(data, manager, id, partialType, cache) {
	return manager.cache.get(id) || manager.add(data, cache);
}
