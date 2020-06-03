const PacketHandlers = require(require.resolve("discord.js").replace("index.js","client/websocket/handlers"));
const disabledEvents = [
	"CHANNEL_CREATE", // 1 // 4096 for dm
	"CHANNEL_DELETE", // 1
	"CHANNEL_PINS_UPDATE", // 1 // 4096 for dm
	"CHANNEL_UPDATE", // 1
	"GUILD_BAN_ADD", // 4
	"GUILD_BAN_REMOVE", // 4
	//"GUILD_CREATE", // 1
	//"GUILD_DELETE", // 1
	"GUILD_EMOJIS_UPDATE", // 8
	"GUILD_INTEGRATIONS_UPDATE", // 16
	//"GUILD_MEMBERS_CHUNK", // passthrough // requires guild members priviledge
	"GUILD_MEMBER_ADD", // 2 // requires guild members priviledge
	"GUILD_MEMBER_REMOVE", // 2 // requires guild members priviledge
	"GUILD_MEMBER_UPDATE", // 2 // requires guild members priviledge
	"GUILD_ROLE_CREATE", // 1
	"GUILD_ROLE_DELETE", // 1
	"GUILD_ROLE_UPDATE", // 1
	//"GUILD_UPDATE", // passthrough // probably implies guilds
	"INVITE_CREATE", // 64
	"INVITE_DELETE", // 64
	"MESSAGE_CREATE", // 512 // 4096 for dm
	"MESSAGE_DELETE", // 512 // 4096 for dm
	"MESSAGE_DELETE_BULK", // passthrough ?
	"MESSAGE_REACTION_ADD", // 1024 // 8192 for dm
	"MESSAGE_REACTION_REMOVE", // 1024 // 8192 for dm
	"MESSAGE_REACTION_REMOVE_ALL", // 1024 // 8192 for dm
	"MESSAGE_REACTION_REMOVE_EMOJI", // 1024 // 8192 for dm
	"MESSAGE_UPDATE", // 512 // 4096 for dm
	"PRESENCE_UPDATE", // 256 // requires presences priviledge
	//"READY",
	//"RESUMED",
	"TYPING_START", // 2048 // 16384 for dm
	"USER_UPDATE", // passthrough
	//"VOICE_SERVER_UPDATE", // passthrough // client voice channel
	"VOICE_STATE_UPDATE", // 128
	"WEBHOOKS_UPDATE" // 32
];

for(let event of disabledEvents) {
	delete PacketHandlers[event];
}

const Discord = require('discord.js');
const util = require('util');

Discord.Structures.extend("Message", M => {
	return class Message extends M {
		constructor(client, data, channel) {
			let d = {};
			let list = ["author","member","mentions"];
			for(let i in data) {
				if(!list.includes(i)) { d[i] = data[i]; }
			}
			super(client, d, channel);
			if(data.author) {
				if(data.author instanceof Discord.User) {
					this.author = data.author;
				} else {
					this.author = client.users.cache.get(data.author.id) || client.users.add(data.author,false);
				}
			}
			if(data.member && this.guild && !this.guild.members.cache.has(data.author.id)) {
				if(data.member instanceof Discord.GuildMember) {
					this._member = data.member;
				} else {
					this._member = this.guild.members.add(Object.assign(data.member,{user:this.author}),false);
				}
			}
			if(data.mentions && data.mentions.length) {
				for(let mention of data.mentions) {
					this.mentions.users.set(mention.id,client.users.cache.get(mention.id) || client.users.add(mention,false))
					if(mention.member && this.guild) {
						this.mentions.members.set(mention.id,this.guild.members.cache.get(mention.id) || this.guild.members.add(Object.assign(mention.member,{user:this.author}),false));
					}
				}
			}
		}
		get member() {
			return this.guild ? this.guild.members.cache.get((this.author || {}).id) || this._member || null : null;
		}
		get pinnable() {
			return (this.type === 'DEFAULT' && (!this.guild || !this.guild.roles.cache.size || this.channel.permissionsFor(this.client.user).has(Discord.Permissions.FLAGS.MANAGE_MESSAGES, false)));
		}
		async reply(content,options = {}) {
			if(content && typeof content === "object" && typeof content.then === "function") { content = {Promise:await content}; }
			if(content && typeof content === "object") {
				if(content.Promise) {
					let obj = util.inspect(content.Promise,{getters: true, depth: 2 }).replace(/  /g,"\t\t").replace(/`/g,"\\`");
					if(obj.length > 1950) { obj = util.inspect(content.Promise,{getters: true, depth: 1 }).replace(/  /g,"\t\t").replace(/`/g,"\\`"); }
					if(obj.length > 1950) { obj = util.inspect(content.Promise,{getters: true, depth: 0 }).replace(/  /g,"\t\t").replace(/`/g,"\\`"); }
					content = "```js\n<Promise> " + obj + "```";
				} else {
					let obj = util.inspect(content,{getters: true, depth: 2 }).replace(/  /g,"\t\t").replace(/`/g,"\\`");
					if(obj.length > 1950) { obj = util.inspect(content,{getters: true, depth: 1 }).replace(/  /g,"\t\t").replace(/`/g,"\\`"); }
					if(obj.length > 1950) { obj = util.inspect(content,{getters: true, depth: 0 }).replace(/  /g,"\t\t").replace(/`/g,"\\`"); }
					content = "```js\n" + obj + "```";
				}
			}
			if(typeof content !== "string") { content = content+""; }
			if(content && content.length > 1950 && !options.split) {
				content = `${content.substring(0, 1950)}\n\n ... and ${content.slice(1950).split("\n").length} more lines ${content.startsWith("```") ? "```" : ""}`;
			}
			if(!content && !options.content && !options.embed && !options.files) {
				content = "⠀";
			}
			/*
			if(this.channel.type === "text" && !this.client.guilds.cache.has(this.channel.guild.id)) {
				this.channel.guild = this.client.guilds.add({id:this.channel.guild.id,shardID:this.channel.guild.shardID}, false);
			}
			*/
			if(!this.client.channels.cache.has(this.channel.id)) {
				this.channel = await this.client.channels.fetch(this.channel.id);
				if(this.guild && !this.guild.channels.cache.has(this.channel.id)) {
					this.guild.channels.cache.set(this.channel.id, this.channel);
				}
			}
			if(!this.client.users.cache.has(this.author.id)) {
				this.author = this.client.users.add(this.author);
			}
			if(this.member && !this.channel.guild.members.cache.has(this.author.id)) {
				this.guild.members.add(this.member);
			}
			if(!this.channel.messages.cache.has(this.id)) {
				this.channel.messages.cache.set(this.id,this);
			}
			if(this.editedTimestamp && this.commandResponse) {
				if(this.commandResponse.attachments.size || options.files) {
					let response = await this.channel.send(content,options);
					if(!this.commandResponse.deleted) { this.commandResponse.delete().catch(e => {}); }
					this.commandResponse = response;
				} else {
					if(this.commandResponse.embeds.length && !options.embed) {
						options.embed = null;
					}
					this.commandResponse = await this.commandResponse.edit(content,options);
				}
			} else {
				this.commandResponse = await this.channel.send(content,options);
			}
			this.commandResponse.commandMessage = this;
			this.commandResponse.commandResponseTime = (this.commandResponse.editedTimestamp || this.commandResponse.createdTimestamp) - (this.editedTimestamp || this.createdTimestamp);
			this.channel.lastActive = Date.now();
			this.author.lastActive = Date.now();

			return this.commandResponse;
		}
		async eval(f) {
			let client = this.client;
			try { let _TEST_ = eval(`(()=>{return ${f}})()`); return _TEST_ && typeof _TEST_ === "object" && typeof _TEST_.then === "function" ? {Promise:await _TEST_} : _TEST_ } catch(e) {
				try { return await eval(`(async()=>{return ${f}})()`); } catch(e) {
					try { let _TEST_ = eval(`(()=>{${f}})()`); return _TEST_ && typeof _TEST_ === "object" && typeof _TEST_.then === "function" ? {Promise:await _TEST_} : _TEST_ } catch(e) {
						try { return await eval(`(async() => {${f}})()`); } catch(e) {
							return e;
			}}}}
		}
	}
});

Discord.Structures.extend("GuildMember", G => {
	return class GuildMember extends G {
		constructor(client, data, guild) {
			let d = {};
			for(let i in data) {
				if(i !== "user") { d[i] = data[i]; }
			}
			super(client, d, guild);
			if(data.user) {
				if(data.user instanceof Discord.User) {
					this.user = data.user;
				} else {
					this.user = client.users.cache.get(data.user.id) || client.users.add(data.user,false);
				}
			}
		}
		equals(member) {
			let equal = member && this.deleted === member.deleted && this.nickname === member.nickname && this._roles.length === member._roles.length;
			return equal;
		}
	}
});

Discord.Structures.extend("Guild", G => {
	return class Guild extends G {
		get nameAcronym() {
			return this.name ? this.name.replace(/\w+/g, name => name[0]).replace(/\s/g, '') : undefined;
		}
		get joinedAt() {
			return this.joinedTimestamp ? new Date(this.joinedTimestamp) : undefined;
		}
	}
});

Discord.Structures.extend("TextChannel", T => {
	return class TextChannel extends T {
		get deletable() {
			return this.guild.roles.cache.size ? this.permissionsFor(this.client.user).has(Discord.Permissions.FLAGS.MANAGE_CHANNELS, false) : undefined;
		}
		async send(content, options) {
			if(!this.client.channels.cache.has(this.id)) { await this.fetch(); }
			return super.send(content, options);
		}
	}
});

Discord.Structures.extend("VoiceChannel", V => {
	return class VoiceChannel extends V {
		get joinable() {
			if(Discord.Constants.browser) return false;
			if(!this.guild.roles.cache.size && !this.client.options.enablePermissions) return true;
			if(!this.viewable) return false;
			if(!this.permissionsFor(this.client.user).has(Discord.Permissions.FLAGS.CONNECT, false)) return false;
			if(this.full && !this.permissionsFor(this.client.user).has(Discord.Permissions.FLAGS.MOVE_MEMBERS, false)) return false;
			return true;
		}
		async join() {
			if(Discord.Constants.browser) return Promise.reject(new Error('VOICE_NO_BROWSER'));
			let channel = await this.client.channels.fetch(this.id);
			if(channel.guild && !channel.guild.channels.cache.has(channel.id)) { channel.guild.channels.cache.set(channel.id,channel); }
			channel.noSweep = true;
			return this.client.voice.joinChannel(channel);
		}
		leave() {
			if(Discord.Constants.browser) return;
			const connection = this.client.voice.connections.get(this.guild.id);
			if(connection && connection.channel.id === this.id) { connection.disconnect(); }
			this.noSweep = false;
		}
	}
});

Discord.Structures.extend("DMChannel", D => {
	return class DMChannel extends D {
		_patch(data) {
			let d = {}
			for(let i in data) {
				if(i !== "recipients") { d[i] = data[i]; }
			}
			super._patch(d);
			if (data.recipients) {
				this.recipient = this.client.users.cache.get(data.recipients[0].id) || this.client.users.add(data.recipients[0],false);
			}
		}
	}
});

Discord.Channel.create = (client, data, guild) => {
	let channel;
	if(!data.guild_id && !guild) {
		if((data.recipients && data.type !== Discord.Constants.ChannelTypes.GROUP) || data.type === Discord.Constants.ChannelTypes.DM) {
			const DMChannel = Discord.Structures.get('DMChannel');
			channel = new DMChannel(client, data);
		} else if(data.type === Discord.Constants.ChannelTypes.GROUP) {
			const PartialGroupDMChannel = require('./PartialGroupDMChannel');
			channel = new PartialGroupDMChannel(client, data);
		}
	} else {
		guild = guild || client.guilds.cache.get(data.guild_id) || client.guilds.add({id:data.guild_id,shardID:data.shardID},false);
		if(guild) {
			switch(data.type) {
				case Discord.Constants.ChannelTypes.TEXT: {
					let TextChannel = Discord.Structures.get('TextChannel');
					channel = new TextChannel(guild, data);
					break;
				}
					case Discord.Constants.ChannelTypes.VOICE: {
					let VoiceChannel = Discord.Structures.get('VoiceChannel');
					channel = new VoiceChannel(guild, data);
					break;
				}
					case Discord.Constants.ChannelTypes.CATEGORY: {
					let CategoryChannel = Discord.Structures.get('CategoryChannel');
					channel = new CategoryChannel(guild, data);
					break;
				}
					case Discord.Constants.ChannelTypes.NEWS: {
					let NewsChannel = Discord.Structures.get('NewsChannel');
					channel = new NewsChannel(guild, data);
					break;
				}
					case Discord.Constants.ChannelTypes.STORE: {
					let StoreChannel = Discord.Structures.get('StoreChannel');
					channel = new StoreChannel(guild, data);
					break;
				}
			}
			if(channel && client.channels.cache.has(channel.id)) { guild.channels.cache.set(channel.id, channel); }
		}
	}
	return channel;
}

Discord.ChannelManager.prototype.add = function(data, guild, cache = true) {
	if(!this.client.options.enablePermissions) {
		if(!this.client.guilds.cache.get(data.guild_id) || !this.client.guilds.cache.get(data.guild_id).roles.cache.size) {
			data.permission_overwrites = [];
		}
	}
	const existing = this.cache.get(data.id);
	if(existing) {
		if (existing._patch && cache) existing._patch(data);
		if (guild) guild.channels.add(existing);
		return existing;
	}
	const channel = Discord.Channel.create(this.client, data, guild);
	if(!channel) {
		this.client.emit(Discord.Constants.Events.DEBUG, `Failed to find guild, or unknown type for channel ${data.id} ${data.type}`);
		return null;
	}
	if(cache) { this.cache.set(channel.id, channel); }
	return channel;
}

Discord.GuildChannelManager.prototype.fetch = async function(cache = true) {
	let channels = await this.client.api.guilds(this.guild.id).channels().get();
	if(cache) {
		for(let channel of channels) {
			let c = this.client.channels.add(channel,this.guild,true);
			this.cache.set(c.id,c);
		}
		return this.cache;
	} else {
		let collection = new Discord.Collection();
		for(let channel of channels) {
			let c = this.client.channels.add(channel,this.guild,false);
			collection.set(c.id,c);
		}
		return collection;
	}
}

Discord.Client = class Client extends Discord.Client {
	constructor(options = {}) {
		options = Object.assign(
			{
				shards: "auto",
				messageCacheMaxSize: 10,
				messageCacheLifetime: 86400,
				messageSweepInterval: 86400,
				clientSweepInterval: 86400,
				shardCheckInterval: 600
			},
			options
		);
		options.ws = Object.assign(
			{
				large_threshold:50,
				intents:1+4+512+1024+4096+8192
			},
			options.ws
		);
		super(options);
		this.on("ready", () => {
			console.log(`[${new Date().toISOString()}] Client Ready`);
		});
		this.on("rateLimit", e => {
			console.log(`[${new Date().toISOString()}] Rate Limited`,e);
		});
		this.on("warn", e => {
			console.log(`[${new Date().toISOString()}] Warning`,e);
		});
		this.on("error", e => {
			console.log(`[${new Date().toISOString()}] Error`,e);
		});
		this.on("shardDisconnect", (e,id) => {
			console.log(`[${new Date().toISOString()}][Shard ${id}] Died and will not reconnect. Reason:`,e);
		});
		this.on("shardError", (e,id) => {
			console.log(`[${new Date().toISOString()}][Shard ${id}] Error`,e);
		});
		this.on("shardReconnecting", id => {
			console.log(`[${new Date().toISOString()}][Shard ${id}] Reconnecting`);
		});
		this.on("shardResume", (id,evts) => {
			console.log(`[${new Date().toISOString()}][Shard ${id}] Resumed`); // evts are useless
		});
		this.on("raw", async (r,shard) => {
			if(r.op > 0) { return; }
			if(r.d) { r.d.shardID = shard; }
			if(r.t !== "READY") {
				let shard = this.ws.shards.get(r.d.shardID);
				shard.lastActive = Date.now();
			}
			switch(r.t) {
				case "READY": {
					console.log(`[${new Date().toISOString()}][Shard ${r.d.shardID}] Connected! Fetching ${r.d.guilds.length} Guilds`);
					break;
				}
				case "MESSAGE_CREATE": case "MESSAGE_UPDATE": {
					if(r.t === "MESSAGE_UPDATE" && !r.d.edited_timestamp) { break; }
					if(r.d.author.id === this.user.id) {
						let channel = this.channels.fetch(r.d.channel_id);
						if(channel.guild && !channel.guild.channels.cache.has(channel.id)) {
							channel.guild.channels.cache.set(channel.id, channel);
						}
						if(channel.recipient) {
							if(!this.users.cache.has(channel.recipient.id)) {
								channel.recipient = this.users.add(channel.recipient);
							}
							channel.recipient.lastActive = Date.now();
						}
						channel.lastActive = Date.now();
					}
					if(r.d.channel_id && (this.rest.handlers.get("/channels/"+r.d.channel_id+"/messages") || {queue:""}).queue.length > 5) {
						console.log("queue limit exceeded, possible spam",(this.rest.handlers.get("/channels/"+r.d.channel_id+"/messages") || {queue:""}).queue);
						break;
					}
					let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false) : undefined;
					let channel = this.channels.cache.get(r.d.channel_id) || this.channels.add({id:r.d.channel_id,type:guild?0:1}, guild, false);
					if(channel.messages.cache.has(r.d.id)) {
						let message = channel.messages.cache.get(r.d.id);
						message.patch(r.d);
						if(message._edits.length > 1) { message._edits.length = 1; }
						this.emit(Discord.Constants.Events.MESSAGE_CREATE, message);
					} else {
						let message = channel.messages.add(r.d, r.d.author.id === this.user.id);
						this.emit(Discord.Constants.Events.MESSAGE_CREATE, message);
					}
					break;
				}
				case "MESSAGE_DELETE": {
					let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false) : undefined;
					let channel = this.channels.cache.get(r.d.channel_id) || this.channels.add({id:r.d.channel_id,type:guild?0:1}, guild, false);
					let message;
					if(channel.messages.cache.has(r.d.id)) {
						message = channel.messages.cache.get(r.d.id);
						channel.messages.cache.delete(message.id);
					} else {
						message = channel.messages.add({id:r.d.id}, false);
						message.system = null;
						message.createdTimestamp = null;
						message.author = {};
					}
					message.deleted = true
					this.emit(Discord.Constants.Events.MESSAGE_DELETE, message);
					break;
				}
				case "MESSAGE_DELETE_BULK": {
					let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false) : undefined;
					let channel = this.channels.cache.get(r.d.channel_id) || this.channels.add({id:r.d.channel_id,type:guild?0:1}, guild, false);
					let deleted = new Discord.Collection();
					for(let i = 0; i < r.d.ids.length; i++) {
						let message;
						if(channel.messages.cache.has(r.d.ids[i])) {
							message = channel.messages.cache.get(r.d.ids[i]);
							channel.messages.cache.delete(message.id);
						} else {
							message = channel.messages.add({id:r.d.ids[i]}, false);
							message.system = null;
							message.createdTimestamp = null;
							message.author = {};
						}
						message.deleted = true;
						deleted.set(r.d.ids[i], message);
					}
					if(deleted.size > 0) {
						this.emit(Discord.Constants.Events.MESSAGE_DELETE_BULK, deleted);
					}
					break;
				}
				case "MESSAGE_REACTION_ADD": {
					let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false) : undefined;
					let channel = this.channels.cache.get(r.d.channel_id) || this.channels.add({id:r.d.channel_id,type:guild?0:1}, guild, false);
					let message = channel.messages.cache.get(r.d.message_id) || channel.messages.add({id:r.d.message_id}, false);
					let user = this.users.cache.get(r.d.user_id) || this.users.add((r.d.member || {}).user || {id:r.d.user_id}, false);
					let reaction = message.reactions.cache.get(r.d.emoji.id || r.d.emoji.name) || message.reactions.add({emoji:r.d.emoji,count:null,me:null}, channel.messages.cache.has(r.d.message_id));
					reaction.me = r.d.user_id === this.user.id;
					if(channel.messages.cache.has(message.id)) {
						reaction.users.cache.set(user.id, user);
						reaction.count = reaction.users.cache.size;
					}
					this.emit(Discord.Constants.Events.MESSAGE_REACTION_ADD, reaction, user);
					break;
				}
				case "MESSAGE_REACTION_REMOVE":  {
					let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false) : undefined;
					let channel = this.channels.cache.get(r.d.channel_id) || this.channels.add({id:r.d.channel_id,type:guild?0:1}, guild, false);
					let message = channel.messages.cache.get(r.d.message_id) || channel.messages.add({id:r.d.message_id}, false);
					let user = this.users.cache.get(r.d.user_id) || this.users.add((r.d.member || {}).user || {id:r.d.user_id}, false);
					let reaction = message.reactions.cache.get(r.d.emoji.id || r.d.emoji.name) || message.reactions.add({emoji:r.d.emoji,count:null,me:null}, channel.messages.cache.has(r.d.message_id));
					reaction.me = r.d.user_id === this.user.id;
					if(channel.messages.cache.has(message.id)) {
						reaction.users.cache.delete(user.id);
						reaction.count = reaction.users.cache.size;
					}
					this.emit(Discord.Constants.Events.MESSAGE_REACTION_REMOVE, reaction, user);
					break;
				}
				case "MESSAGE_REACTION_REMOVE_ALL": {
					let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false) : undefined;
					let channel = this.channels.cache.get(r.d.channel_id) || this.channels.add({id:r.d.channel_id,type:guild?0:1}, guild, false);
					let message = channel.messages.cache.get(r.d.message_id) || channel.messages.add({id:r.d.message_id}, false);
					message.reactions.cache.clear();
					this.emit(Discord.Constants.Events.MESSAGE_REACTION_REMOVE_ALL, message);
					break;
				}
				case "MESSAGE_REACTION_REMOVE_EMOJI": {
					let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false) : undefined;
					let channel = this.channels.cache.get(r.d.channel_id) || this.channels.add({id:r.d.channel_id,type:guild?0:1}, guild, false);
					let message = channel.messages.cache.get(r.d.message_id) || channel.messages.add({id:r.d.message_id}, false);
					let reaction = message.reactions.cache.get(r.d.emoji.id || r.d.emoji.name) || message.reactions.add({emoji:r.d.emoji,count:null,me:null}, channel.messages.cache.has(r.d.message_id));
					reaction.me = r.d.user_id === this.user.id;
					message.reactions.cache.delete(r.d.emoji.id || r.d.emoji.name);
					this.emit(Discord.Constants.Events.MESSAGE_REACTION_REMOVE_EMOJI, reaction.emoji);
					break;
				}
				case "CHANNEL_CREATE": {
					let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false) : undefined;
					let channel = this.channels.cache.get(r.d.id) || this.channels.add(r.d, guild, false);
					this.emit(Discord.Constants.Events.CHANNEL_CREATE, channel);
					break;
				}
				case "CHANNEL_UPDATE": {
					let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false) : undefined;
					if(guild && (!this.options.enablePermissions && !guild.roles.cache.size)) { r.d.permission_overwrites = []; }
					if(this.channels.cache.has(r.d.id)) {
						let newChannel = this.channels.cache.get(r.d.id);
						let oldChannel = newChannel._update(r.d);
						if(Discord.Constants.ChannelTypes[oldChannel.type.toUpperCase()] !== r.d.type) {
							let changedChannel = Discord.Channel.create(this, r.d, this.guilds.cache.get(r.d.guild_id));
							for(let [id, message] of oldChannel.messages.cache) { changedChannel.messages.cache.set(id, message); }
							changedChannel._typing = new Map(newChannel._typing);
							newChannel = changedChannel;
					        this.channels.cache.set(newChannel.id, newChannel);
						}
						this.emit(Discord.Constants.Events.CHANNEL_UPDATE, oldChannel, newChannel);
					} else {
						let channel = this.channels.add(r.d, guild, false);
						this.emit(Discord.Constants.Events.CHANNEL_UPDATE, null, channel);
					}
					break;
				}
				case "CHANNEL_PINS_UPDATE": {
					let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false) : undefined;
					let channel = this.channels.cache.get(r.d.channel_id) || this.channels.add({id:r.d.channel_id,type:guild?0:1}, guild, false);
					let date = new Date(r.d.last_pin_timestamp);
					this.emit(Discord.Constants.Events.CHANNEL_PINS_UPDATE, channel, date);
					break;
				}
				case "CHANNEL_DELETE": {
					let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false) : undefined;
					if(this.channels.cache.has(r.d.id)) {
						let channel = this.channels.cache.get(r.d.id);
						if(channel.messages && !(channel instanceof Discord.DMChannel)) {
							for(let message of channel.messages.cache.values()) {
								message.deleted = true;
							}
						}
						this.channels.remove(channel.id);
						channel.deleted = true;
						this.emit(Discord.Constants.Events.CHANNEL_DELETE, channel);
					} else {
						let channel = this.channels.add(r.d, guild, false);
						this.emit(Discord.Constants.Events.CHANNEL_DELETE, channel);
					}
					break;
				}
				case "GUILD_MEMBER_ADD": {
					let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false);
					let member = guild.members.add(r.d, false);
					if(guild.memberCount) { guild.memberCount++; }
					this.emit(Discord.Constants.Events.GUILD_MEMBER_ADD, member);
					break;
				}
				case "GUILD_MEMBER_REMOVE": {
					let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false);
					let member = guild.members.cache.get(r.d.user.id) || guild.members.add(r.d, false);
					member.deleted = true;
					guild.members.cache.delete(r.d.user.id);
					guild.voiceStates.cache.delete(r.d.user.id);
					if(guild.memberCount) { guild.memberCount--; }
					this.emit(Discord.Constants.Events.GUILD_MEMBER_REMOVE, member);
					break;
				}
				case "GUILD_MEMBER_UPDATE": {
					let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false);
					if(guild.members.cache.has(r.d.user.id)) {
						let newMember = guild.members.cache.get(r.d.user.id);
						let oldMember = newMember._update(r.d);
						if(!newMember.equals(oldMember)) {
							this.emit(Discord.Constants.Events.GUILD_MEMBER_UPDATE, oldMember, newMember);
						}
					} else {
						let member = guild.members.add(r.d, false);
						this.emit(Discord.Constants.Events.GUILD_MEMBER_UPDATE, null, member);
					}
					break;
				}
				case "GUILD_ROLE_CREATE": {
					let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false);
					let role = guild.roles.add(r.d.role, Boolean(guild.roles.cache.size));
					this.emit(Discord.Constants.Events.GUILD_ROLE_CREATE, role);
					break;
				}
				case "GUILD_ROLE_UPDATE": {
					let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false);
					if(guild.roles.cache.size) {
						if(guild.roles.cache.has(r.d.role.id)) {
							let newRole = guild.roles.cache.get(r.d.role.id);
							let oldRole = newRole._update(r.d.role);
							this.emit(Discord.Constants.Events.GUILD_ROLE_UPDATE, oldRole, newRole);
						} else {
							let role = guild.roles.add(r.d.role, true);
							this.emit(Discord.Constants.Events.GUILD_ROLE_UPDATE, null, role);							
						}
					} else {
						let role = guild.roles.add(r.d.role,false);
						this.emit(Discord.Constants.Events.GUILD_ROLE_UPDATE, null, role);
					}
					break;
				}
				case "GUILD_ROLE_DELETE": {
					let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false);
					let role = guild.roles.cache.get(r.d.role_id) || guild.roles.add({id:r.d.role_id}, false);
					guild.roles.cache.delete(r.d.role_id);
    				role.deleted = true;
					this.emit(Discord.Constants.Events.GUILD_ROLE_DELETE, role);
					break;
				}
				case "GUILD_BAN_ADD": {
					let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false);
					let user = this.users.cache.get(r.d.user.id) || this.users.add(r.d.user, false);
					this.emit(Discord.Constants.Events.GUILD_BAN_ADD, guild, user);
					break;
				}
				case "GUILD_BAN_REMOVE": {
					let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false);
					let user = this.users.cache.get(r.d.user.id) || this.users.add(r.d.user, false);
					this.emit(Discord.Constants.Events.GUILD_BAN_REMOVE, guild, user);
					break;
				}
				case "GUILD_MEMBERS_CHUNK": {
					r.d.presences = [];
					break;
				}
				case "GUILD_CREATE": case "GUILD_UPDATE": {
					if(this.options.ws && !(this.options.ws.intents & 128)) { r.d.voice_states = []; }
					if(!this.options.trackPresences) { r.d.presences = []; }
					let guild = this.guilds.cache.get(r.d.id);
					if(!guild || !guild.available) {
						r.d.members = r.d.members && r.d.members.length ? r.d.members.filter(t => t.user.id === this.user.id) : [];
						r.d.emojis = [];
						if(!this.options.enableChannels) {
							if(this.options.ws && this.options.ws.intents & 128) {
								r.d.channels = r.d.channels.filter(c => r.d.voice_states.find(v => v.channel_id === c.id));
							} else {
								r.d.channels = [];
							}
						}
						if(!this.options.enablePermissions) { r.d.roles = []; }
					} else {
						if(r.d.channels && !this.options.enableChannels) { r.d.channels = r.d.channels.filter(t => guild.channels.cache.has(t.id)); }
						if(r.d.members) { r.d.members = r.d.members.filter(t => guild.members.cache.has(t.user.id)); }
						if(!guild.roles.cache.size) { r.d.roles = []; }
						if(!guild.emojis.cache.size) { r.d.emojis = []; }
					}
					break;
				}
				case "USER_UPDATE": {
					if(this.users.cache.has(r.d.id)) {
						let newUser = this.users.cache.get(r.d.id);
						let oldUser = newUser._update(r.d);
						if(!oldUser.equals(newUser)) {
							this.emit(Discord.Constants.Events.USER_UPDATE, oldUser, newUser);
						}
					} else {
						let user = this.users.add(r.d, false);
						this.emit(Discord.Constants.Events.USER_UPDATE, null, user);
					}
					break;
				}
				case "PRESENCE_UPDATE": {
					let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false);
					if(guild.presences.cache.has(r.d.user.id)) {
						if(this.listenerCount(Discord.Constants.Events.PRESENCE_UPDATE)) {
							let oldPresence = guild.presences.cache.get(r.d.user.id)._clone();
							let newPresence = guild.presences.add(Object.assign(r.d,{guild}));
							this.emit(Discord.Constants.Events.PRESENCE_UPDATE, oldPresence, newPresence);
						} else {
							guild.presences.add(Object.assign(r.d,{guild}));
						}
					} else if(this.listenerCount(Discord.Constants.Events.PRESENCE_UPDATE)) {
						let presence = guild.presences.add(Object.assign(r.d,{guild}),false);
						this.emit(Discord.Constants.Events.PRESENCE_UPDATE, null, presence);
					}
					break;
				}
				case "VOICE_STATE_UPDATE": {
					if(r.d.user_id === this.user.id) {
						this.emit('debug', `[VOICE] received voice state update: ${JSON.stringify(r.d)}`);
						this.voice.onVoiceStateUpdate(r.d);
					}
					let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false);
					let oldState = guild.voiceStates.cache.has(r.d.user_id) ? guild.voiceStates.cache.get(r.d.user_id)._clone() : null;
					let newState = r.d.channel_id ? guild.voiceStates.add(r.d) : null;
					if(oldState && !newState) { guild.voiceStates.cache.delete(r.d.user_id); }
					if(oldState || newState) { this.emit(Discord.Constants.Events.VOICE_STATE_UPDATE, oldState, newState); }
				}
			}
		});
		if(this.options.clientSweepInterval && !isNaN(this.options.clientSweepInterval)) {
			setInterval(() => {
				this.sweepInactive();
			},this.options.clientSweepInterval * 1000);
		}
		if(this.options.shardCheckInterval && !isNaN(this.options.shardCheckInterval)) {
			setInterval(() => {
				this.checkShards();
			},this.options.shardCheckInterval * 1000);
		}
		if(this.options.token) {
			console.log(`[${new Date().toISOString()}] Connecting...`);
			this.login(this.options.token).catch(e => { throw e; });
		}
	}
	sweepInactive() {
		let timer = this.options.clientSweepInterval && !isNaN(this.options.clientSweepInterval) ? this.options.clientSweepInterval * 1000 : 86400000;
		if(timer < 60000) { timer = 60000; }
		this.users.cache.sweep(t => (!t.lastActive || t.lastActive < Date.now() - timer) && !t.noSweep && t.id !== this.user.id);
		if(!this.options.enableChannels) { this.channels.cache.sweep(t => (!t.lastActive || t.lastActive < Date.now() - timer) && !t.noSweep); }
		this.guilds.cache.forEach(t => {
			t.members.cache.sweep(m => !this.users.cache.has(m.id));
			t.channels.cache.sweep(m => !this.channels.cache.has(m.id));
		});
	}
	checkShards() {
		let timer = this.options.shardCheckInterval && !isNaN(this.options.shardCheckInterval) ? this.options.shardCheckInterval * 1000 : 600000;
		if(timer < 60000) { timer = 60000; }
		this.ws.shards.forEach(shard => {
			if(shard.lastActive < Date.now() - timer) {
				console.log(`[${new Date().toISOString()}][Shard ${shard.id}] Possibly dead. Attempting to reconnect`);
				shard.destroy();
			}
		})
	}
	async getInfo() {
		const statuses = Object.keys(Discord.Constants.Status);
		if(!this.readyTimestamp) { return {status:statuses[this.ws.status]}; }
		let shards = new Array(this.options.shardCount).fill(0).map((t,i) => { return {
			shardID:i,
			status:statuses[this.ws.shards.get(i).status],
			ping:Math.round(this.ws.shards.get(i).ping),
			guilds:this.guilds.cache.filter(t => t.shardID === i).size,
			memberCount:this.guilds.cache.reduce((a,t) => t.memberCount && t.shardID === i ? a + t.memberCount : a,0),
			cachedChannels:this.channels.cache.filter(t => t.guild && t.guild.shardID === i).size,
			cachedGuildMembers:this.guilds.cache.reduce((a,t) => t.shardID === i ? a + t.members.cache.filter(a => a.id !== this.user.id).size : a,0),
			cachedGuildChannels:this.guilds.cache.reduce((a,t) => t.shardID === i ? a + t.channels.cache.size : a,0),
			cachedGuildRoles:this.guilds.cache.reduce((a,t) => t.shardID === i ? a + t.roles.cache.size : a,0),
			cachedGuildPresences:this.guilds.cache.reduce((a,t) => t.shardID === i ? a + t.presences.cache.size : a,0),
			cachedGuildVoiceStates:this.guilds.cache.reduce((a,t) => t.shardID === i ? a + t.voiceStates.cache.size : a,0),
			cachedGuildEmojis:this.guilds.cache.reduce((a,t) => t.shardID === i ? a + t.emojis.cache.size : a,0)
		}});
		shards[0].cachedDMUsers = this.users.cache.filter(t => t.id !== this.user.id && !this.guilds.cache.some(a => a.members.cache.has(t.id))).size;
		shards[0].cachedDMChannels = this.channels.cache.filter(t => t.type === "dm").size;
		return {
			shards:shards.length,
			status:statuses[this.ws.status],
			upTime:this.uptime,
			ping:Math.round(this.ws.ping),
			memory:Number(Math.round((process.memoryUsage().rss/1048576)+'e2')+'e-2'),
			cpu:Number(Math.round((await new Promise(async r => {
				let start = [process.hrtime(),process.cpuUsage()];
				await new Promise(r => setTimeout(() => r(),100));
				let elap = [process.hrtime(start[0]),process.cpuUsage(start[1])];
				r(100.0 * ((elap[1].user / 1000) + (elap[1].system / 1000)) / (elap[0][0] * 1000 + elap[0][1] / 1000000));
			}))+'e2')+'e-2'),
			guilds:this.guilds.cache.size,
			memberCount:shards.reduce((a,t) => a + t.memberCount,0),
			cachedUsers:this.users.cache.filter(t => t.id !== this.user.id).size,
			cachedChannels:this.channels.cache.size,
			cachedGuildMembers:shards.reduce((a,t) => a + t.cachedGuildMembers,0),
			cachedGuildChannels:shards.reduce((a,t) => a + t.cachedGuildChannels,0),
			cachedGuildRoles:shards.reduce((a,t) => a + t.cachedGuildRoles,0),
			cachedGuildPresences:shards.reduce((a,t) => a + t.cachedGuildPresences,0),
			cachedGuildVoiceStates:shards.reduce((a,t) => a + t.cachedGuildVoiceStates,0),
			cachedGuildEmojis:shards.reduce((a,t) => a + t.cachedGuildEmojis,0)
			shardDetails:shards
		}
	}
}

module.exports = Discord;