"use strict";

const { resolve } = require("path");
const Permissions = require(resolve(require.resolve("discord.js").replace("index.js", "/util/Permissions.js")));
const Constants = require(resolve(require.resolve("discord.js").replace("index.js", "/util/Constants.js")));
const APIMessage = require(resolve(require.resolve("discord.js").replace("index.js", "/structures/APIMessage.js")));
const Util = require(resolve(require.resolve("discord.js").replace("index.js", "/util/Util.js")));
const { Error: DJSError } = require(resolve(require.resolve("discord.js").replace("index.js", "/errors")));
const ShardClientUtil = require(resolve(require.resolve("discord.js").replace("index.js", "/sharding/ShardClientUtil.js")));
const Util = require(resolve(require.resolve("discord.js").replace("index.js", "/util/Util.js")));
const { Error: DJSError } = require(resolve(require.resolve("discord.js").replace("index.js", "/errors")));

const RHPath = resolve(require.resolve("discord.js").replace("index.js", "/rest/APIRequest.js"));
const RH = require(RHPath);
require.cache[RHPath].exports = class APIRequest extends RH {
	async make() {
		const response = await super.make();
		if(this.client.listenerCount("rest")) {
			this.client.emit("rest", {
				path: this.path,
				method: this.method,
				response: this.client.options.restEventIncludeBuffer ? response.clone().buffer() : null
			});
		}
		return response;
	}
};

const SHPath = resolve(require.resolve("discord.js").replace("index.js", "/client/websocket/WebSocketShard.js"));
const SH = require(SHPath);
require.cache[SHPath].exports = class WebSocketShard extends SH {
	emitReady() {
		this.debug("Ready");
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
	identify() {
		let hotReload = this.manager.client.options.hotReload;
		if(hotReload) {
			const t = hotReload.sessionData || this.manager.client._loadSession(this.id)
			console.log(t);
			const data = (t)?.[this.id]
			if(data?.id && data.sequence > 0 && !this.sessionID && data.lastConnected + 60000 > Date.now()) {
				this.sessionID = data.id;
				this.closeSequence = this.sequence = data.sequence;
			}
			const cache = this.manager.client.options.hotReload.cacheData;
			if(cache?.guilds && typeof cache.guilds === "object") {
				const keys = Object.keys(cache.guilds);
				for(const id of keys) {
					if(ShardClientUtil.shardIDForGuildID(id, this.manager.totalShards) === this.id) {
						this.manager.client.guilds.add(cache.guilds[id]);
					}
				}
			} else {
				const guilds = this.manager.client._loadCache("guilds", id => ShardClientUtil.shardIDForGuildID(id, this.manager.totalShards));
				for(const guild of Object.values(guilds)) {
					this.manager.client.guilds.add(guild);
				}
			}
		}
		return super.identify();
	}
};

const SHMPath = resolve(require.resolve("discord.js").replace("index.js", "/client/websocket/WebSocketManager.js"));
const SHM = require(SHMPath);
require.cache[SHMPath].exports = class WebSocketManager extends SHM {
	async createShards() {
		const UNRECOVERABLE_CLOSE_CODES = Object.keys(Constants.WSCodes).slice(1).map(Number);
		const UNRESUMABLE_CLOSE_CODES = [1000, 4006, 4007];

		// If we don't have any shards to handle, return
		if (!this.shardQueue.size) {return false;}

		const [shard] = this.shardQueue;

		this.shardQueue.delete(shard);

		if (!shard.eventsAttached) {
			shard.on(Constants.ShardEvents.ALL_READY, unavailableGuilds => {
				this.client.emit(Constants.Events.SHARD_READY, shard.id, unavailableGuilds);

				if (!this.shardQueue.size) {this.reconnecting = false;}
				this.checkShardsReady();
			});

			shard.on(Constants.ShardEvents.CLOSE, event => {
				if (event.code === 1000 ? this.destroyed : UNRECOVERABLE_CLOSE_CODES.includes(event.code)) {
					this.client.emit(Constants.Events.SHARD_DISCONNECT, event, shard.id);
					this.debug(Constants.WSCodes[event.code], shard);
					return;
				}

				if (UNRESUMABLE_CLOSE_CODES.includes(event.code)) {
					// These event codes cannot be resumed
					shard.sessionID = null;
				}

				this.client.emit(Constants.Events.SHARD_RECONNECTING, shard.id);

				this.shardQueue.add(shard);

				if (shard.sessionID) {
					this.debug("Session ID is present, attempting an immediate reconnect...", shard);
					this.reconnect(true);
				} else {
					shard.destroy({
						reset: true,
						emit: false,
						log: false
					});
					this.reconnect();
				}
			});

			shard.on(Constants.ShardEvents.INVALID_SESSION, () => {
				this.client.emit(Constants.Events.SHARD_RECONNECTING, shard.id);
			});

			shard.on(Constants.ShardEvents.DESTROYED, () => {
				this.debug("Shard was destroyed but no WebSocket connection was present! Reconnecting...", shard);

				this.client.emit(Constants.Events.SHARD_RECONNECTING, shard.id);

				this.shardQueue.add(shard);
				this.reconnect();
			});

			shard.eventsAttached = true;
		}

		this.shards.set(shard.id, shard);

		try {
			await shard.connect();
		} catch (error) {
			if (error && error.code && UNRECOVERABLE_CLOSE_CODES.includes(error.code)) {
				throw new DJSError(Constants.WSCodes[error.code]);
				// Undefined if session is invalid, error event for regular closes
			} else if (!error || error.code) {
				this.debug("Failed to connect to the gateway, requeueing...", shard);
				this.shardQueue.add(shard);
			} else {
				throw error;
			}
		}
		// If we have multiple shards add a 5s delay if identifying or no delay if resuming
		if (this.shardQueue.size && Object.keys(this._hotreload).length) {
			this.debug(`Shard Queue Size: ${this.shardQueue.size} with sessions; continuing immediately`);
			return this.createShards();
		} else if (this.shardQueue.size) {
			this.debug(`Shard Queue Size: ${this.shardQueue.size}; continuing in 5s seconds...`);
			await Util.delayFor(5000);
			return this.createShards();
		}

		return true;
	}
};

const VCPath = resolve(require.resolve("discord.js").replace("index.js", "/client/voice/VoiceConnection.js"));
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
};

const ALPath = resolve(require.resolve("discord.js").replace("index.js", "/structures/GuildAuditLogs.js"));
const AL = require(ALPath);
AL.Entry = class GuildAuditLogsEntry extends AL.Entry {
	constructor(logs, guild, data) {
		super(logs, guild, data);
		if(!this.executor) { this.executor = guild.client.users.add(logs._users.find(t => t.id === data.user_id) || { id: data.user_id }, false); }
		const c = logs.constructor;
		const target = c.targetType(data.action_type);
		if(((target === c.Targets.USER || target === c.Targets.MESSAGE) && data.action_type !== c.Actions.MESSAGE_BULK_DELETE) && data.target_id && !this.target) {
			this.target = guild.client.users.add(logs._users.find(t => t.id === data.target_id) || { id: data.target_id }, false);
		} else if(target === c.Targets.GUILD && !this.target) {
			this.target = guild.client.guilds.add({ id: data.target_id }, false);
		}
	}
};
require.cache[ALPath].exports = class GuildAuditLogs extends AL {
	constructor(guild, data) {
		const o = {};
		for(const i in data) {
			if(!["users", "audit_log_entries"].includes(i)) { o[i] = data[i]; }
		}
		o.audit_log_entries = [];
		super(guild, o);
		this._users = data.users;
		for(const item of data.audit_log_entries) {
			const entry = new this.constructor.Entry(this, guild, item);
			this.entries.set(entry.id, entry);
		}
	}
	static build(...args) {
		const logs = new this(...args);
		return Promise.all(logs.entries.map(e => e.target)).then(() => logs);
	}
};

const TXPath = resolve(require.resolve("discord.js").replace("index.js", "/structures/interfaces/TextBasedChannel.js"));
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
		return this.client.api.channels[this.id].messages.post({
			data,
			files
		}).then(d => {
			if(this.guild) { d.guild_id = this.guild.id; }
			return this.client.actions.MessageCreate.handle(d).message;
		});
	}
};

const GCPath = resolve(require.resolve("discord.js").replace("index.js", "/structures/GuildChannel.js"));
const GC = require(GCPath);
require.cache[GCPath].exports = class GuildChannel extends GC {
	constructor(guild, data) {
		super({ client: guild.client }, data);
		if(this.client.options.cacheGuilds) {
			this.guild = guild;
		} else {
			this._guildID = guild.id;
			this._shardID = guild.shardID;
			Object.defineProperty(this, "guild", {
				enumerable: false,
				get: function() {
					return this.client.guilds.cache.get(this._guildID) || this.client.guilds.add({
						id: this._guildID,
						shardID: this._shardID
					}, false);
				}
			});
		}
	}
	_unpatch() {
		let obj = super._unpatch();
		obj.name = this.name;
		obj.position = this.rawPosition;
		obj.parent_id = this.parentID;
		obj.permission_overwrites = this.permissionOverwrites.map(x => ({
			id: x.id,
			type: Constants.OverwriteTypes[x.type],
			deny: x.deny.valueOf().toString(),
			allow: x.allow.valueOf().toString()
		}));
		return obj;
	}
	get deletable() {
		if(this.deleted) { return false; }
		if(!this.client.options.cacheRoles && !this.guild.roles.cache.size) { return false; }
		return this.permissionsFor(this.client.user).has(Permissions.FLAGS.MANAGE_CHANNELS, false);
	}
};

const CPath = resolve(require.resolve("discord.js").replace("index.js", "/structures/Channel.js"));
const C = require(CPath);
require.cache[CPath].exports = class Channel extends C {
	_unpatch() {
		let obj = {
			type: Constants.ChannelTypes[this.type.toUpperCase()],
			id: this.id
		};
		if(this.messages) {
			obj.last_message_id = this.lastMessageID;
			obj.last_pin_timestamp = this.lastPinTimestamp;
		}
		switch(this.type) {
			case "dm": {
				obj.recipients = [this.recipient._unpatch()];
				break;
			}
			case "text": case "news": {
				obj.nsfw = this.nsfw;
				obj.topic = this.topic;
				obj.rate_limit_per_user = this.rateLimitPerUser;
				obj.messages = this.messages.cache.map(x => x._unpatch());
				break;
			}
			case "voice": {
				obj.bitrate = this.bitrate;
				obj.user_limit = this.userLimit
				break;
			}
			case "store": {
				obj.nsfw = this.nsfw;
				break;
			}
		}
		return obj;
	}
};

const Action = require(resolve(require.resolve("discord.js").replace("index.js", "/client/actions/Action.js")));
Action.prototype.getPayload = function(data, manager, id, partialType, cache) {
	return manager.cache.get(id) || manager.add(data, cache);
};
