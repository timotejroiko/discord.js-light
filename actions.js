const PacketHandlers = require("./handlers.js");
const { Error, TypeError, RangeError } = require("discord.js/src/errors");
const { Constants, Collection, Channel, DMChannel, Invite } = require('discord.js');

module.exports = client => {
	client.ws.handlePacket = function(packet, shard) {
		if(packet && PacketHandlers[packet.t]) {
			if(packet.t === "READY") {
				if(!client.options.cacheGuilds) {
					if(shard.readyTimeout) {
						shard.manager.client.clearTimeout(shard.readyTimeout);
						shard.readyTimeout = undefined;
					}
					shard.debug('Guild cache is disabled. Marking as fully ready.');
					shard.status = Constants.Status.READY;
					shard.expectedGuilds = null;
					shard.emit(Constants.ShardEvents.ALL_READY);
				} else {
					shard.checkReady();
				}
			}
			setImmediate(() => {
				shard.lastActive = Date.now();
				PacketHandlers[packet.t](this.client, packet, shard);
			});
		}
		return true;
	}
	client.actions.ChannelCreate.handle = function(data) {
		let c = this.client;
		let guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({id:data.guild_id,shardID:data.shardID}, false) : undefined;
		let channel = c.channels.cache.get(data.id) || c.channels.add(data, guild, false);
		return { channel };
	}
	client.actions.ChannelDelete.handle = function(data) {
		let c = this.client;
		let guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({id:data.guild_id,shardID:data.shardID}, false) : undefined;
		let channel = c.channels.cache.get(data.id);
		if(channel) {
			if(channel.messages && !(channel instanceof DMChannel)) {
				for(let message of channel.messages.cache.values()) {
					message.deleted = true;
				}
			}
			c.channels.remove(channel.id);
			channel.deleted = true;
		} else {
			channel = c.channels.add(data, guild, false);
		}
		return { channel };
	}
	client.actions.ChannelUpdate.handle = function(data) {
		let c = this.client;
		let guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({id:data.guild_id,shardID:data.shardID}, false) : undefined;
		if(c.channels.cache.has(data.id)) {
			let newChannel = c.channels.cache.get(data.id);
			if(guild && (!c.options.enablePermissions && !guild.roles.cache.size && !newChannel.permissionOverwrites.size)) { data.permission_overwrites = []; }
			let oldChannel = newChannel._update(data);
			if(Constants.ChannelTypes[oldChannel.type.toUpperCase()] !== data.type) {
				let changedChannel = Channel.create(c, data, guild);
				for(let [id, message] of newChannel.messages.cache) {
					changedChannel.messages.cache.set(id, message);
				}
				changedChannel._typing = new Map(newChannel._typing);
				newChannel = changedChannel;
				c.channels.cache.set(newChannel.id, newChannel);
				if(guild) { guild.channels.add(newChannel); }
			}
			return { old:oldChannel, updated:newChannel };
		} else {
			let channel = c.channels.add(data, guild, false);
			return { old:null, updated:channel };
		}
	}
	client.actions.GuildDelete.handle = function(data) {
		let c = this.client;
		let guild = c.guilds.cache.get(data.id) || c.guilds.add({id:data.id,shardID:data.shardID}, false);
		for(let channel of guild.channels.cache.values()) {
			if(channel.type === "text") {
				channel.stopTyping(true);
			}
		}
		if(data.unavailable) {
			guild.available = false;
			c.emit(Constants.Events.GUILD_UNAVAILABLE, guild);
			return { guild: null }
		}
		for(let channel of guild.channels.cache.values()) {
			c.client.channels.remove(channel.id);
		}
		if(guild.voice && guild.voice.connection) {
			guild.voice.connection.disconnect();
		}
		c.guilds.cache.delete(guild.id);
		guild.deleted = true;
		this.deleted.set(guild.id, guild);
		this.scheduleForDeletion(guild.id);
		return { guild };
	}
	client.actions.GuildUpdate.handle = function(data) {
		let c = this.client;
		let guild = c.guilds.cache.get(data.id);
		let old = null;
		if(guild) {
			old = guild._update(data);
		} else {
			guild = c.guilds.add(data, false);
		}
		return { old, updated:guild };
	}
	client.actions.GuildEmojisUpdate.handle = function(data) {
		let c = this.client;
		let guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({id:data.guild_id,shardID:data.shardID}, false);
		if(guild.emojis.cache.size) {
			let deletions = new Map(guild.emojis.cache);
			for(let emoji of data.emojis) {
				let cached = guild.emojis.cache.get(emoji.id);
				if(cached) {
					deletions.delete(emoji.id);
					if(!cached.equal(emoji)) {
						let result = c.actions.GuildEmojiUpdate.handle(cached,emoji);
						c.emit(Constants.Events.GUILD_EMOJI_UPDATE, result.old, result.emoji);
					}
				} else {
					let result = c.actions.GuildEmojiCreate.handle(guild,emoji);
					c.emit(Constants.Events.GUILD_EMOJI_CREATE, result.emoji);
				}
			}
			for(let deleted of deletions.values()) {
				let result = c.actions.GuildEmojiDelete.handle(deleted);
				c.emit(Constants.Events.GUILD_EMOJI_DELETE, result.emoji);
			}
		} else {
			let emojis = new Discord.Collection();
			for(let emoji of data.emojis) {
				emojis.set(emoji.id, guild.emojis.add(emoji, false));
			}
			c.emit("guildEmojisUpdate", emojis);
		}
	}
	client.actions.GuildEmojiCreate.handle = function(guild,emoji) {
		let c = this.client;
		let created = guild.emojis.add(emoji);
		return { emoji: created };
	}
	client.actions.GuildEmojiUpdate.handle = function(current,data) {
		let c = this.client;
		let old = current._update(data);
		return { old, emoji: current };
	}
	client.actions.GuildEmojiDelete.handle = function(emoji) {
		let c = this.client;
		emoji.guild.emojis.cache.delete(emoji.id);
		emoji.deleted = true;
		return { emoji };
	}
	client.actions.GuildIntegrationsUpdate.handle = function(data) {
		let c = this.client;
		let guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({id:data.guild_id,shardID:data.shardID}, false);
		c.emit(Constants.Events.GUILD_INTEGRATIONS_UPDATE, guild);
	}
	client.actions.GuildMemberRemove.handle = function(data,shard) {
		let c = this.client;
		let guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({id:data.guild_id,shardID:shard.id}, false);
		let member = guild.members.cache.get(data.user.id) || guild.members.add(data, false);
		member.deleted = true;
		guild.members.cache.delete(data.user.id);
		guild.voiceStates.cache.delete(data.user.id);
		if(guild.memberCount) { guild.memberCount--; }
		return { guild, member };
	}
	client.actions.GuildRoleCreate.handle = function(data) {
		let c = this.client;
		let guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({id:data.guild_id,shardID:data.shardID}, false);
		let role = guild.roles.add(data.role, Boolean(guild.roles.cache.size));
		return { role };
	}
	client.actions.GuildRoleDelete.handle = function(data) {
		let c = this.client;
		let guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({id:data.guild_id,shardID:data.shardID}, false);
		let role = guild.roles.cache.get(data.role_id) || guild.roles.add({id:data.role_id}, false);
		guild.roles.cache.delete(data.role_id);
		role.deleted = true;
		return { role };
	}
	client.actions.GuildRoleUpdate.handle = function(data) {
		let c = this.client;
		let guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({id:data.guild_id,shardID:data.shardID}, false);
		let role = guild.roles.cache.get(data.role.id);
		let old = null;
		if(role) {
			old = role._update(data.role);
		} else {
			role = guild.roles.add(data.role, guild.roles.cache.size);
		}
		return { old, updated: role };
	}
	client.actions.InviteCreate.handle = function(data) {
		let c = this.client;
		let guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({id:data.guild_id,shardID:data.shardID}, false);
		let channel = c.channels.cache.get(data.channel_id) || c.channels.add({id:data.channel_id,type:guild?0:1}, guild, false);
		let inviter = data.inviter ? c.users.cache.get(data.inviter.id) || c.users.add(data.inviter, false) : null;
		let target = data.target_user ? c.users.cache.get(data.target_user.id) || c.client.users.add(data.target_user, false) : null;
		data.inviter = null;
		data.target_user = null;
		let invite = new Invite(c, Object.assign(data, { channel, guild }));
		invite.inviter = inviter;
		invite.targetUser = target;
		return { invite };
	}
	client.actions.InviteDelete.handle = function(data) {
		let c = this.client;
		let guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({id:data.guild_id,shardID:data.shardID}, false);
		let channel = c.channels.cache.get(data.channel_id) || c.channels.add({id:data.channel_id,type:guild?0:1}, guild, false);
		let invite = new Invite(c, Object.assign(data, { channel, guild }));
		return { invite };
	}
	client.actions.MessageCreate.handle = function(data) {
		let c = this.client;
		let guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({id:data.guild_id,shardID:data.shardID}, false) : undefined;
		let channel = c.channels.cache.get(data.channel_id) || c.channels.add({id:data.channel_id,type:guild?0:1}, guild, false);
		let message = channel.messages.cache.get(data.id) || channel.messages.add(data, false);
		channel.lastMessageID = data.id;
		if(message.author) {
			message.author.lastMessageID = data.id;
			message.author.lastMessageChannelID = channel.id;
		}
		if(message.member) {
			message.member.lastMessageID = data.id;
			message.member.lastMessageChannelID = channel.id;
		}
		return { message };
	}
	client.actions.MessageDelete.handle = function(data) {
		let c = this.client;
		let guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({id:data.guild_id,shardID:data.shardID}, false) : undefined;
		let channel = c.channels.cache.get(data.channel_id) || c.channels.add({id:data.channel_id,type:guild?0:1}, guild, false);
		let message = channel.messages.cache.get(data.id);
		if(message) {
			channel.messages.cache.delete(message.id);
		} else {
			message = channel.messages.add(data, false);
			message.system = null;
			message.createdTimestamp = null;
			message.author = null;
		}
		message.deleted = true;
		return { message };
	}
	client.actions.MessageDeleteBulk.handle = function(data) {
		let c = this.client;
		let guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({id:data.guild_id,shardID:data.shardID}, false) : undefined;
		let channel = c.channels.cache.get(data.channel_id) || c.channels.add({id:data.channel_id,type:guild?0:1}, guild, false);
		let deleted = new Collection();
		for(let i = 0; i < data.ids.length; i++) {
			let message;
			if(channel.messages.cache.has(data.ids[i])) {
				message = channel.messages.cache.get(data.ids[i]);
				channel.messages.cache.delete(message.id);
			} else {
				message = channel.messages.add({id:data.ids[i]}, false);
				message.system = null;
				message.createdTimestamp = null;
				message.author = {};
			}
			message.deleted = true;
			deleted.set(data.ids[i], message);
		}
		return { messages: deleted };
	}
	client.actions.MessageUpdate.handle = function(data) {
		let c = this.client;
		let guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({id:data.guild_id,shardID:data.shardID}, false) : undefined;
		let channel = c.channels.cache.get(data.channel_id) || c.channels.add({id:data.channel_id,type:guild?0:1}, guild, false);
		let message = channel.messages.cache.get(data.id);
		let old = null;
		if(message) {
			message.patch(data);
			old = message._edits[0];
			if(message._edits.length > 1) { message._edits.length = 1; }
		} else {
			message = channel.messages.add(data, false);
		}
		return { old, updated: message };
	}
	client.actions.MessageReactionAdd.handle = function(data) {
		let c = this.client;
		let guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({id:data.guild_id,shardID:data.shardID}, false) : undefined;
		let channel = c.channels.cache.get(data.channel_id) || c.channels.add({id:data.channel_id,type:guild?0:1}, guild, false);
		let user = c.users.cache.get(data.user_id) || c.users.add((data.member || {}).user || {id:data.user_id}, false);
		let message = channel.messages.cache.get(data.message_id) || channel.messages.add({id:data.message_id}, false);
		let reaction = message.reactions.cache.get(data.emoji.id || data.emoji.name) || message.reactions.add({emoji:data.emoji,count:null,me:null}, channel.messages.cache.has(data.message_id));
		reaction.me = data.user_id === c.user.id;
		if(channel.messages.cache.has(message.id)) {
			reaction.users.cache.set(user.id, user);
			reaction.count = reaction.users.cache.size;
		}
		return { message, reaction, user };
	}
	client.actions.MessageReactionRemove.handle = function(data) {
		let c = this.client;
		let guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({id:data.guild_id,shardID:data.shardID}, false) : undefined;
		let channel = c.channels.cache.get(data.channel_id) || c.channels.add({id:data.channel_id,type:guild?0:1}, guild, false);
		let user = c.users.cache.get(data.user_id) || c.users.add((data.member || {}).user || {id:data.user_id}, false);
		let message = channel.messages.cache.get(data.message_id) || channel.messages.add({id:data.message_id}, false);
		let reaction = message.reactions.cache.get(data.emoji.id || data.emoji.name) || message.reactions.add({emoji:data.emoji,count:null,me:null}, channel.messages.cache.has(data.message_id));
		reaction.me = data.user_id === c.user.id;
		if(channel.messages.cache.has(message.id)) {
			reaction.users.cache.delete(user.id);
			reaction.count = reaction.users.cache.size;
			if(reaction.count === 0) { message.reactions.cache.delete(data.emoji.id || data.emoji.name); }
		}
		return { message, reaction, user };
	}
	client.actions.MessageReactionRemoveAll.handle = function(data) {
		let c = this.client;
		let guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({id:data.guild_id,shardID:data.shardID}, false) : undefined;
		let channel = c.channels.cache.get(data.channel_id) || c.channels.add({id:data.channel_id,type:guild?0:1}, guild, false);
		let message = channel.messages.cache.get(data.message_id) || channel.messages.add({id:data.message_id}, false);
		message.reactions.cache.clear();
		return { message };
	}
	client.actions.MessageReactionRemoveEmoji.handle = function(data) {
		let c = this.client;
		let guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({id:data.guild_id,shardID:data.shardID}, false) : undefined;
		let channel = c.channels.cache.get(data.channel_id) || c.channels.add({id:data.channel_id,type:guild?0:1}, guild, false);
		let message = channel.messages.cache.get(data.message_id) || channel.messages.add({id:data.message_id}, false);
		let reaction = message.reactions.cache.get(data.emoji.id || data.emoji.name) || message.reactions.add({emoji:data.emoji,count:null,me:null}, channel.messages.cache.has(data.message_id));
		message.reactions.cache.delete(data.emoji.id || data.emoji.name);
		return { reaction };
	}
	client.actions.PresenceUpdate.handle = function(data) {
		let c = this.client;
		let guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({id:data.guild_id,shardID:data.shardID}, false);
		let presence = guild.presences.cache.get(data.user.id);
		let old = null;
		if(presence || c.options.cachePresences || c.users.cache.has(data.user.id)) {
			if(presence) {
				old = presence._clone();
				if(c.users.cache.has(data.user.id) && !c.users.cache.get(data.user.id).equals(data.user)) {
					c.actions.UserUpdate.handle(data.user);
				}
			}
			presence = guild.presences.add(Object.assign(data,{guild}));
		}
		if(c.listenerCount(Constants.Events.PRESENCE_UPDATE)) {
			if(!presence) { presence = guild.presences.add(Object.assign(data,{guild}), false); }
			c.emit(Constants.Events.PRESENCE_UPDATE, old, presence);
		}
	}
	client.actions.UserUpdate.handle = function(data) {
		let c = this.client;
		let user = c.users.cache.get(data.id);
		let old = null;
		if(user) {
			old = user._update(data);
		} else {
			user = c.users.add(data, false);
		}
		return { old, updated: user }
	}
	client.actions.VoiceStateUpdate.handle = function(data) {
		let c = this.client;
		let guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({id:data.guild_id,shardID:data.shardID}, false);
		let oldState = guild.voiceStates.cache.has(data.user_id) ? guild.voiceStates.cache.get(data.user_id)._clone() : null;
		let newState = data.channel_id ? guild.voiceStates.add(data) : null;
		if(oldState && !newState) { guild.voiceStates.cache.delete(data.user_id); }
		if(c.users.cache.has(data.user_id) && data.member) { guild.members.add(data.member); }
		if(oldState || newState) { c.emit(Constants.Events.VOICE_STATE_UPDATE, oldState, newState); }
		if(data.user_id === c.user.id) {
			c.emit('debug', `[VOICE] received voice state update: ${JSON.stringify(data)}`);
			c.voice.onVoiceStateUpdate(data);
		}
	}
	client.actions.WebhooksUpdate.handle = function(data) {
		let c = this.client;
		let guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({id:data.guild_id,shardID:data.shardID}, false);
		let channel = c.channels.cache.get(data.channel_id) || c.channels.add({id:data.channel_id,type:guild?0:1}, guild, false);
		c.emit(Constants.Events.WEBHOOKS_UPDATE, channel);
	}
}