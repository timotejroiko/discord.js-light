"use strict";

const path = require("path");
const PacketHandlers = require(path.resolve(require.resolve("discord.js").replace("index.js", "/client/websocket/handlers")));

const {
	ClientUser,
	Constants,
	ClientApplication,
	Collection,
	LimitedCollection
} = require("discord.js");

const {
	getOrCreateGuild,
	getOrCreateChannel
} = require("./functions");

/*
not implemented by djs?
GUILD_APPLICATION_COMMAND_COUNTS_UPDATE
INTEGRATION_CREATE
INTEGRATION_DELETE
INTEGRATION_UPDATE
*/

const handlers = {

	APPLICATION_COMMAND_CREATE: (client, { d: data }, shard) => {
		let command;
		if(data.guild_id) {
			const guild = getOrCreateGuild(client, data.guild_id, shard.id);
			command = guild.commands._add(data);
		} else {
			command = client.application.commands._add(data);
		}
		client.emit(Constants.Events.APPLICATION_COMMAND_CREATE, command);
	},

	APPLICATION_COMMAND_DELETE: (client, { d: data }, shard) => {
		let command;
		if(data.guild_id) {
			const guild = getOrCreateGuild(client, data.guild_id, shard.id);
			command = guild.commands._add(data);
			guild.commands.cache.delete(data.id);
		} else {
			command = client.application.commands._add(data);
			client.application.commands.cache.delete(data.id);
		}
		client.emit(Constants.Events.APPLICATION_COMMAND_DELETE, command);
	},

	APPLICATION_COMMAND_UPDATE: (client, { d: data }, shard) => {
		let oldCommand;
		let newCommand;
		if(data.guild_id) {
			const guild = getOrCreateGuild(client, data.guild_id, shard.id);
			oldCommand = guild.commands.cache.get(data.id)?._clone();
			if(!oldCommand) {
				oldCommand = guild.commands._add({ id: data.id });
				oldCommand.partial = true;
			}
			newCommand = guild.commands._add(data);
		} else {
			oldCommand = client.application.commands.cache.get(data.id)?._clone();
			if(!oldCommand) {
				oldCommand = client.application.commands._add({ id: data.id });
				oldCommand.partial = true;
			}
			newCommand = client.application.commands._add(data);
		}
		client.emit(Constants.Events.APPLICATION_COMMAND_UPDATE, oldCommand, newCommand);
	},

	CHANNEL_CREATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { channel } = client.actions.ChannelCreate.handle(packet.d);
		if(!channel) { return; }
		client.emit(Constants.Events.CHANNEL_CREATE, channel);
	},

	CHANNEL_DELETE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { channel } = client.actions.ChannelDelete.handle(packet.d);
		if(!channel) { return; }
		client.emit(Constants.Events.CHANNEL_DELETE, channel);
	},

	CHANNEL_PINS_UPDATE: (client, { d: data }, shard) => {
		const guild = data.guild_id ? getOrCreateGuild(client, data.guild_id, shard.id) : void 0;
		const channel = getOrCreateChannel(client, data.channel_id, guild);
		const time = data.last_pin_timestamp ? new Date(data.last_pin_timestamp).getTime() : null;
		channel.lastPinTimestamp = time;
		client.emit(Constants.Events.CHANNEL_PINS_UPDATE, channel, time);
	},

	CHANNEL_UPDATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { old, updated } = client.actions.ChannelUpdate.handle(packet.d);
		if(!updated) { return; }
		client.emit(Constants.Events.CHANNEL_UPDATE, old, updated);
	},

	GUILD_BAN_ADD: (client, { d: data }, shard) => {
		data.shardId = shard.id;
		client.actions.GuildBanAdd.handle(data);
	},

	GUILD_BAN_REMOVE: (client, { d: data }, shard) => {
		data.shardId = shard.id;
		client.actions.GuildBanRemove.handle(data);
	},

	GUILD_CREATE: (client, { d: data }, shard) => {
		data.shardId = shard.id;
		let guild = client.guilds.cache.get(data.id);
		if(guild) {
			if(!guild.available && !data.unavailable) {
				guild._patch(data);
			}
		} else {
			guild = client.guilds._add(data);
			if(shard.status === Constants.Status.READY) {
				client.emit(Constants.Events.GUILD_CREATE, guild);
			}
		}
	},

	GUILD_DELETE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { guild } = client.actions.GuildDelete.handle(packet.d);
		if(!guild) { return; }
		client.emit(Constants.Events.GUILD_DELETE, guild);
	},

	GUILD_UPDATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { old, updated } = client.actions.GuildUpdate.handle(packet.d);
		client.emit(Constants.Events.GUILD_UPDATE, old, updated);
	},

	GUILD_EMOJIS_UPDATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const guild = getOrCreateGuild(client, packet.d.guild_id, packet.d.shardId);
		if(guild.emojis.cache instanceof LimitedCollection) {
			const emojis = new Collection();
			for(const emoji of packet.d.emojis) {
				emojis.set(emoji.id, guild.emojis._add(emoji));
			}
			client.emit("guildEmojisUpdate", emojis);
		} else {
			client.actions.GuildEmojisUpdate.handle(packet.d);
		}
	},

	GUILD_INTEGRATIONS_UPDATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		client.actions.GuildIntegrationsUpdate.handle(packet.d);
	},

	GUILD_MEMBERS_CHUNK: (client, { d: data }, shard) => {
		const guild = getOrCreateGuild(client, data.guild_id, shard.id);
		const members = new Collection();
		for(const member of data.members) {
			members.set(member.user.id, guild.members._add(member));
		}
		if(data.presences) {
			for(const presence of data.presences) {
				guild.presences._add(Object.assign(presence, { guild }));
			}
		}
		client.emit(Constants.Events.GUILD_MEMBERS_CHUNK, members, guild, {
			count: data.chunk_count,
			index: data.chunk_index,
			nonce: data.nonce
		});
	},

	GUILD_MEMBER_ADD: (client, { d: data }, shard) => {
		const guild = getOrCreateGuild(client, data.guild_id, shard.id);
		const member = guild.members._add(data);
		if(Number.isInteger(guild.memberCount)) { guild.memberCount++; }
		client.emit(Constants.Events.GUILD_MEMBER_ADD, member);
	},

	GUILD_MEMBER_REMOVE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { member } = client.actions.GuildMemberRemove.handle(packet.d);
		client.emit(Constants.Events.GUILD_MEMBER_REMOVE, member);
	},

	GUILD_MEMBER_UPDATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		client.actions.GuildMemberUpdate.handle(packet.d);
	},

	GUILD_ROLE_CREATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { role } = client.actions.GuildRoleCreate.handle(packet.d);
		client.emit(Constants.Events.GUILD_ROLE_CREATE, role);
	},

	GUILD_ROLE_DELETE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { role } = client.actions.GuildRoleDelete.handle(packet.d);
		client.emit(Constants.Events.GUILD_ROLE_DELETE, role);
	},

	GUILD_ROLE_UPDATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { old, updated } = client.actions.GuildRoleUpdate.handle(packet.d);
		client.emit(Constants.Events.GUILD_ROLE_UPDATE, old, updated);
	},

	GUILD_SCHEDULED_EVENT_CREATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { guildScheduledEvent } = client.actions.GuildScheduledEventCreate.handle(packet.d);
		client.emit(Constants.Events.GUILD_SCHEDULED_EVENT_CREATE, guildScheduledEvent);
	},

	GUILD_SCHEDULED_EVENT_DELETE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { guildScheduledEvent } = client.actions.GuildScheduledEventDelete.handle(packet.d);
		client.emit(Constants.Events.GUILD_SCHEDULED_EVENT_DELETE, guildScheduledEvent);
	},

	GUILD_SCHEDULED_EVENT_UPDATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { oldGuildScheduledEvent, newGuildScheduledEvent } = client.actions.GuildScheduledEventUpdate.handle(packet.d);
		client.emit(Constants.Events.GUILD_SCHEDULED_EVENT_UPDATE, oldGuildScheduledEvent, newGuildScheduledEvent);
	},

	GUILD_SCHEDULED_EVENT_USER_ADD: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { guildScheduledEvent, user } = client.actions.GuildScheduledEventUserAdd.handle(packet.d);
		client.emit(Constants.Events.GUILD_SCHEDULED_EVENT_USER_ADD, guildScheduledEvent, user);
	},

	GUILD_SCHEDULED_EVENT_USER_REMOVE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { guildScheduledEvent, user } = client.actions.GuildScheduledEventUserRemove.handle(packet.d);
		client.emit(Constants.Events.GUILD_SCHEDULED_EVENT_USER_REMOVE, guildScheduledEvent, user);
	},

	GUILD_STICKERS_UPDATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const guild = getOrCreateGuild(client, packet.d.guild_id, packet.d.shardId);
		if(guild.stickers.cache instanceof LimitedCollection) {
			const stickers = new Collection();
			for(const sticker of packet.d.stickers) {
				stickers.set(sticker.id, guild.stickers._add(sticker));
			}
			client.emit("guildStickersUpdate", stickers);
		} else {
			client.actions.GuildStickersUpdate.handle(packet.d);
		}
	},

	INTERACTION_CREATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		client.actions.InteractionCreate.handle(packet.d);
	},

	INVITE_CREATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { invite } = client.actions.InviteCreate.handle(packet.d);
		client.emit(Constants.Events.INVITE_CREATE, invite);
	},

	INVITE_DELETE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { invite } = client.actions.InviteDelete.handle(packet.d);
		client.emit(Constants.Events.INVITE_DELETE, invite);
	},

	MESSAGE_CREATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { message } = client.actions.MessageCreate.handle(packet.d);
		client.emit(Constants.Events.MESSAGE_CREATE, message);
	},

	MESSAGE_DELETE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { message } = client.actions.MessageDelete.handle(packet.d);
		client.emit(Constants.Events.MESSAGE_DELETE, message);
	},

	MESSAGE_DELETE_BULK: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { messages } = client.actions.MessageDeleteBulk.handle(packet.d);
		client.emit(Constants.Events.MESSAGE_BULK_DELETE, messages);
	},

	MESSAGE_UPDATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { old, updated } = client.actions.MessageUpdate.handle(packet.d);
		client.emit(Constants.Events.MESSAGE_UPDATE, old, updated);
	},

	MESSAGE_REACTION_ADD: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { reaction, user } = client.actions.MessageReactionAdd.handle(packet.d);
		client.emit(Constants.Events.MESSAGE_REACTION_ADD, reaction, user);
	},

	MESSAGE_REACTION_REMOVE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { reaction, user } = client.actions.MessageReactionRemove.handle(packet.d);
		client.emit(Constants.Events.MESSAGE_REACTION_REMOVE, reaction, user);
	},

	MESSAGE_REACTION_REMOVE_ALL: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { message, removed } = client.actions.MessageReactionRemoveAll.handle(packet.d);
		client.emit(Constants.Events.MESSAGE_REACTION_REMOVE_ALL, message, removed);
	},

	MESSAGE_REACTION_REMOVE_EMOJI: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		const { reaction } = client.actions.MessageReactionRemoveEmoji.handle(packet.d);
		client.emit(Constants.Events.MESSAGE_REACTION_REMOVE_EMOJI, reaction);
	},

	PRESENCE_UPDATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		client.actions.PresenceUpdate.handle(packet.d);
	},

	READY: (client, { d: data }, shard) => {
		if(client.user) {
			client.user._patch(data.user);
		} else {
			client.user = new ClientUser(client, data.user);
			client.users.cache.set(client.user.id, client.user);
		}
		for(const guild of data.guilds) {
			guild.shardId = shard.id;
			client.guilds._add(guild);
		}
		if (client.application) {
			client.application._patch(data.application);
		} else {
			client.application = new ClientApplication(client, data.application);
		}
		client.emit("shardConnect", shard.id, data.guilds);
		shard.checkReady();
	},

	STAGE_INSTANCE_CREATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		client.actions.StageInstanceCreate.handle(packet.d);
	},

	STAGE_INSTANCE_DELETE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		client.actions.StageInstanceDelete.handle(packet.d);
	},

	STAGE_INSTANCE_UPDATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		client.actions.StageInstanceUpdate.handle(packet.d);
	},

	THREAD_CREATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		client.actions.ThreadCreate.handle(packet.d);
	},

	THREAD_DELETE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		client.actions.ThreadDelete.handle(packet.d);
	},

	THREAD_LIST_SYNC: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		client.actions.ThreadListSync.handle(packet.d);
	},

	THREAD_MEMBER_UPDATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		client.actions.ThreadMemberUpdate.handle(packet.d);
	},

	THREAD_MEMBERS_UPDATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		client.actions.ThreadMembersUpdate.handle(packet.d);
	},

	THREAD_UPDATE: (client, packet) => {
		const { old, updated } = client.actions.ChannelUpdate.handle(packet.d);
		client.emit(Constants.Events.THREAD_UPDATE, old, updated);
	},

	TYPING_START: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		client.actions.TypingStart.handle(packet.d);
	},

	USER_UPDATE: (client, packet) => {
		const { old, updated } = client.actions.UserUpdate.handle(packet.d);
		client.emit(Constants.Events.USER_UPDATE, old, updated);
	},

	VOICE_STATE_UPDATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		client.actions.VoiceStateUpdate.handle(packet.d);
	},

	WEBHOOKS_UPDATE: (client, packet, shard) => {
		packet.d.shardId = shard.id;
		client.actions.WebhooksUpdate.handle(packet.d);
	}

};

module.exports = Object.assign(PacketHandlers, handlers);
