"use strict";

const PacketHandlers = require("./handlers.js");
const { Constants, Collection, Channel, DMChannel, Invite } = require("discord.js");

module.exports = client => {
	if(client.voice) {
		client.voice.onVoiceStateUpdate = function({ guild_id, session_id, channel_id, shardID }) {
			const connection = this.connections.get(guild_id);
			this.client.emit("debug", `[VOICE] connection? ${Boolean(connection)}, ${guild_id} ${session_id} ${channel_id}`);
			if(!connection) { return; }
			if(!channel_id) {
				connection._disconnect();
				this.connections.delete(guild_id);
				return;
			}
			const guild = this.client.guilds.cache.get(guild_id) || this.client.guilds.add({
				id: guild_id,
				shardID
			}, false);
			connection._channel = this.client.channels.cache.get(channel_id) || this.client.channels.add({
				id: channel_id,
				type: 2
			}, guild, false);
			connection.setSessionID(session_id);
		};
	}
	for(const event of client.options.disabledEvents) { delete PacketHandlers[event]; }
	client.ws.handlePacket = function(packet, shard) {
		if(packet && PacketHandlers[packet.t]) {
			shard.lastPacket = Date.now();
			if(packet.d && packet.d.guild_id) {
				const g = this.client.guilds.cache.get(packet.d.guild_id);
				if(g && typeof g.shardID === "undefined") {
					g.shardID = shard.id;
				}
			}
			PacketHandlers[packet.t](this.client, packet, shard);
		}
		return true;
	};
	client.ws.checkShardsReady = function() {
		if(this.status === Constants.Status.READY) { return; }
		if(this.shards.size !== this.totalShards || this.shards.some(s => s.status !== Constants.Status.READY)) {
			return;
		}
		this.triggerClientReady();
	};
	client.actions.ChannelCreate.handle = function(data) {
		const c = this.client;
		const guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false) : void 0;
		const channel = c.channels.add(data, guild, c.options.cacheChannels || c.channels.cache.has(data.id));
		return { channel };
	};
	client.actions.ChannelDelete.handle = function(data) {
		const c = this.client;
		const guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false) : void 0;
		let channel = c.channels.cache.get(data.id);
		if(channel) {
			if(channel.messages && !(channel instanceof DMChannel)) {
				for(const message of channel.messages.cache.values()) {
					message.deleted = true;
				}
			}
			c.channels.remove(channel.id);
			channel.deleted = true;
		} else {
			channel = c.channels.add(data, guild, false);
		}
		return { channel };
	};
	client.actions.ChannelUpdate.handle = function(data) {
		const c = this.client;
		const guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false) : void 0;
		if(c.channels.cache.has(data.id)) {
			let newChannel = c.channels.cache.get(data.id);
			if(guild && (!c.options.cacheOverwrites && !newChannel.permissionOverwrites.size)) { data.permission_overwrites = []; }
			const oldChannel = newChannel._update(data);
			if(Constants.ChannelTypes[oldChannel.type.toUpperCase()] !== data.type) {
				const changedChannel = Channel.create(c, data, guild);
				for(const [id, message] of newChannel.messages.cache) {
					changedChannel.messages.cache.set(id, message);
				}
				changedChannel._typing = new Map(newChannel._typing);
				newChannel = changedChannel;
				c.channels.cache.set(newChannel.id, newChannel);
				if(guild) { guild.channels.add(newChannel); }
			}
			return {
				old: oldChannel,
				updated: newChannel
			};
		}
		const channel = c.channels.add(data, guild, c.options.cacheChannels);
		return {
			old: null,
			updated: channel
		};
	};
	client.actions.GuildDelete.handle = function(data) {
		const c = this.client;
		const guild = c.guilds.cache.get(data.id) || c.guilds.add({
			id: data.id,
			shardID: data.shardID
		}, false);
		for(const channel of guild.channels.cache.values()) {
			if(channel.type === "text") {
				channel.stopTyping(true);
			}
		}
		if(data.unavailable) {
			guild.available = false;
			c.emit(Constants.Events.GUILD_UNAVAILABLE, guild);
			return { guild: null };
		}
		for(const channel of guild.channels.cache.values()) {
			c.channels.remove(channel.id);
		}
		guild.voiceStates.cache.get(c.user.id)?.connection?.disconnect()
		c.guilds.cache.delete(guild.id);
		guild.deleted = true;
		this.deleted.set(guild.id, guild);
		this.scheduleForDeletion(guild.id);
		return { guild };
	};
	client.actions.GuildUpdate.handle = function(data) {
		const c = this.client;
		let guild = c.guilds.cache.get(data.id);
		let old = null;
		if(guild) {
			old = guild._update(data);
		} else {
			guild = c.guilds.add(data, c.options.cacheGuilds);
		}
		return {
			old,
			updated: guild
		};
	};
	client.actions.GuildEmojisUpdate.handle = function(data) {
		const c = this.client;
		const guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false);
		if(guild.emojis.cache.size || client.options.cacheEmojis) {
			const deletions = new Map(guild.emojis.cache);
			for(const emoji of data.emojis) {
				const cached = guild.emojis.cache.get(emoji.id);
				if(cached) {
					deletions.delete(emoji.id);
					if(!cached.equals(emoji)) {
						const result = c.actions.GuildEmojiUpdate.handle(cached, emoji);
						c.emit(Constants.Events.GUILD_EMOJI_UPDATE, result.old, result.emoji);
					}
				} else {
					const result = c.actions.GuildEmojiCreate.handle(guild, emoji);
					c.emit(Constants.Events.GUILD_EMOJI_CREATE, result.emoji);
				}
			}
			for(const deleted of deletions.values()) {
				const result = c.actions.GuildEmojiDelete.handle(deleted);
				c.emit(Constants.Events.GUILD_EMOJI_DELETE, result.emoji);
			}
		} else {
			const emojis = new Collection();
			for(const emoji of data.emojis) {
				emojis.set(emoji.id, guild.emojis.add(emoji, false));
			}
			c.emit("guildEmojisUpdate", emojis);
		}
	};
	client.actions.GuildEmojiCreate.handle = function(guild, emoji) {
		const c = this.client;
		const created = guild.emojis.add(emoji, guild.emojis.cache.size || c.options.cacheEmojis);
		return { emoji: created };
	};
	client.actions.GuildEmojiUpdate.handle = function(current, data) {
		const old = current._update(data);
		return {
			old,
			emoji: current
		};
	};
	client.actions.GuildEmojiDelete.handle = function(emoji) {
		emoji.guild.emojis.cache.delete(emoji.id);
		emoji.deleted = true;
		return { emoji };
	};
	client.actions.GuildIntegrationsUpdate.handle = function(data) {
		const c = this.client;
		const guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false);
		c.emit(Constants.Events.GUILD_INTEGRATIONS_UPDATE, guild);
	};
	client.actions.GuildMemberRemove.handle = function(data, shard) {
		const c = this.client;
		const guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: shard.id
		}, false);
		const member = guild.members.cache.get(data.user.id) || guild.members.add(data, false);
		member.deleted = true;
		guild.members.cache.delete(data.user.id);
		guild.voiceStates.cache.delete(data.user.id);
		if(guild.memberCount) { guild.memberCount--; }
		return {
			guild,
			member
		};
	};
	client.actions.GuildMemberUpdate.handle = function(data, shard) {
		const c = this.client;
		if(data.user.username) {
			const user = c.users.cache.get(data.user.id);
			if(!user) {
				if(c.options.fetchAllMembers) {
					c.users.add(data.user);
				}
			} else if(!user.equals(data.user)) {
				const { old, updated } = c.actions.UserUpdate.handle(data.user);
				c.emit(Constants.Events.USER_UPDATE, old, updated);
			}
		}
		const guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: shard.id
		}, false);
		let member = guild.members.cache.get(data.user.id);
		if(member) {
			const old = member._update(data);
			if(!member.equals(old)) {
				c.emit(Constants.Events.GUILD_MEMBER_UPDATE, old, member);
			}
		} else {
			member = guild.members.add(data, c.users.cache.has(data.user.id));
			c.emit(Constants.Events.GUILD_MEMBER_UPDATE, null, member);
		}
	};
	client.actions.GuildRoleCreate.handle = function(data) {
		const c = this.client;
		const guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false);
		const role = guild.roles.add(data.role, c.options.cacheRoles || guild.roles.cache.size);
		return { role };
	};
	client.actions.GuildRoleDelete.handle = function(data) {
		const c = this.client;
		const guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false);
		const role = guild.roles.cache.get(data.role_id) || guild.roles.add({ id: data.role_id }, false);
		guild.roles.cache.delete(data.role_id);
		role.deleted = true;
		return { role };
	};
	client.actions.GuildRoleUpdate.handle = function(data) {
		const c = this.client;
		const guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false);
		let role = guild.roles.cache.get(data.role.id);
		let old = null;
		if(role) {
			old = role._update(data.role);
		} else {
			role = guild.roles.add(data.role, c.options.cacheRoles || guild.roles.cache.size);
		}
		return {
			old,
			updated: role
		};
	};
	client.actions.InviteCreate.handle = function(data) {
		const c = this.client;
		const guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false);
		const channel = c.channels.cache.get(data.channel_id) || c.channels.add({
			id: data.channel_id,
			type: guild ? 0 : 1
		}, guild, false);
		const invite = new Invite(c, Object.assign(data, {
			channel,
			guild
		}));
		return { invite };
	};
	client.actions.InviteDelete.handle = function(data) {
		const c = this.client;
		const guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false);
		const channel = c.channels.cache.get(data.channel_id) || c.channels.add({
			id: data.channel_id,
			type: guild ? 0 : 1
		}, guild, false);
		const invite = new Invite(c, Object.assign(data, {
			channel,
			guild
		}));
		return { invite };
	};
	client.actions.MessageCreate.handle = function(data) {
		const c = this.client;
		const guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false) : void 0;
		const channel = c.channels.cache.get(data.channel_id) || c.channels.add({
			id: data.channel_id,
			type: guild ? 0 : 1
		}, guild, false);
		const message = channel.messages.add(data, c.channels.cache.has(channel.id));
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
	};
	client.actions.MessageDelete.handle = function(data) {
		const c = this.client;
		const guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false) : void 0;
		const channel = c.channels.cache.get(data.channel_id) || c.channels.add({
			id: data.channel_id,
			type: guild ? 0 : 1
		}, guild, false);
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
	};
	client.actions.MessageDeleteBulk.handle = function(data) {
		const c = this.client;
		const guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false) : void 0;
		const channel = c.channels.cache.get(data.channel_id) || c.channels.add({
			id: data.channel_id,
			type: guild ? 0 : 1
		}, guild, false);
		const deleted = new Collection();
		for(let i = 0; i < data.ids.length; i++) {
			let message;
			if(channel.messages.cache.has(data.ids[i])) {
				message = channel.messages.cache.get(data.ids[i]);
				channel.messages.cache.delete(message.id);
			} else {
				message = channel.messages.add({ id: data.ids[i] }, false);
				message.system = null;
				message.createdTimestamp = null;
				message.author = {};
			}
			message.deleted = true;
			deleted.set(data.ids[i], message);
		}
		return { messages: deleted };
	};
	client.actions.MessageUpdate.handle = function(data) {
		const c = this.client;
		const guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false) : void 0;
		const channel = c.channels.cache.get(data.channel_id) || c.channels.add({
			id: data.channel_id,
			type: guild ? 0 : 1
		}, guild, false);
		let message = channel.messages.cache.get(data.id);
		let old = null;
		if(message) {
			old = message.patch(data);
		} else {
			message = channel.messages.add(data, false);
		}
		return {
			old,
			updated: message
		};
	};
	client.actions.MessageReactionAdd.handle = function(data) {
		const c = this.client;
		let channel = data.channel;
		if(!channel) {
			const guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({
				id: data.guild_id,
				shardID: data.shardID
			}, false) : void 0;
			channel = c.channels.cache.get(data.channel_id) || c.channels.add({
				id: data.channel_id,
				type: guild ? 0 : 1
			}, guild, false);
		}
		const user = data.user || c.users.cache.get(data.user_id) || (data.member && data.member.user ? c.users.add(data.member.user, c.options.fetchAllMembers) : c.users.add({ id: data.user_id }, false));
		const message = data.message || channel.messages.cache.get(data.message_id) || channel.messages.add({ id: data.message_id }, false);
		const reaction = message.reactions.cache.get(data.emoji.id || data.emoji.name) || message.reactions.add({
			emoji: data.emoji,
			count: null,
			me: null
		}, channel.messages.cache.has(data.message_id));
		reaction.me = data.user_id === c.user.id;
		if(channel.messages.cache.has(message.id)) {
			reaction.users.cache.set(user.id, user);
			reaction.count = reaction.users.cache.size;
		}
		return {
			message,
			reaction,
			user
		};
	};
	client.actions.MessageReactionRemove.handle = function(data) {
		const c = this.client;
		const guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false) : void 0;
		const channel = c.channels.cache.get(data.channel_id) || c.channels.add({
			id: data.channel_id,
			type: guild ? 0 : 1
		}, guild, false);
		const user = c.users.cache.get(data.user_id) || c.users.add({ id: data.user_id }, false);
		const message = channel.messages.cache.get(data.message_id) || channel.messages.add({ id: data.message_id }, false);
		const reaction = message.reactions.cache.get(data.emoji.id || data.emoji.name) || message.reactions.add({
			emoji: data.emoji,
			count: null,
			me: null
		}, channel.messages.cache.has(data.message_id));
		reaction.me = data.user_id === c.user.id;
		if(channel.messages.cache.has(message.id)) {
			reaction.users.cache.delete(user.id);
			reaction.count = reaction.users.cache.size;
			if(reaction.count === 0) { message.reactions.cache.delete(data.emoji.id || data.emoji.name); }
		}
		return {
			message,
			reaction,
			user
		};
	};
	client.actions.MessageReactionRemoveAll.handle = function(data) {
		const c = this.client;
		const guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false) : void 0;
		const channel = c.channels.cache.get(data.channel_id) || c.channels.add({
			id: data.channel_id,
			type: guild ? 0 : 1
		}, guild, false);
		const message = channel.messages.cache.get(data.message_id) || channel.messages.add({ id: data.message_id }, false);
		message.reactions.cache.clear();
		return { message };
	};
	client.actions.MessageReactionRemoveEmoji.handle = function(data) {
		const c = this.client;
		const guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false) : void 0;
		const channel = c.channels.cache.get(data.channel_id) || c.channels.add({
			id: data.channel_id,
			type: guild ? 0 : 1
		}, guild, false);
		const message = channel.messages.cache.get(data.message_id) || channel.messages.add({ id: data.message_id }, false);
		const reaction = message.reactions.cache.get(data.emoji.id || data.emoji.name) || message.reactions.add({
			emoji: data.emoji,
			count: null,
			me: null
		}, channel.messages.cache.has(data.message_id));
		message.reactions.cache.delete(data.emoji.id || data.emoji.name);
		return { reaction };
	};
	client.actions.PresenceUpdate.handle = function(data) {
		const c = this.client;
		const guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false);
		let presence = guild.presences.cache.get(data.user.id);
		let old = null;
		if(data.user.username && (c.options.fetchAllMembers || c.users.cache.has(data.user.id))) {
			const user = c.users.cache.get(data.user.id);
			if(!user || !user.equals(data.user)) {
				c.actions.UserUpdate.handle(data.user);
			}
		}
		if(c.users.cache.has(data.user.id)) {
			guild.members.add(data);
		}
		if(presence || c.options.cachePresences || c.users.cache.has(data.user.id)) {
			if(presence) { old = presence._clone(); }
			presence = guild.presences.add(Object.assign(data, { guild }));
		}
		if(c.listenerCount(Constants.Events.PRESENCE_UPDATE)) {
			if(!presence) { presence = guild.presences.add(Object.assign(data, { guild }), false); }
			c.emit(Constants.Events.PRESENCE_UPDATE, old, presence);
		}
	};
	client.actions.TypingStart.handle = function(data) {
		const guild = data.guild_id ? client.guilds.cache.get(data.guild_id) || client.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false) : void 0;
		const channel = client.channels.cache.get(data.channel_id) || client.channels.add({
			id: data.channel_id,
			type: guild ? 0 : 1
		}, guild, false);
		let user = client.users.cache.get(data.user_id);
		if(user) {
			if(data.member) {
				if(data.member.user && data.member.user.username && !user.equals(data.member.user)) {
					client.actions.UserUpdate.handle(data.member.user);
				}
				const member = guild.members.cache.get(data.user_id);
				if(member) {
					member._update(data.member);
				} else {
					guild.members.add(data.member);
				}
			}
		} else {
			user = data.member && data.member.user ? client.users.add(data.member.user, client.options.fetchAllMembers) : client.users.add({ id: data.user_id }, false);
		}
		const timestamp = new Date(data.timestamp * 1000);
		if(channel._typing.has(user.id)) {
			const typing = channel._typing.get(user.id);
			typing.lastTimestamp = timestamp;
			typing.elapsedTime = Date.now() - typing.since;
			client.clearTimeout(typing.timeout);
			typing.timeout = this.tooLate(channel, user);
		} else {
			channel._typing.set(user.id, {
				user,
				since: new Date(),
				lastTimestamp: new Date(),
				elapsedTime: 0,
				timeout: this.tooLate(channel, user)
			});
		}
		client.emit(Constants.Events.TYPING_START, channel, user);
	};
	client.actions.UserUpdate.handle = function(data) {
		const c = this.client;
		let user = c.users.cache.get(data.id);
		let old = null;
		if(user) {
			old = user._update(data);
		} else {
			user = c.users.add(data, c.options.fetchAllMembers);
		}
		return {
			old,
			updated: user
		};
	};
	client.actions.VoiceStateUpdate.handle = function(data) {
		const c = this.client;
		const guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false);
		let user = c.users.cache.get(data.user_id);
		if(user && data.member) {
			if(data.member.user && data.member.user.username && !user.equals(data.member.user)) {
				c.actions.UserUpdate.handle(data.member.user);
			}
			const member = guild.members.cache.get(data.user_id);
			if(member) {
				member._update(data.member);
			} else {
				guild.members.add(data.member);
			}
		} else if(!user) {
			if(data.member && data.member.user) {
				user = client.users.add(data.member.user, c.options.fetchAllMembers);
			} else {
				user = client.users.add({ id: data.user_id }, false);
			}
		}
		const oldState = guild.voiceStates.cache.has(data.user_id) ? guild.voiceStates.cache.get(data.user_id)._clone() : null;
		const newState = data.channel_id ? guild.voiceStates.add(data) : null;
		if(oldState && !newState) { guild.voiceStates.cache.delete(data.user_id); }
		if((c.options.fetchAllMembers || c.users.cache.has(data.user_id)) && data.member) { guild.members.add(data.member); }
		if(oldState || newState) { c.emit(Constants.Events.VOICE_STATE_UPDATE, oldState, newState); }
		if(data.user_id === c.user.id) {
			c.emit("debug", `[VOICE] received voice state update: ${JSON.stringify(data)}`);
			c.voice.onVoiceStateUpdate(data);
		}
	};
	client.actions.WebhooksUpdate.handle = function(data) {
		const c = this.client;
		const guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false);
		const channel = c.channels.cache.get(data.channel_id) || c.channels.add({
			id: data.channel_id,
			type: guild ? 0 : 1
		}, guild, false);
		c.emit(Constants.Events.WEBHOOKS_UPDATE, channel);
	};
};
