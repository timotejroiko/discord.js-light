"use strict";

const PacketHandlers = require("./handlers.js");
const { Constants, Collection, Channel, DMChannel, Invite, GuildBan, Structures } = require("discord.js");

module.exports = client => {
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
			if(guild && newChannel.permissionOverwrites && (!c.options.cacheOverwrites && !newChannel.permissionOverwrites.size)) { data.permission_overwrites = []; }
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
	client.actions.GuildBanAdd.handle = function(data) {
		const guild = client.guilds.cache.get(data.guild_id) || client.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false);
		client.emit(Constants.Events.GUILD_BAN_ADD, guild.bans.add(data));
	};
	client.actions.GuildBanRemove.handle = function(data) {
		const guild = client.guilds.cache.get(data.guild_id) || client.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false);
		const ban = guild.bans.cache.get(data.user.id) ?? new GuildBan(client, data, guild);
		guild.bans.cache.delete(ban.user.id);
		client.emit(Constants.Events.GUILD_BAN_REMOVE, ban);
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
		c.voice.adapters.get(data.id)?.destroy();
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
				if(c.options.cacheMembers) {
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
		const role = guild.roles.cache.get(data.role_id) || guild.roles.add({
			id: data.role_id,
			permissions: 0
		}, false);
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
		if(!channel) { return; }
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
		if(!channel) { return; }
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
		const user = data.user || c.users.cache.get(data.user_id) || (data.member && data.member.user ? c.users.add(data.member.user, c.options.cacheMembers) : c.users.add({ id: data.user_id }, false));
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
		if(data.user.username && (c.options.cacheMembers || c.users.cache.has(data.user.id))) {
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
			if(!old || !presence.equals(old)) {
				c.emit(Constants.Events.PRESENCE_UPDATE, old, presence);
			}
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
			user = data.member && data.member.user ? client.users.add(data.member.user, client.options.cacheMembers) : client.users.add({ id: data.user_id }, false);
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
			user = c.users.add(data, c.options.cacheMembers);
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
				user = client.users.add(data.member.user, c.options.cacheMembers);
			} else {
				user = client.users.add({ id: data.user_id }, false);
			}
		}
		const oldState = guild.voiceStates.cache.has(data.user_id) ? guild.voiceStates.cache.get(data.user_id)._clone() : null;
		const newState = data.channel_id ? guild.voiceStates.add(data) : null;
		if(oldState && !newState) { guild.voiceStates.cache.delete(data.user_id); }
		if((c.options.cacheMembers || c.users.cache.has(data.user_id)) && data.member) { guild.members.add(data.member); }
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
	client.actions.StageInstanceCreate.handle = function(data) {
		const c = this.client;
		const guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false);
		const channel = c.channels.cache.get(data.channel_id) || c.channels.add({
			id: data.channel_id,
			type: guild ? 0 : 1
		}, guild, false);
		const stageInstance = channel.guild.stageInstances.add(data);
		client.emit(Constants.Events.STAGE_INSTANCE_CREATE, stageInstance);
		return { stageInstance };
	};
	client.actions.StageInstanceDelete.handle = function(data) {
		const c = this.client;
		const guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false);
		const channel = c.channels.cache.get(data.channel_id) || c.channels.add({
			id: data.channel_id,
			type: guild ? 0 : 1
		}, guild, false);
		const stageInstance = channel.guild.stageInstances.add(data);
		if(stageInstance) {
			channel.guild.stageInstances.cache.delete(stageInstance.id);
			stageInstance.deleted = true;
		}
		client.emit(Constants.Events.STAGE_INSTANCE_DELETE, stageInstance);
		return { stageInstance };
	};
	client.actions.StageInstanceUpdate.handle = function(data) {
		const c = this.client;
		const guild = c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false);
		const channel = c.channels.cache.get(data.channel_id) || c.channels.add({
			id: data.channel_id,
			type: guild ? 0 : 1
		}, guild, false);
		const oldStageInstance = channel.guild.stageInstances.cache.get(data.id)?._clone() ?? null;
		const newStageInstance = channel.guild.stageInstances.add(data);
		client.emit(Constants.Events.STAGE_INSTANCE_UPDATE, oldStageInstance, newStageInstance);
		return {
			oldStageInstance,
			newStageInstance
		};
	};
	client.actions.InteractionCreate.handle = function(data) {
		let InteractionType;
		switch(data.type) {
			case Constants.InteractionTypes.APPLICATION_COMMAND: {
				InteractionType = Structures.get("CommandInteraction");
				break;
			}
			case Constants.InteractionTypes.MESSAGE_COMPONENT: {
				switch(data.data.component_type) {
					case Constants.MessageComponentTypes.BUTTON: {
						InteractionType = Structures.get("ButtonInteraction");
						break;
					}
					case Constants.MessageComponentTypes.SELECT_MENU:
						InteractionType = Structures.get("SelectMenuInteraction");
						break;
					default: {
						client.emit(Constants.Events.DEBUG, `[INTERACTION] Received component interaction with unknown type: ${data.data.component_type}`);
						return;
					}
				}
				break;
			}
			default: {
				client.emit(Constants.Events.DEBUG, `[INTERACTION] Received interaction with unknown type: ${data.type}`);
				return;
			}
		}
		client.emit(Constants.Events.INTERACTION_CREATE, new InteractionType(client, data));
	};
	client.actions.ThreadCreate.handle = function(data) {
		const guild = client.guilds.cache.get(data.guild_id) || client.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false);
		const thread = client.channels.add(data, guild, client.options.cacheChannels || client.channels.cache.has(data.id));
		client.emit(Constants.Events.THREAD_CREATE, thread);
		return { thread };
	};
	client.actions.ThreadDelete.handle = function(data) {
		let channel = client.channels.cache.get(data.id);
		if(channel) {
			for(const message of channel.messages.cache.values()) {
				message.deleted = true;
			}
			client.channels.remove(channel.id);
			channel.deleted = true;
		} else {
			const guild = client.guilds.cache.get(data.guild_id) || client.guilds.add({
				id: data.guild_id,
				shardID: data.shardID
			}, false);
			data.thread_metadata = { archive_timestamp: 0 };
			channel = client.channels.add(data, guild, false);
		}
		client.emit(Constants.Events.THREAD_DELETE, channel);
		return { channel };
	};
	client.actions.ThreadListSync.handle = function(data) {
		const c = this.client;
		const guild = data.guild_id ? c.guilds.cache.get(data.guild_id) || c.guilds.add({
			id: data.guild_id,
			shardID: data.shardID
		}, false) : void 0;
		if (data.channel_ids) {
			for (const id of data.channel_ids) {
				const channel = client.channels.resolve(id);
				if (channel) {this.removeStale(channel);}
			}
		} else {
			for (const channel of guild.channels.cache.values()) {
				this.removeStale(channel);
			}
		}
		const syncedThreads = data.threads.reduce((coll, rawThread) => {
			const thread = client.channels.add(rawThread, null, c.options.cacheChannels || c.channels.cache.has(data.id));
			return coll.set(thread.id, thread);
		}, new Collection());
		for (const rawMember of Object.values(data.members)) {
			const thread = client.channels.cache.get(rawMember.id) || syncedThreads.get(rawMember.id);
			if (thread) {
				thread.members._add(rawMember);
			}
		}
		client.emit(Constants.Events.THREAD_LIST_SYNC, syncedThreads);
		return { syncedThreads };
	};
	client.actions.ThreadMemberUpdate.handle = function(data) {
		let thread = client.channels.cache.get(data.id);
		let old = null;
		let member = null;
		if (thread) {
			member = thread.members.cache.get(data.user_id);
			if (member) {
				old = member._update(data);
			} else {
				member = thread.members._add(data);
			}
		} else {
			const guild = client.guilds.add({
				id: 0,
				shardID: data.shardID
			}, false);
			thread = client.channels.add({
				id: data.id,
				type: 11,
				thread_metadata: { archive_timestamp: 0 }
			}, guild, false);
			member = thread.members._add(data);
		}
		client.emit(Constants.Events.THREAD_MEMBER_UPDATE, old, member);
		return {};
	};
	client.actions.ThreadMembersUpdate.handle = function(data) {
		let thread = client.channels.cache.get(data.id);
		let old = null;
		if (thread) {
			old = thread.members.cache.clone();
			thread.memberCount = data.member_count;
			data.added_members?.forEach(rawMember => {
				thread.members._add(rawMember);
			});
			data.removed_member_ids?.forEach(memberId => {
				thread.members.cache.delete(memberId);
			});
		} else {
			const guild = client.guilds.cache.get(data.guild_id) || client.guilds.add({
				id: data.guild_id,
				shardID: data.shardID
			}, false);
			thread = client.channels.add({
				id: data.id,
				type: 11,
				thread_metadata: { archive_timestamp: 0 }
			}, guild, false);
			data.added_members?.forEach(rawMember => {
				thread.members._add(rawMember);
			});
		}
		client.emit(Constants.Events.THREAD_MEMBERS_UPDATE, old, thread.members.cache, data);
		return {};
	};
};
