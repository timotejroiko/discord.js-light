const Discord = require('discord.js');

module.exports = async function(r,shard) {
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
				let channel = await this.channels.fetch(r.d.channel_id);
				if(channel.recipient) {
					if(!this.users.cache.has(channel.recipient.id)) {
						channel.recipient = this.users.add(channel.recipient);
					}
					channel.recipient.lastActive = Date.now();
				}
				channel.lastActive = Date.now();
			}
			if(r.d.channel_id && (this.rest.handlers.get("/channels/"+r.d.channel_id+"/messages") || {queue:[]}).queue.length > this.options.queueLimit) { break; }
			let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false) : undefined;
			let channel = this.channels.cache.get(r.d.channel_id) || this.channels.add({id:r.d.channel_id,type:guild?0:1}, guild, false);
			let message = channel.messages.cache.get(r.d.id);
			channel.lastMessageID = r.d.id;
			if(message) {
				message.patch(r.d);
				if(message._edits.length > 1) { message._edits.length = 1; }
			} else {
				message = channel.messages.add(r.d, r.d.author.id === this.user.id);
			}
			if(message.author) {
				message.author.lastMessageID = r.d.id;
				message.author.lastMessageChannelID = channel.id;
			}
			if(message.member) {
				message.member.lastMessageID = r.d.id;
				message.member.lastMessageChannelID = channel.id;
			}
			this.emit(Discord.Constants.Events.MESSAGE_CREATE, message);
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
			if(this.channels.cache.has(r.d.id)) {
				let newChannel = this.channels.cache.get(r.d.id);
				if(guild && (!this.options.enablePermissions && !guild.roles.cache.size && !newChannel.permissionOverwrites.size)) { r.d.permission_overwrites = []; }
				let oldChannel = newChannel._update(r.d);
				if(Discord.Constants.ChannelTypes[oldChannel.type.toUpperCase()] !== r.d.type) {
					let changedChannel = Discord.Channel.create(this, r.d, newChannel.guild);
					for(let [id, message] of newChannel.messages.cache) { changedChannel.messages.cache.set(id, message); }
					changedChannel._typing = new Map(newChannel._typing);
					newChannel = changedChannel;
			        this.channels.cache.set(newChannel.id, newChannel);
			        if(newChannel.guild) { newChannel.guild.channels.add(newChannel); }
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
		case "GUILD_MEMBERS_CHUNK": {
			let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false);
			this.emit(Discord.Constants.Events.GUILD_MEMBERS_CHUNK, guild, r.d);
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
		case "GUILD_CREATE": {
			if(!(this.options.ws.intents & 128)) { r.d.voice_states = []; }
			if(!this.options.trackPresences) { r.d.presences = []; }
			let guild = this.guilds.cache.get(r.d.id);
			if(guild) {
				if(!guild.available && !r.d.unavailable) {
					if(r.d.channels && !this.options.enableChannels) { r.d.channels = r.d.channels.filter(t => guild.channels.cache.has(t.id)); }
					if(r.d.members && r.d.members.length) { r.d.members = r.d.members.filter(t => this.users.cache.has(t.user.id)); }
					if(!this.options.enablePermissions && !guild.roles.cache.size) { r.d.roles = []; }
					if(!guild.emojis || !guild.emojis.cache.size) { r.d.emojis = []; }
					guild._patch(r.d);
					if(this.ws.status === Discord.Constants.Status.READY && this.options.fetchAllMembers && (this.options.ws.intents & 2)) {
						await guild.members.fetch({limit:0}).catch(err => this.emit(Discord.Constants.Events.DEBUG, `Failed to fetch all members: ${err}\n${err.stack}`));
					}
				}
			} else {
				if(r.d.members && r.d.members.length) { r.d.members = r.d.members.filter(t => this.users.cache.has(t.user.id)); }
				r.d.emojis = [];
				if(!this.options.enableChannels) {
					if(this.options.ws && this.options.ws.intents & 128) {
						r.d.channels = r.d.channels.filter(c => r.d.voice_states.find(v => v.channel_id === c.id));
					} else {
						r.d.channels = [];
					}
				}
				if(!this.options.enablePermissions) { r.d.roles = []; }
				guild = this.guilds.add(r.d);
				if(this.ws.status === Discord.Constants.Status.READY) {
					if(this.options.fetchAllMembers && (this.options.ws.intents & 2)) {
						await guild.members.fetch({limit:0}).catch(err => this.emit(Discord.Constants.Events.DEBUG, `Failed to fetch all members: ${err}\n${err.stack}`));
					}
					this.emit(Discord.Constants.Events.GUILD_CREATE, guild)
				}
			}
			break;
		}
		case "GUILD_UPDATE": {
			if(this.options.ws && !(this.options.ws.intents & 128)) { r.d.voice_states = []; }
			if(!this.options.trackPresences) { r.d.presences = []; }
			let guild = this.guilds.cache.get(r.d.id);
			if(guild) {
				if(r.d.channels && !this.options.enableChannels) { r.d.channels = r.d.channels.filter(t => guild.channels.cache.has(t.id)); }
				if(r.d.members) { r.d.members = r.d.members.filter(t => guild.members.cache.has(t.user.id)); }
				if(!this.options.enablePermissions && !guild.roles.cache.size) { r.d.roles = []; }
				if(!guild.emojis.cache.size) { r.d.emojis = []; }
				let old = guild._update(r.d);
				this.emit(Discord.Constants.Events.GUILD_UPDATE, old, guild);
			} else {
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
				guild = this.guilds.add(r.d, false);
				this.emit(Discord.Constants.Events.GUILD_UPDATE, null, guild);
			}
			break;
		}
		case "GUILD_DELETE": {
			if(!this.guilds.cache.has(r.d.id)) {
				let guild = this.guilds.add({id:r.d.id,shardID:r.d.shardID}, false);
				if(r.d.unavailable) {
					guild.unavailable = true;
					this.emit(Discord.Constants.Events.GUILD_UNAVAILABLE, guild);
				} else {
					this.emit(Discord.Constants.Events.GUILD_DELETE, guild);
				}
			}
			break;
		}
		case "GUILD_EMOJIS_UPDATE": {
			let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false);
			if(!guild.emojis) { guild.emojis = new Discord.GuildEmojiManager(guild); }
			if(guild.emojis.cache.size) {
				let deletions = new Map(guild.emojis.cache);
				for(let emoji of r.d.emojis) {
					let cached = guild.emojis.cache.get(emoji.id);
					if(cached) {
						deletions.delete(emoji.id);
						if(!cached.equal(emoji)) {
							let old = cached._update(emoji);
							this.emit(Discord.Constants.Events.GUILD_EMOJI_UPDATE, old, cached);
						}
					} else {
						let create = guild.emojis.add(emoji);
						this.emit(Discord.Constants.Events.GUILD_EMOJI_CREATE, create);
					}
				}
				for(let deleted of deletions.values()) {
					guild.emojis.cache.delete(deleted.id);
					deleted.deleted = true;
					this.emit(Discord.Constants.Events.GUILD_EMOJI_DELETE, deleted);
				}
			} else {
				let emojis = new Discord.Collection();
				for(let emoji of r.d.emojis) {
					emojis.set(emoji.id, guild.emojis.add(emoji, false));
				}
				this.emit("guildEmojisUpdate", emojis)
			}
			break;
		}
		case "GUILD_INTEGRATIONS_UPDATE": {
			let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false);
			this.emit(Discord.Constants.Events.GUILD_INTEGRATIONS_UPDATE, guild);
			break;
		}
		case "WEBHOOKS_UPDATE": {
			let guild = this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false);
			let channel = this.channels.cache.get(r.d.channel_id) || this.channels.add({id:r.d.channel_id,type:guild?0:1}, guild, false);
			this.emit(Discord.Constants.Events.WEBHOOKS_UPDATE, channel);
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
			if(this.options.trackPresences || guild.members.cache.has(r.d.user.id)) {
				if(this.listenerCount(Discord.Constants.Events.PRESENCE_UPDATE)) {
					let oldPresence = guild.presences.cache.get(r.d.user.id) || null;
					if(oldPresence) { oldPresence = oldPresence._clone(); }
					let newPresence = guild.presences.add(Object.assign(r.d,{guild}));
					this.emit(Discord.Constants.Events.PRESENCE_UPDATE, oldPresence, newPresence);
				} else {
					guild.presences.add(Object.assign(r.d,{guild}));
				}
			} else if(this.listenerCount(Discord.Constants.Events.PRESENCE_UPDATE)) {
				let presence = guild.presences.add(Object.assign(r.d,{guild}), false);
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
			break;
		}
		case "TYPING_START": {
			if(!this.channels.cache.has(r.d.channel_id) || !this.users.cache.has(r.d.user_id)) {
				let guild = r.d.guild_id ? this.guilds.cache.get(r.d.guild_id) || this.guilds.add({id:r.d.guild_id,shardID:r.d.shardID}, false) : undefined;
				let channel = this.channels.cache.get(r.d.channel_id) || this.channels.add({id:r.d.channel_id,type:guild?0:1}, guild, false);
				let user = this.users.cache.get(r.d.user_id) || this.users.add((r.d.member || {}).user || {id:r.d.user_id}, false);
				this.emit(Discord.Constants.Events.TYPING_START, channel, user);
			}
			break;
		}
	}
}