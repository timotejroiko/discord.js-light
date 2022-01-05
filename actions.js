"use strict";

const {
	Constants,
	Collection,
	Channel,
	DMChannel,
	ButtonInteraction,
	CommandInteraction,
	SelectMenuInteraction,
	UserContextMenuInteraction,
	MessageContextMenuInteraction,
	AutocompleteInteraction,
	Typing,
	LimitedCollection
} = require("discord.js");

const {
	getOrCreateGuild,
	getOrCreateChannel,
	getOrCreateMessage,
	makePartial
} = require("./functions");

module.exports = {

	// called by GuildChannelManager.create()
	ChannelCreate: function(data) {
		const c = this.client;
		const guild = data.guild_id ? getOrCreateGuild(c, data.guild_id, data.shardId) : void 0;
		const channel = c.channels._add(data, guild);
		return { channel };
	},

	ChannelDelete: function(data) {
		const c = this.client;
		const guild = data.guild_id ? getOrCreateGuild(c, data.guild_id, data.shardId) : void 0;
		const channel = c.channels.cache.get(data.id) || c.channels._add(data, guild);
		if(channel.messages?.cache.size && !(channel instanceof DMChannel)) {
			for(const message of channel.messages.cache.values()) { message.deleted = true; }
		}
		channel.deleted = true;
		c.channels._remove(channel.id);
		return { channel };
	},

	// called by GuildChannel.edit(), ThreadChannel.edit()
	ChannelUpdate: function(data) {
		const c = this.client;
		const guild = data.guild_id ? getOrCreateGuild(c, data.guild_id, data.shardId) : void 0;
		let channel = c.channels.cache.get(data.id);
		let old;
		if(channel) {
			old = channel._update(data);
			if(Constants.ChannelTypes[channel.type] !== data.type) {
				const changedChannel = Channel.create(c, data, guild);
				for(const [id, message] of channel.messages.cache) { changedChannel.messages.cache.forceSet(id, message); }
				channel = changedChannel;
				c.channels.cache.set(channel.id, channel);
				channel.guild?.channels.cache.set(channel.id, channel);
			}
		} else {
			channel = c.channels._add(data, guild);
			old = c.channels._add({ id: data.id, type: data.type }, guild, { cache: false, allowUnknownGuild: true });
			makePartial(old);
		}
		return {
			old,
			updated: channel
		};
	},

	GuildBanAdd: function(data) {
		const c = this.client;
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		c.emit(Constants.Events.GUILD_BAN_ADD, guild.bans._add(data));
	},

	GuildBanRemove: function(data) {
		const c = this.client;
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		const ban = guild.bans.cache.get(data.user.id) || guild.bans._add(data);
		guild.bans.cache.delete(ban.user.id);
		c.emit(Constants.Events.GUILD_BAN_REMOVE, ban);
	},

	GuildDelete: function(data) {
		const c = this.client;
		const guild = getOrCreateGuild(c, data.id, data.shardId);
		if(data.unavailable) {
			guild.available = false;
			c.emit(Constants.Events.GUILD_UNAVAILABLE, guild);
			return { guild: null };
		}
		for(const channel of guild.channels.cache.values()) { c.channels._remove(channel.id); }
		c.voice.adapters.get(data.id)?.destroy();
		c.guilds.cache.delete(guild.id);
		guild.deleted = true;
		return { guild };
	},

	GuildUpdate: function(data) {
		const c = this.client;
		let guild = c.guilds.cache.get(data.id);
		let old;
		if(guild) {
			old = guild._update(data);
		} else {
			guild = c.guilds._add(data);
			old = c.guilds._add({ id: data.id, shardId: data.shardId }, false);
			old.partial = true;
		}
		return {
			old,
			updated: guild
		};
	},

	// called by GuildEmojisUpdate, GuildEmojiManager.create()
	GuildEmojiCreate: function(guild, emoji) {
		const created = guild.emojis._add(emoji);
		return { emoji: created };
	},

	// called by GuildEmojisUpdate
	GuildEmojiDelete: function(emoji) {
		emoji.guild.emojis.cache.delete(emoji.id);
		emoji.deleted = true;
		return { emoji };
	},

	// called by GuildEmojisUpdate
	GuildEmojiUpdate: function(current, data) {
		const old = current._update(data);
		return {
			old,
			emoji: current
		};
	},

	// called by Guild._patch()
	GuildEmojisUpdate: function(data) {
		const c = this.client;
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
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
	},

	GuildIntegrationsUpdate: function(data) {
		const c = this.client;
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		c.emit(Constants.Events.GUILD_INTEGRATIONS_UPDATE, guild);
	},

	GuildMemberRemove: function(data) {
		const c = this.client;
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		let member = guild.members.cache.get(data.user.id);
		if(!member) {
			member = guild.members._add({ user: data.user }, false); // has built in partial
		}
		member.deleted = true;
		guild.members.cache.delete(data.user.id);
		guild.voiceStates.cache.delete(data.user.id);
		if(guild.memberCount) { guild.memberCount--; }
		return {
			guild,
			member
		};
	},

	GuildMemberUpdate: function(data) {
		const c = this.client;
		if(data.user.username) {
			const user = c.users.cache.get(data.user.id);
			if(!user) {
				c.users._add(data.user);
			} else if(!user._equals(data.user)) {
				const { old, updated } = c.actions.UserUpdate.handle(data.user);
				c.emit(Constants.Events.USER_UPDATE, old, updated);
			}
		}
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		let member = guild.members.cache.get(data.user.id);
		let old;
		if(member) {
			old = member._update(data);
			if(!member.equals(old)) {
				c.emit(Constants.Events.GUILD_MEMBER_UPDATE, old, member);
			}
		} else {
			member = guild.members._add(data);
			old = guild.members._add({ user: data.user }, false); // has built in partial
			c.emit(Constants.Events.GUILD_MEMBER_UPDATE, old, member);
		}
	},

	// called by RoleManager.create()
	GuildRoleCreate: function(data) {
		const c = this.client;
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		const role = guild.roles._add(data.role);
		return { role };
	},

	// called by Role.delete()
	GuildRoleDelete: function(data) {
		const c = this.client;
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		let role = guild.roles.cache.get(data.role_id);
		if(!role) {
			role = guild.roles._add({ id: data.role_id, permissions: 0 }, false);
			role.partial = true;
		}
		guild.roles.cache.delete(data.role_id);
		role.deleted = true;
		return { role };
	},

	GuildRoleUpdate: function(data) {
		const c = this.client;
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		let role = guild.roles.cache.get(data.role.id);
		let old;
		if(role) {
			old = role._update(data.role);
		} else {
			role = guild.roles._add(data.role);
			old = guild.roles._add({ id: data.role.id, permissions: 0 }, false);
			old.partial = true;
		}
		return {
			old,
			updated: role
		};
	},

	GuildScheduledEventCreate: function(data) {
		const c = this.client;
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		const guildScheduledEvent = guild.scheduledEvents._add(data);
		return { guildScheduledEvent };
	},

	GuildScheduledEventDelete: function(data) {
		const c = this.client;
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		let guildScheduledEvent = guild.scheduledEvents.cache.get(data.id);
		if(guildScheduledEvent) {
			guild.scheduledEvents.cache.delete(guildScheduledEvent.id);
		} else {
			guildScheduledEvent = guild.scheduledEvents._add(data, false);
		}
		guildScheduledEvent.deleted = true;
		return { guildScheduledEvent };
	},

	GuildScheduledEventUpdate: function(data) {
		const c = this.client;
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		const oldGuildScheduledEvent = guild.scheduledEvents.cache.get(data.id)?._clone() ?? guild.scheduledEvents._add(data, false);
		const newGuildScheduledEvent = guild.scheduledEvents._add(data);
		return { oldGuildScheduledEvent, newGuildScheduledEvent };
	},

	GuildScheduledEventUserAdd: function(data) {
		const c = this.client;
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		let guildScheduledEvent = guild.scheduledEvents.cache.get(data.guild_scheduled_event_id);
		if(!guildScheduledEvent) {
			guildScheduledEvent = guild.scheduledEvents._add({ id: data.guild_scheduled_event_id, guild_id: data.guild_id }, false);
			guildScheduledEvent.partial = true;
		}
		let user = c.users.cache.get(data.user_id);
		if(!user) {
			user = c.users._add({ id: data.user_id }, false); // has built in partial
		}
		return { guildScheduledEvent, user };
	},

	GuildScheduledEventUserRemove: function(data) {
		const c = this.client;
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		let guildScheduledEvent = guild.scheduledEvents.cache.get(data.guild_scheduled_event_id);
		if(!guildScheduledEvent) {
			guildScheduledEvent = guild.scheduledEvents._add({ id: data.guild_scheduled_event_id, guild_id: data.guild_id }, false);
			guildScheduledEvent.partial = true;
		}
		let user = c.users.cache.get(data.user_id);
		if(!user) {
			user = c.users._add({ id: data.user_id }, false); // has built in partial
		}
		return { guildScheduledEvent, user };
	},

	// called by GuildStickersUpdate, GuildStickerManager.create()
	GuildStickerCreate: function(guild, createdSticker) {
		const sticker = guild.stickers._add(createdSticker);
		return { sticker };
	},

	// called by GuildStickersUpdate
	GuildStickerDelete: function(sticker) {
		sticker.guild.stickers.cache.delete(sticker.id);
		sticker.deleted = true;
		return { sticker };
	},

	// called by GuildStickersUpdate
	GuildStickerUpdate: function(current, data) {
		const old = current._update(data);
		return { old, sticker: current };
	},

	// called by Guild._patch()
	GuildStickersUpdate: function(data) {
		const c = this.client;
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		const deletions = new Map(guild.stickers.cache);
		for(const sticker of data.stickers) {
			const cached = guild.stickers.cache.get(sticker.id);
			if(cached) {
				deletions.delete(sticker.id);
				if(!cached.equals(sticker)) {
					const result = c.actions.GuildStickerUpdate.handle(cached, sticker);
					this.client.emit(Constants.Events.GUILD_STICKER_UPDATE, result.old, result.sticker);
				}
			} else {
				const result = c.actions.GuildStickerCreate.handle(guild, sticker);
				this.client.emit(Constants.Events.GUILD_STICKER_CREATE, result.sticker);
			}
		}
		for(const deleted of deletions.values()) {
			const result = c.actions.GuildStickerDelete.handle(deleted);
			this.client.emit(Constants.Events.GUILD_STICKER_DELETE, result.sticker);
		}
	},

	InteractionCreate: function(data) {
		const c = this.client;
		let InteractionType;
		switch(data.type) {
			case Constants.InteractionTypes.APPLICATION_COMMAND: {
				switch(data.data.type) {
					case Constants.ApplicationCommandTypes.CHAT_INPUT:
						InteractionType = CommandInteraction;
						break;
					case Constants.ApplicationCommandTypes.USER:
						InteractionType = UserContextMenuInteraction;
					case Constants.ApplicationCommandTypes.MESSAGE:
						InteractionType = MessageContextMenuInteraction;
						break;
					default:
						c.emit(Constants.Events.DEBUG, `[INTERACTION] Received application command interaction with unknown type: ${data.data.type}`);
						return;
				}
				break;
			}
			case Constants.InteractionTypes.MESSAGE_COMPONENT: {
				switch(data.data.component_type) {
					case Constants.MessageComponentTypes.BUTTON: {
						InteractionType = ButtonInteraction;
						break;
					}
					case Constants.MessageComponentTypes.SELECT_MENU:
						InteractionType = SelectMenuInteraction;
						break;
					default: {
						c.emit(Constants.Events.DEBUG, `[INTERACTION] Received component interaction with unknown type: ${data.data.component_type}`);
						return;
					}
				}
				break;
			}
			case Constants.InteractionTypes.APPLICATION_COMMAND_AUTOCOMPLETE: {
				InteractionType = AutocompleteInteraction;
				break;
			}
			default: {
				c.emit(Constants.Events.DEBUG, `[INTERACTION] Received interaction with unknown type: ${data.type}`);
				return;
			}
		}
		c.emit(Constants.Events.INTERACTION_CREATE, new InteractionType(c, data));
	},

	InviteCreate: function(data) {
		const c = this.client;
		if(!data.guild_id) { return; }
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		const channel = getOrCreateChannel(c, data.channel_id, guild);
		const invite = guild.invites._add(Object.assign(data, { channel, guild }));
		return { invite };
	},

	InviteDelete: function(data) {
		const c = this.client;
		if(!data.guild_id) { return; }
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		let invite = guild.invites.cache.get(data.code);
		if(!invite) {
			const channel = getOrCreateChannel(c, data.channel_id, guild);
			invite = guild.invites._add(Object.assign(data, { channel, guild }), false);
			invite.partial = true;
		}
		guild.invites.cache.delete(invite.code);
		return { invite };
	},

	MessageCreate: function(data) {
		const c = this.client;
		const guild = data.guild_id ? getOrCreateGuild(c, data.guild_id, data.shardId) : void 0;
		const channel = getOrCreateChannel(c, data.channel_id, guild);
		channel.lastMessageId = data.id;
		const message = channel.messages._add(data);
		return { message };
	},

	// called by TextBasedChannel.send()
	MessageDelete: function(data) {
		const c = this.client;
		const guild = data.guild_id ? getOrCreateGuild(c, data.guild_id, data.shardId) : void 0;
		const channel = getOrCreateChannel(c, data.channel_id, guild);
		const message = getOrCreateMessage(channel, data.id);
		channel.messages.cache.delete(message.id);
		message.deleted = true;
		return { message };
	},

	MessageDeleteBulk: function(data) {
		const c = this.client;
		const guild = data.guild_id ? getOrCreateGuild(c, data.guild_id, data.shardId) : void 0;
		const channel = getOrCreateChannel(c, data.channel_id, guild);
		const deleted = new Collection();
		for(const id of data.ids) {
			const message = getOrCreateMessage(channel, id);
			channel.messages.cache.delete(message.id);
			message.deleted = true;
			deleted.set(id, message);
		}
		return { messages: deleted };
	},

	MessageUpdate: function(data) {
		const c = this.client;
		const guild = data.guild_id ? getOrCreateGuild(c, data.guild_id, data.shardId) : void 0;
		const channel = getOrCreateChannel(c, data.channel_id, guild);
		let message = channel.messages.cache.get(data.id);
		let old;
		if(message) {
			old = message._update(data);
		} else {
			message = channel.messages._add(data);
			old = channel.messages._add({ id: data.id }, false); // has built in partial
		}
		return {
			old,
			updated: message
		};
	},

	// called by Message.react()
	MessageReactionAdd: function(data) {
		const c = this.client;
		let channel = data.channel;
		if(!channel) {
			const guild = data.guild_id ? getOrCreateGuild(c, data.guild_id, data.shardId) : void 0;
			channel = getOrCreateChannel(c, data.channel_id, guild);
		}
		let user = data.user || c.users.cache.get(data.user_id);
		if(!user) {
			if(data.member?.user) {
				user = c.users._add(data.member.user);
			} else {
				user = c.users._add({ id: data.user_id }, false); // has built in partial
			}
		}
		const message = data.message || getOrCreateMessage(channel, data.message_id);
		const reaction = message.reactions.cache.get(data.emoji.id ?? decodeURIComponent(data.emoji.name)) || message.reactions._add({
			emoji: data.emoji,
			count: message.partial ? null : 0,
			me: user.id === c.user.id
		});
		reaction._add(user);
		return {
			message,
			reaction,
			user
		};
	},

	MessageReactionRemove: function(data) {
		const c = this.client;
		const guild = data.guild_id ? getOrCreateGuild(c, data.guild_id, data.shardId) : void 0;
		const channel = getOrCreateChannel(c, data.channel_id, guild);
		let user = c.users.cache.get(data.user_id);
		if(!user) {
			user = c.users._add({ id: data.user_id }, false); // has built in partial
		}
		const message = getOrCreateMessage(channel, data.message_id);
		let reaction = message.reactions.cache.get(data.emoji.id ?? decodeURIComponent(data.emoji.name));
		if(!reaction) {
			reaction = message.reactions._add({
				emoji: data.emoji,
				count: null,
				me: user.id === c.user.id
			}, false); // built in partial if count is null
		}
		reaction._remove(user);
		return {
			message,
			reaction,
			user
		};
	},

	MessageReactionRemoveAll: function(data) {
		const c = this.client;
		const guild = data.guild_id ? getOrCreateGuild(c, data.guild_id, data.shardId) : void 0;
		const channel = getOrCreateChannel(c, data.channel_id, guild);
		const message = getOrCreateMessage(channel, data.message_id);
		const removed = message.reactions.cache.clone();
		message.reactions.cache.clear();
		return { message, removed };
	},

	MessageReactionRemoveEmoji: function(data) {
		const c = this.client;
		const guild = data.guild_id ? getOrCreateGuild(c, data.guild_id, data.shardId) : void 0;
		const channel = getOrCreateChannel(c, data.channel_id, guild);
		const message = getOrCreateMessage(channel, data.message_id);
		let reaction = message.reactions.cache.get(data.emoji.id ?? decodeURIComponent(data.emoji.name));
		if(!reaction) {
			reaction = message.reactions._add({
				emoji: data.emoji,
				count: null,
				me: null
			}, false); // built in partial if count is null
		}
		if(!message.partial) { message.reactions.cache.delete(reaction.emoji.id ?? reaction.emoji.name); }
		return { reaction };
	},

	PresenceUpdate: function(data) {
		const c = this.client;
		if(data.user.username) {
			const user = c.users.cache.get(data.user.id) || c.users._add(data.user);
			if(!user._equals(data.user)) {
				const { old, updated } = c.actions.UserUpdate.handle(data.user);
				c.emit(Constants.Events.USER_UPDATE, old, updated);
			}
		}
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		let old = guild.presences.cache.get(data.user.id)?._clone();
		if(!old) {
			old = guild.presences._add({ user: { id: data.user.id }, guild }, false);
			old.partial = true;
		}
		const presence = guild.presences._add(Object.assign(data, { guild }));
		if(c.listenerCount(Constants.Events.PRESENCE_UPDATE) && (old.partial || !presence.equals(old))) {
			c.emit(Constants.Events.PRESENCE_UPDATE, old, presence);
		}
		if(!(guild.members.cache instanceof LimitedCollection) && !guild.members.cache.has(data.user.id) && data.status !== "offline") {
			const member = guild.members._add({
				user: data.user,
				deaf: false,
				mute: false
			});
			c.emit(Constants.Events.GUILD_MEMBER_AVAILABLE, member);
		}
	},

	StageInstanceCreate: function(data) {
		const c = this.client;
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		const channel = getOrCreateChannel(c, data.channel_id, guild);
		const stageInstance = channel.guild.stageInstances._add(data);
		c.emit(Constants.Events.STAGE_INSTANCE_CREATE, stageInstance);
		return { stageInstance };
	},

	StageInstanceDelete: function(data) {
		const c = this.client;
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		const channel = getOrCreateChannel(c, data.channel_id, guild);
		const stageInstance = channel.guild.stageInstances._add(data);
		if(stageInstance) {
			channel.guild.stageInstances.cache.delete(stageInstance.id);
			stageInstance.deleted = true;
		}
		c.emit(Constants.Events.STAGE_INSTANCE_DELETE, stageInstance);
		return { stageInstance };
	},

	StageInstanceUpdate: function(data) {
		const c = this.client;
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		const channel = getOrCreateChannel(c, data.channel_id, guild);
		let oldStageInstance = channel.guild.stageInstances.cache.get(data.id)?._clone();
		if(!oldStageInstance) {
			oldStageInstance = channel.guild.stageInstances._add({ id: data.id }, false);
			oldStageInstance.partial = true;
		}
		const newStageInstance = channel.guild.stageInstances._add(data);
		c.emit(Constants.Events.STAGE_INSTANCE_UPDATE, oldStageInstance, newStageInstance);
		return {
			oldStageInstance,
			newStageInstance
		};
	},

	// called by ThreadManager.create()
	ThreadCreate: function(data) {
		const c = this.client;
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		const thread = c.channels._add(data, guild);
		c.emit(Constants.Events.THREAD_CREATE, thread);
		return { thread };
	},

	ThreadDelete: function(data) {
		const c = this.client;
		let channel = c.channels.cache.get(data.id);
		if(!channel) {
			const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
			channel = c.channels._add(data, guild, { cache: false, allowUnknownGuild: true });
			makePartial(channel);
		}
		for(const message of channel.messages.cache.values()) { message.deleted = true; }
		c.channels._remove(channel.id);
		channel.deleted = true;
		c.emit(Constants.Events.THREAD_DELETE, channel);
		return { channel };
	},

	ThreadListSync: function(data) {
		const c = this.client;
		const guild = data.guild_id ? getOrCreateGuild(c, data.guild_id, data.shardId) : void 0;
		if(data.channel_ids) {
			for(const id of data.channel_ids) {
				const channel = c.channels.resolve(id);
				if(channel) { this.removeStale(channel); }
			}
		} else {
			for(const channel of guild.channels.cache.values()) {
				this.removeStale(channel);
			}
		}
		const syncedThreads = data.threads.reduce((coll, rawThread) => {
			const thread = c.channels._add(rawThread);
			return coll.set(thread.id, thread);
		}, new Collection());
		for(const rawMember of Object.values(data.members)) {
			const thread = c.channels.cache.get(rawMember.id) || syncedThreads.get(rawMember.id);
			if(thread) { thread.members._add(rawMember); }
		}
		c.emit(Constants.Events.THREAD_LIST_SYNC, syncedThreads);
		return { syncedThreads };
	},

	ThreadMemberUpdate: function(data) {
		const c = this.client;
		let thread = c.channels.cache.get(data.id);
		if(!thread) {
			const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
			thread = c.channels._add({ id: data.id, type: 11 }, guild, { cache: false, allowUnknownGuild: true });
			makePartial(thread);
		}
		let member = thread.members.cache.get(data.user_id);
		let old;
		if(member) {
			old = member._update(data);
		} else {
			member = thread.members._add(data);
			old = thread.members._add({ user_id: data.user_id }, false);
			old.partial = true;
		}
		c.emit(Constants.Events.THREAD_MEMBER_UPDATE, old, member);
		return {};
	},

	ThreadMembersUpdate: function(data) {
		const c = this.client;
		let thread = c.channels.cache.get(data.id);
		let old;
		if(thread) {
			old = thread.members.cache.clone();
			thread.memberCount = data.member_count;
			data._added_members?.forEach(rawMember => {
				thread.members._add(rawMember);
			});
			data.removed_member_ids?.forEach(memberId => {
				thread.members.cache.delete(memberId);
			});
		} else {
			const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
			thread = c.channels._add({ id: data.id,	type: 11 }, guild, { cache: false, allowUnknownGuild: true });
			data._added_members?.forEach(rawMember => {
				thread.members._add(rawMember);
			});
			old = new thread.members.cache.constructor();
		}
		c.emit(Constants.Events.THREAD_MEMBERS_UPDATE, old, thread.members.cache);
		return {};
	},

	TypingStart: function(data) {
		const c = this.client;
		const guild = data.guild_id ? getOrCreateGuild(c, data.guild_id, data.shardId) : void 0;
		const channel = getOrCreateChannel(c, data.channel_id, guild);
		let user = c.users.cache.get(data.user_id);
		if(!user) {
			if(data.member?.user) {
				user = c.users._add(data.member.user);
			} else {
				user = c.users._add({ id: data.user_id }, false); // has built in partial
			}
		}
		c.emit(Constants.Events.TYPING_START, new Typing(channel, user, data));
	},

	// called by ClientUser.edit()
	UserUpdate: function(data) {
		const c = this.client;
		let user = c.users.cache.get(data.id);
		let old;
		if(user) {
			old = user._update(data);
		} else {
			user = c.users._add(data);
			old = c.users._add({ id: data.id }, false); // has built in partial
		}
		return {
			old,
			updated: user
		};
	},

	VoiceStateUpdate: function(data) {
		const c = this.client;
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		if(data.member?.user) {
			const user = c.users.cache.get(data.user_id) || c.users._add(data.member.user);
			if(data.member.user.username && !user._equals(data.member.user)) {
				const { old, updated } = c.actions.UserUpdate.handle(data.member.user);
				c.emit(Constants.Events.USER_UPDATE, old, updated);
			}
			const member = guild.members.cache.get(data.user_id);
			if(member) {
				member._update(data.member);
			} else {
				guild.members._add(data.member);
			}
		}
		const oldState = guild.voiceStates.cache.get(data.user_id)?._clone() || guild.voiceStates._add({ user_id: data.user_id });
		const newState = guild.voiceStates._add(data);
		c.emit(Constants.Events.VOICE_STATE_UPDATE, oldState, newState);
		if(data.user_id === c.user.id) {
			c.emit("debug", `[VOICE] received voice state update: ${JSON.stringify(data)}`);
			c.voice.onVoiceStateUpdate(data);
		}
	},

	WebhooksUpdate: function(data) {
		const c = this.client;
		const guild = getOrCreateGuild(c, data.guild_id, data.shardId);
		const channel = getOrCreateChannel(c, data.channel_id, guild);
		c.emit(Constants.Events.WEBHOOKS_UPDATE, channel);
	}

};
