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
		async reply(content,options) {
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
			if(content && typeof content !== "string") { content = content+""; }
			if(content && content.length > 1960 && (!options || !options.split)) {
				content = `${content.substring(0, 1960)}\n\n ... and ${content.slice(1960).split("\n").length} more lines ${content.startsWith("```") ? "```" : ""}`;
			}
			if(!content && (!options || (!options.content && !options.embed && !options.files))) {
				content = "⠀";
			}
			if(this.channel.type === "text" && !this.client.guils.cache.has(this.channel.guild.id)) {
				this.channel.guild = await this.client.guilds.add({id:this.channel.guild.id});
			}
			if(!this.client.channels.cache.has(this.channel.id)) {
				this.channel = await this.client.channels.fetch(this.channel.id);
				if(this.guild) { this.guild.channels.add(this.channel); }
			}
			if(!this.client.users.cache.has(this.author.id)) {
				this.author = this.client.users.add(this.author);
				if(this.member) { this.guild.members.add(this.member); }
			}
			if(!this.channel.messages.cache.has(this.id)) {
				this.channel.messages.cache.set(this.id,this);
			}
			if(this.editedTimestamp && this.commandResponse) {
				if(this.commandResponse.attachments.size || (options && options.files)) {
					let response = await this.channel.send(content,options);
					if(!this.commandResponse.deleted) { this.commandResponse.delete().catch(e => {}); }
					this.commandResponse = response;
				} else {
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
		switch(data.type) {
			case Discord.Constants.ChannelTypes.DM: {
				const DMChannel = Discord.Structures.get('DMChannel');
				channel = new DMChannel(client, data);
				break;
			}
			case Discord.Constants.ChannelTypes.GROUP: {
				const PartialGroupDMChannel = require('./PartialGroupDMChannel');
				channel = new PartialGroupDMChannel(client, data);
				break;
			}
		}
	} else {
		guild = guild || client.guilds.cache.get(data.guild_id);
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

Discord.Client = class Client extends Discord.Client {
	constructor(options = {}) {
		options = Object.assign(
			{
				shards: "auto",
				messageCacheMaxSize: 10,
				messageCacheLifetime: 86400,
				messageSweepInterval: 86400,
				disableMentions: true,
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
		options.disabledEvents = [
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
			//"GUILD_MEMBERS_CHUNK", ?
			"GUILD_MEMBER_ADD", // 2
			"GUILD_MEMBER_REMOVE", // 2
			"GUILD_MEMBER_UPDATE", // 2
			"GUILD_ROLE_CREATE", // 1
			"GUILD_ROLE_DELETE", // 1
			"GUILD_ROLE_UPDATE", // 1
			//"GUILD_UPDATE", // ^ ?
			"INVITE_CREATE", // 64
			"INVITE_DELETE", // 64
			"MESSAGE_CREATE", // 512 // 4096 for dm
			"MESSAGE_DELETE", // 512 // 4096 for dm
			"MESSAGE_DELETE_BULK", // ^ ?
			"MESSAGE_REACTION_ADD", // 1024 // 8192 for dm
			"MESSAGE_REACTION_REMOVE", // 1024 // 8192 for dm
			"MESSAGE_REACTION_REMOVE_ALL", // 1024 // 8192 for dm
			"MESSAGE_REACTION_REMOVE_EMOJI", // 1024 // 8192 for dm
			"MESSAGE_UPDATE", // 512 // 4096 for dm
			"PRESENCE_UPDATE", // 256
			//"READY",
			//"RESUMED",
			"TYPING_START", // 2048 // 16384 for dm
			"USER_UPDATE", // ?
			"VOICE_SERVER_UPDATE", // ?
			"VOICE_STATE_UPDATE", // 128
			"WEBHOOKS_UPDATE" // 32
		];
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
			console.log(`[${new Date().toISOString()}][Shard ${id}] Died`,e);
		});
		this.on("shardError", (e,id) => {
			console.log(`[${new Date().toISOString()}][Shard ${id}] Error`,e);
		});
		this.on("shardReconnecting", e => {
			console.log(`[${new Date().toISOString()}][Shard ${e}] Reconnecting`,e);
		});
		this.on("shardResume", (e,evts) => {
			console.log(`[${new Date().toISOString()}][Shard ${e}] Resumed`,e,evts);
		});
		this.on("raw", async r => {
			switch(r.t) {
				case "MESSAGE_CREATE": case "MESSAGE_UPDATE": {
					if(r.t === "MESSAGE_UPDATE" && !r.d.edited_timestamp) { break; }
					if(this.users.cache.has(r.d.author.id)) {
						let user = this.users.cache.get(r.d.author.id);
						let olduser = user._update(r.d.author);
						if(!user.equals(olduser)) {
							this.emit("userUpdate",olduser,user);
						}
					}
					if(this.guilds.cache.has(r.d.guild_id) && this.guilds.cache.get(r.d.guild_id).members.cache.has(r.d.author.id)) {
						r.d.member.user = r.d.author;
						let member = this.guilds.cache.get(r.d.guild_id).members.cache.get(r.d.author.id);
						let oldmember = member._update(r.d.member);
						if(!member.equals(oldmember)) {
							client.emit("memberUpdate",oldmember,member);
						}
					}
					if(r.d.author.id === this.user.id) {
						let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id});
						let channel = this.channels.cache.get(r.d.channel_id);
						if(!channel) {
							channel = await this.channels.fetch(r.d.channel_id);
							if(channel.guild) {
								if(channel.permissionOverwrites && !channel.guild.roles.cache.size) { channel.permissionOverwrites.clear(); }
								channel.guild.channels.cache.set(channel.id,channel);
							}
						}
						if(channel.messages.cache.has(r.d.id)) { channel.messages.cache.get(r.d.id).patch(r.d); } else { channel.messages.add(r.d); }
						channel.lastActive = Date.now();
						if(channel.type === "dm") {
							if(!this.users.cache.has(channel.recipient.id)) { this.users.add(channel.recipient); }
							channel.recipient.lastActive = Date.now();
						}
						break;
					}
					if(r.d.channel_id && (this.rest.handlers.get("/channels/"+r.d.channel_id+"/messages") || {queue:""}).queue.length > 5) {
						console.log("rate limited",(this.rest.handlers.get("/channels/"+r.d.channel_id+"/messages") || {queue:""}).queue);
						break;
					}
					let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id},false) : undefined;
					let channel = this.channels.cache.get(r.d.channel_id) || this.channels.add({id:r.d.channel_id,type:guild ? 0 : 1},guild,false);
					let message;
					if(channel.messages.cache.has(r.d.id)) {
						message = channel.messages.cache.get(r.d.id);
						message.patch(r.d);
					} else {
						message = channel.messages.add(r.d,false);
					}
					this.emit("message",message);
					break;
				}
				case "MESSAGE_DELETE": {
					let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id},false) : undefined;
					let channel = this.channels.cache.get(r.d.channel_id) || this.channels.add({id:r.d.channel_id,type:guild ? 0 : 1},guild,false);
					let message;
					if(channel.messages.cache.has(r.d.id)) {
						message = channel.messages.cache.get(r.d.id);
						channel.messages.cache.delete(r.d.id);
					} else {
						message = channel.messages.add(r.d,false);
						message.system = null;
						message.createdTimestamp = null;
						message.author = {};
					}
					message.deleted = true
					this.emit("messageDelete",message);
					break;
				}
				case "MESSAGE_DELETE_BULK": {
					let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id},false) : undefined;
					let channel = this.channels.cache.get(r.d.channel_id) || this.channels.add({id:r.d.channel_id,type:guild ? 0 : 1},guild,false);
					let deleted = new Discord.Collection();
					for(let i = 0; i < r.d.ids.length; i++) {
						let message;
						if(channel.messages.cache.has(r.d.ids[i])) {
							message = channel.messages.cache.get(r.d.ids[i]);
							channel.messages.cache.delete(message.id);
						} else {
							message = channel.messages.add({id:r.d.ids[i]},false);
							message.system = null;
							message.createdTimestamp = null;
							message.author = {};
						}
						message.deleted = true;
						deleted.set(r.d.ids[i],message);
					}
					if(deleted.size > 0) {
						this.emit("messageDeleteBulk",deleted);
					}
					break;
				}
				case "MESSAGE_REACTION_ADD": {
					if(r.d.member && r.d.member.user && this.users.cache.has(r.d.member.user.id)) {
						let user = this.users.cache.get(r.d.member.user.id);
						let olduser = user._update(r.d.member.user);
						if(!user.equals(olduser)) {
							this.emit("userUpdate",olduser,user);
						}
					}
					if(r.d.member && this.guilds.cache.has(r.d.guild_id) && this.guilds.cache.get(r.d.guild_id).members.cache.has(r.d.member.user.id)) {
						let member = this.guilds.cache.get(r.d.guild_id).members.cache.get(r.d.member.user.id);
						let oldmember = member._update(r.d.member);
						if(!member.equals(oldmember)) {
							client.emit("memberUpdate",oldmember,member);
						}
					}
					let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id},false) : undefined;
					let channel = this.channels.cache.get(r.d.channel_id) || this.channels.add({id:r.d.channel_id,type:guild ? 0 : 1},guild,false);
					let message = channel.messages.cache.get(r.d.message_id) || channel.messages.add({id:r.d.message_id},false);
					let user = this.users.cache.get(r.d.user_id) || this.users.add((r.d.member || {}).user || {id:r.d.user_id},false);
					let reaction = message.reactions.cache.get(r.d.emoji.id || r.d.emoji.name) || message.reactions.add({emoji:r.d.emoji,count:null,me:r.d.user_id === this.user.id},channel.messages.cache.has(r.d.message_id));
					if(channel.messages.cache.has(message.id)) {
						reaction.users.cache.set(user.id, user);
						reaction.count = reaction.users.cache.size;
					}
					this.emit("messageReactionAdd",reaction,user);
					break;
				}
				case "MESSAGE_REACTION_REMOVE":  {
					let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id},false) : undefined;
					let channel = this.channels.cache.get(r.d.channel_id) || this.channels.add({id:r.d.channel_id,type:guild ? 0 : 1},guild,false);
					let message = channel.messages.cache.get(r.d.message_id) || channel.messages.add({id:r.d.message_id},false);
					let user = this.users.cache.get(r.d.user_id) || this.users.add((r.d.member || {}).user || {id:r.d.user_id},false);
					let reaction = message.reactions.cache.get(r.d.emoji.id || r.d.emoji.name) || message.reactions.add({emoji:r.d.emoji,count:null,me:r.d.user_id === this.user.id},channel.messages.cache.has(r.d.message_id));
					if(channel.messages.cache.has(message.id)) {
						reaction.users.cache.delete(user.id);
						reaction.count = reaction.users.cache.size;
					}
					this.emit("messageReactionRemove",reaction,user);
					break;
				}
				case "MESSAGE_REACTION_REMOVE_ALL": {
					let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id},false) : undefined;
					let channel = this.channels.cache.get(r.d.channel_id) || this.channels.add({id:r.d.channel_id,type:guild ? 0 : 1},guild,false);
					let message = channel.messages.cache.get(r.d.message_id) || channel.messages.add({id:r.d.message_id},false);
					this.emit("messageReactionRemoveAll",message);
					break;
				}
				case "MESSAGE_REACTION_REMOVE_EMOJI": {
					let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id},false) : undefined;
					let channel = this.channels.cache.get(r.d.channel_id) || this.channels.add({id:r.d.channel_id,type:guild ? 0 : 1},guild,false);
					let message = channel.messages.cache.get(r.d.message_id) || channel.messages.add({id:r.d.message_id},false);
					let reaction = message.reactions.cache.get(r.d.emoji.id || r.d.emoji.name) || message.reactions.add({emoji:r.d.emoji,count:null,me:r.d.user_id === this.user.id},channel.messages.cache.has(r.d.message_id));
					message.reactions.cache.delete(r.d.emoji.id || r.d.emoji.name);
					this.emit("messageReactionRemoveEmoji",reaction.emoji);
					break;
				}
				case "CHANNEL_CREATE": {
					let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id},false) : undefined;
					let channel = this.channels.cache.get(r.d.id);
					if(!channel) {
						channel = this.channels.add(r.d,guild,false);
						this.emit("channelCreate",channel);
					}
					break;
				}
				case "CHANNEL_UPDATE": {
					if(this.channels.cache.has(r.d.id)) {
						let oldchannel = this.channels.cache.get(r.d.id);
						if(oldchannel.guild && this.guilds.cache.has(oldchannel.guild.id) && !oldchannel.guild.roles.cache.size) { r.d.permission_overwrites = []; }
						oldchannel = oldchannel._update(r.d);
						let newchannel = this.channels.cache.get(r.d.id);
						if(Discord.Constants.ChannelTypes[oldchannel.type.toUpperCase()] !== r.d.type) {
							let newchannel = this.channels.add(r.d,this.guilds.cache.get(r.d.guild_id),false);
							for(let [id, message] of oldchannel.messages.cache) { newchannel.messages.cache.set(id, message); }
							this.client.channels.cache.set(newchannel.id, newchannel);
						}
						this.emit("channelUpdate",oldchannel,newchannel);
					} else {
						let channel = this.channels.cache.get(r.d.channel_id);
						let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id},false) : undefined;
						if(!channel) {
							if(guild && !guild.roles.cache.size) { r.d.permission_overwrites = []; }
							channel = this.channels.add(r.d,guild,false);
						}
						this.emit("channelUpdate",null,channel);
					}
					break;
				}
				case "CHANNEL_PINS_UPDATE": {
					let channel = this.channels.cache.get(r.d.channel_id);
					let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id},false) : undefined;
					if(!channel) {
						channel = this.channels.add({id:r.d.channel_id,type:guild ? 0 : 1},guild,false);
					}
					let date = new Date(r.d.last_pin_timestamp);
					this.emit("channelPinsUpdate",channel,date);
					break;
				}
				case "CHANNEL_DELETE": {
					let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id},false) : undefined;
					let channel = this.channels.cache.get(r.d.id);
					if(channel) {
						for(let message of channel.messages.cache.values()) { message.deleted = true; }
						this.channels.remove(channel.id);
						channel.deleted = true;
					} else {
						channel = this.channels.add(r.d,guild,false);
					}
					this.emit("channelDelete",channel);
					break;
				}
				case "GUILD_MEMBER_ADD": {
					if(this.users.cache.has(r.d.user.id)) {
						let user = this.users.cache.get(r.d.user.id);
						let olduser = user._update(r.d.user);
						if(!user.equals(olduser)) {
							this.emit("userUpdate",olduser,user);
						}
					}
					let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id},false);
					let member = guild.members.add(r.d,guild.members.cache.has(r.d.user.id));
					if(!guild.members.cache.has(r.d.user.id)) {
						this.emit("guildMemberAdd",member);
					}
					break;
				}
				case "GUILD_MEMBER_REMOVE": {
					if(this.users.cache.has(r.d.user.id)) {
						let user = this.users.cache.get(r.d.user.id);
						let olduser = user._update(r.d.user);
						if(!user.equals(olduser)) {
							this.emit("userUpdate",olduser,user);
						}
					}
					let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id},false);
					let member = guild.members.cache.get(r.d.user.id) || guild.members.add(r.d,false);
					guild.members.cache.delete(r.d.user.id);
					this.emit("guildMemberRemove",member);
					break;
				}
				case "GUILD_MEMBER_UPDATE": {
					if(this.users.cache.has(r.d.user.id)) {
						let user = this.users.cache.get(r.d.user.id);
						let olduser = user._update(r.d.user);
						if(!user.equals(olduser)) {
							this.emit("userUpdate",olduser,user);
						}
					}
					let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id},false);
					if(guild.members.cache.has(r.d.user.id)) {
						let member = guild.members.cache.get(r.d.user.id);
						let oldmember = member._update(r.d);
						if(!member.equals(oldmember)) {
							client.emit("memberUpdate",oldmember,member);
						}
					}
					let member = guild.members.cache.get(r.d.user.id) || guild.members.add(r.d,false);
					this.emit("guildMemberUpdate",null,member);
					break;
				}
				case "GUILD_ROLE_CREATE": {
					let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id},false);
					if (guild) {
						let role = guild.roles.add(r.d.role, Boolean(guild.roles.cache.size));
						this.emit("roleCreate", role);
					}
					break;
				}
				case "GUILD_ROLE_UPDATE": {
					let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id},false);
					if (guild) {
						if(guild.roles.cache.size) {
							let role = guild.roles.cache.get(r.d.role.id);
							let old = role ? role._update(r.d.role) : null;
							this.emit("roleUpdate", old, role);
						} else {
							let role = guild.roles.add(r.d.role,false);
							this.emit("roleUpdate", null, role);
						}
					}
					break;
				}
				case "GUILD_ROLE_DELETE": {
					let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id},false);
					if (guild) {
						let role = guild.roles.cache.get(r.d.role_id) || guild.roles.add({id:r.d.role_id}, false);
						guild.roles.cache.delete(r.d.role_id);
        				role.deleted = true;
						this.emit("roleDelete", role);
					}
					break;
				}
				case "GUILD_BAN_ADD": {
					if(this.users.cache.has(r.d.user.id)) {
						let user = this.users.cache.get(r.d.user.id);
						let olduser = user._update(r.d.user);
						if(!user.equals(olduser)) {
							this.emit("userUpdate",olduser,user);
						}
					}
					let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id},false);
					let user = this.users.cache.get(r.d.user.id) || this.users.add(r.d.user,false);
					this.emit("guildBanAdd", guild, user);
					break;
				}
				case "GUILD_BAN_REMOVE": {
					if(this.users.cache.has(r.d.user.id)) {
						let user = this.users.cache.get(r.d.user.id);
						let olduser = user._update(r.d.user);
						if(!user.equals(olduser)) {
							this.emit("userUpdate",olduser,user);
						}
					}
					let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id},false);
					let user = this.users.cache.get(r.d.user.id) || this.users.add(r.d.user,false);
					this.emit("guildBanRemove", guild, user);
					break;
				}
				case "GUILD_CREATE": case "GUILD_UPDATE": {
					r.d.voice_states = [];
					r.d.presences = [];
					let guild = this.guilds.cache.get(r.d.id);
					if(!guild || !guild.available) {
						r.d.members = [];
						r.d.channels = [];
						r.d.emojis = [];
						r.d.roles = [];
					} else {
						if(r.d.channels) { r.d.channels = r.d.channels.filter(t => guild.channels.cache.has(t.id)); }
						if(r.d.members) { r.d.members = r.d.members.filter(t => guild.members.cache.has(t.user.id)); }
						if(!guild.roles.cache.size) { r.d.roles = []; }
						if(!guild.emojis.cache.size) { r.d.emojis = []; }
					}
					break;
				}
				case "GUILD_DELETE":
					break;
				case "RESUMED":
					break;
				case "READY": {
					console.log(`[${new Date().toISOString()}][Shard ${r.d.shard[0]}] Connected! Fetching ${r.d.guilds.length} Guilds`);
					break;
				}
			}
		});
		setInterval(() => {
			this.users.cache.sweep(t => (!t.lastActive || t.lastActive < Date.now() - 86400000) && !t.noSweep);
			this.channels.cache.sweep(t => (!t.lastActive || t.lastActive < Date.now() - 86400000) && !t.noSweep);
			this.guilds.cache.forEach(t => {
				t.members.cache.sweep(m => !this.users.cache.has(m.id));
				t.channels.cache.sweep(m => !this.channels.cache.has(m.id));
			});
		},86400000);
		if(this.options.token) {
			console.log(`[${new Date().toISOString()}] Connecting...`);
			this.login(this.options.token).catch(e => { throw e; });
		}
	}
	async getInfo() {
		const statuses = Object.keys(Discord.Constants.Status);
		if(!this.readyTimestamp) { return {status:statuses[this.ws.status]}; }
		let shards = new Array(this.options.shardCount).fill(0).map((t,i) => { return {
			shardID:i,
			status:statuses[this.ws.shards.get(i).status],
			ping:Math.round(this.ws.shards.get(i).ping),
			guilds:this.guilds.cache.filter(t => Math.abs((t.id >> 22)) % this.options.shardCount === i).size,
			memberCount:this.guilds.cache.reduce((a,t) => t.memberCount && Math.abs((t.id >> 22)) % this.options.shardCount === i ? a += t.memberCount : a,0),
			activeGuildMembers:this.guilds.cache.reduce((a,t) => Math.abs((t.id >> 22)) % this.options.shardCount === i ? a += t.members.cache.filter(a => a.id !== this.user.id).size : a,0),
			activeGuildChannels:this.guilds.cache.reduce((a,t) => Math.abs((t.id >> 22)) % this.options.shardCount === i ? a += t.channels.cache.size : a,0)
		}});
		shards[0].activeDMUsers = this.users.cache.filter(t => t.id !== this.user.id && !this.guilds.cache.some(a => a.members.cache.has(t.id))).size;
		shards[0].activeDMChannels = this.channels.cache.filter(t => t.type === "dm").size;
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
			memberCount:shards.reduce((a,t) => a += t.memberCount,0),
			activeUsers:this.users.cache.filter(t => t.id !== this.user.id).size,
			activeChannels:this.channels.cache.size,
			shardDetails:shards
		}
	}
}

module.exports = Discord;