"use strict";

const { resolve } = require("path");
const PacketHandlers = require(resolve(require.resolve("discord.js").replace("index.js", "/client/websocket/handlers")));
const { Collection, ClientUser, Constants, ClientApplication, Structures } = require("discord.js");

PacketHandlers.READY = (client, { d: data }, shard) => {
	if(client.user) {
		client.user._patch(data.user);
	} else {
		client.user = new ClientUser(client, data.user);
		client.users.cache.set(client.user.id, client.user);
	}
	const guilds = new Collection();
	for(const guild of data.guilds) {
		guild.shardID = shard.id;
		guilds.set(guild.id, client.guilds.add(guild, client.options.cacheGuilds));
	}
	client.emit("shardConnect", shard.id, guilds);
	if(!client.options.cacheGuilds) {
		shard.debug("Guild cache is disabled, skipping guild check.");
		shard.expectedGuilds.clear();
	}
	if (client.application) {
		client.application._patch(data.application);
	} else {
		client.application = new ClientApplication(client, data.application);
	}
	shard.checkReady();
};

PacketHandlers.CHANNEL_CREATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	const { channel } = client.actions.ChannelCreate.handle(packet.d);
	if(!channel) { return; }
	client.emit(Constants.Events.CHANNEL_CREATE, channel);
};

PacketHandlers.CHANNEL_DELETE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	const { channel } = client.actions.ChannelDelete.handle(packet.d);
	if(!channel) { return; }
	client.emit(Constants.Events.CHANNEL_DELETE, channel);
};

PacketHandlers.CHANNEL_UPDATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	const { old, updated } = client.actions.ChannelUpdate.handle(packet.d);
	if(!updated) { return; }
	client.emit(Constants.Events.CHANNEL_UPDATE, old, updated);
};

PacketHandlers.CHANNEL_PINS_UPDATE = (client, { d: data }, shard) => {
	const guild = data.guild_id ? client.guilds.cache.get(data.guild_id) || client.guilds.add({
		id: data.guild_id,
		shardID: shard.id
	}, false) : void 0;
	const channel = client.channels.cache.get(data.channel_id) || client.channels.add({
		id: data.channel_id,
		type: guild ? 0 : 1
	}, guild, false);
	const time = new Date(data.last_pin_timestamp);
	if(!Number.isNaN(time.getTime())) {
		channel.lastPinTimestamp = time.getTime() || null;
		client.emit(Constants.Events.CHANNEL_PINS_UPDATE, channel, time);
	}
};

PacketHandlers.GUILD_BAN_ADD = (client, { d: data }, shard) => {
	data.shardID = shard.id;
	client.actions.GuildBanAdd.handle(data);
};

PacketHandlers.GUILD_BAN_REMOVE = (client, { d: data }, shard) => {
	data.shardID = shard.id;
	client.actions.GuildBanRemove.handle(data);
};

PacketHandlers.GUILD_CREATE = (client, { d: data }, shard) => {
	data.shardID = shard.id;
	let guild = client.guilds.cache.get(data.id);
	if(guild) {
		if(!guild.available && !data.unavailable) {
			guild._patch(data);
		}
	} else {
		guild = client.guilds.add(data, client.options.cacheGuilds);
		if(client.ws.status === Constants.Status.READY || !client.options.cacheGuilds) {
			client.emit(Constants.Events.GUILD_CREATE, guild);
		}
	}
};

PacketHandlers.GUILD_DELETE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	const { guild } = client.actions.GuildDelete.handle(packet.d);
	if(guild) { client.emit(Constants.Events.GUILD_DELETE, guild); }
};

PacketHandlers.GUILD_UPDATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	const { old, updated } = client.actions.GuildUpdate.handle(packet.d);
	client.emit(Constants.Events.GUILD_UPDATE, old, updated);
};

PacketHandlers.GUILD_EMOJIS_UPDATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	client.actions.GuildEmojisUpdate.handle(packet.d);
};

PacketHandlers.GUILD_INTEGRATIONS_UPDATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	client.actions.GuildIntegrationsUpdate.handle(packet.d);
};

PacketHandlers.GUILD_MEMBERS_CHUNK = (client, { d: data }, shard) => {
	const guild = client.guilds.cache.get(data.guild_id) || client.guilds.add({
		id: data.guild_id,
		shardID: shard.id
	}, false);
	client.emit(Constants.Events.GUILD_MEMBERS_CHUNK, guild, data);
};

PacketHandlers.GUILD_MEMBER_ADD = (client, { d: data }, shard) => {
	const guild = client.guilds.cache.get(data.guild_id) || client.guilds.add({
		id: data.guild_id,
		shardID: shard.id
	}, false);
	const member = guild.members.add(data, client.options.cacheMembers || client.users.cache.has(data.user.id));
	if(guild.memberCount) { guild.memberCount++; }
	client.emit(Constants.Events.GUILD_MEMBER_ADD, member);
};

PacketHandlers.GUILD_MEMBER_REMOVE = (client, packet, shard) => {
	const { member } = client.actions.GuildMemberRemove.handle(packet.d, shard);
	client.emit(Constants.Events.GUILD_MEMBER_REMOVE, member);
};

PacketHandlers.GUILD_MEMBER_UPDATE = (client, packet, shard) => {
	client.actions.GuildMemberUpdate.handle(packet.d, shard);
};

PacketHandlers.GUILD_ROLE_CREATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	const { role } = client.actions.GuildRoleCreate.handle(packet.d);
	client.emit(Constants.Events.GUILD_ROLE_CREATE, role);
};

PacketHandlers.GUILD_ROLE_DELETE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	const { role } = client.actions.GuildRoleDelete.handle(packet.d);
	client.emit(Constants.Events.GUILD_ROLE_DELETE, role);
};

PacketHandlers.GUILD_ROLE_UPDATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	const { old, updated } = client.actions.GuildRoleUpdate.handle(packet.d);
	client.emit(Constants.Events.GUILD_ROLE_UPDATE, old, updated);
};

PacketHandlers.INVITE_CREATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	const { invite } = client.actions.InviteCreate.handle(packet.d);
	client.emit(Constants.Events.INVITE_CREATE, invite);
};

PacketHandlers.INVITE_DELETE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	const { invite } = client.actions.InviteDelete.handle(packet.d);
	client.emit(Constants.Events.INVITE_DELETE, invite);
};

PacketHandlers.MESSAGE_CREATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	const { message } = client.actions.MessageCreate.handle(packet.d);
	client.emit(Constants.Events.MESSAGE_CREATE, message);
};

PacketHandlers.MESSAGE_DELETE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	const { message } = client.actions.MessageDelete.handle(packet.d);
	client.emit(Constants.Events.MESSAGE_DELETE, message);
};

PacketHandlers.MESSAGE_DELETE_BULK = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	const { messages } = client.actions.MessageDeleteBulk.handle(packet.d);
	client.emit(Constants.Events.MESSAGE_BULK_DELETE, messages);
};

PacketHandlers.MESSAGE_UPDATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	const { old, updated } = client.actions.MessageUpdate.handle(packet.d);
	client.emit(Constants.Events.MESSAGE_UPDATE, old, updated);
};

PacketHandlers.MESSAGE_REACTION_ADD = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	const { reaction, user } = client.actions.MessageReactionAdd.handle(packet.d);
	client.emit(Constants.Events.MESSAGE_REACTION_ADD, reaction, user);
};

PacketHandlers.MESSAGE_REACTION_REMOVE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	const { reaction, user } = client.actions.MessageReactionRemove.handle(packet.d);
	client.emit(Constants.Events.MESSAGE_REACTION_REMOVE, reaction, user);
};

PacketHandlers.MESSAGE_REACTION_REMOVE_ALL = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	const { message } = client.actions.MessageReactionRemoveAll.handle(packet.d);
	client.emit(Constants.Events.MESSAGE_REACTION_REMOVE_ALL, message);
};

PacketHandlers.MESSAGE_REACTION_REMOVE_EMOJI = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	const { reaction } = client.actions.MessageReactionRemoveEmoji.handle(packet.d);
	client.emit(Constants.Events.MESSAGE_REACTION_REMOVE_EMOJI, reaction);
};

PacketHandlers.PRESENCE_UPDATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	client.actions.PresenceUpdate.handle(packet.d);
};

PacketHandlers.TYPING_START = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	client.actions.TypingStart.handle(packet.d);
};

PacketHandlers.USER_UPDATE = (client, packet) => {
	const { old, updated } = client.actions.UserUpdate.handle(packet.d);
	client.emit(Constants.Events.USER_UPDATE, old, updated);
};

PacketHandlers.VOICE_STATE_UPDATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	client.actions.VoiceStateUpdate.handle(packet.d);
};

PacketHandlers.WEBHOOKS_UPDATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	client.actions.WebhooksUpdate.handle(packet.d);
};

PacketHandlers.APPLICATION_COMMAND_CREATE = (client, { d: data }, shard) => {
	let command;
	if(data.guild_id) {
		const guild = client.guilds.cache.get(data.guild_id) || client.guilds.add({
			id: data.guild_id,
			shardID: shard.id
		}, false);
		command = guild.commands.add(data);
	} else {
		command = client.application.commands.add(data);
	}
	client.emit(Constants.Events.APPLICATION_COMMAND_CREATE, command);
};

PacketHandlers.APPLICATION_COMMAND_DELETE = (client, { d: data }, shard) => {
	let command;
	if(data.guild_id) {
		const guild = client.guilds.cache.get(data.guild_id) || client.guilds.add({
			id: data.guild_id,
			shardID: shard.id
		}, false);
		command = guild.commands.add(data);
		guild.commands.cache.delete(data.id);
	} else {
		command = client.application.commands.add(data);
		client.application.commands.cache.delete(data.id);
	}
	client.emit(Constants.Events.APPLICATION_COMMAND_DELETE, command);
};

PacketHandlers.APPLICATION_COMMAND_UPDATE = (client, { d: data }, shard) => {
	let oldCommand;
	let newCommand;
	if(data.guild_id) {
		const guild = client.guilds.cache.get(data.guild_id) || client.guilds.add({
			id: data.guild_id,
			shardID: shard.id
		}, false);
		oldCommand = guild.commands.cache.get(data.id)?._clone() ?? null;
		newCommand = guild.commands.add(data);
	} else {
		oldCommand = client.application.commands.cache.get(data.id)?._clone() ?? null;
		newCommand = client.application.commands.add(data);
	}

	client.emit(Constants.Events.APPLICATION_COMMAND_UPDATE, oldCommand, newCommand);
};

PacketHandlers.INTERACTION_CREATE = (client, { d: data }, shard) => {
	data.shardID = shard.id;
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

PacketHandlers.STAGE_INSTANCE_CREATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	client.actions.StageInstanceCreate.handle(packet.d);
};

PacketHandlers.STAGE_INSTANCE_DELETE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	client.actions.StageInstanceDelete.handle(packet.d);
};

PacketHandlers.STAGE_INSTANCE_UPDATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	client.actions.StageInstanceUpdate.handle(packet.d);
};

module.exports = PacketHandlers;
