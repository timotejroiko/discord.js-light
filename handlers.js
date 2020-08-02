"use strict";

const { resolve } = require("path");
const PacketHandlers = require(resolve(require.resolve("discord.js").replace("index.js","/client/websocket/handlers")));
const { Collection, ClientUser, Constants, Intents } = require("discord.js");

PacketHandlers.READY = (client, { d: data }, shard) => {
	if(client.user) {
		client.user._patch(data.user);
	} else {
		let clientUser = new ClientUser(client, data.user);
		client.user = clientUser;
		client.users.cache.set(clientUser.id, clientUser);
	}
	let guilds = new Collection();
	for(let guild of data.guilds) {
		guild.shardID = shard.id;
		guilds.set(guild.id,client.guilds.add(guild,client.options.cacheGuilds));
	}
	client.emit("shardConnect",shard.id,guilds);
	if(!client.options.cacheGuilds) {
		shard.debug("Guild cache is disabled, skipping guild check.");
		shard.expectedGuilds.clear();
	}
	shard.checkReady();
}

PacketHandlers.CHANNEL_CREATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	let { channel } = client.actions.ChannelCreate.handle(packet.d);
	client.emit(Constants.Events.CHANNEL_CREATE, channel);
}

PacketHandlers.CHANNEL_DELETE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	let { channel } = client.actions.ChannelDelete.handle(packet.d);
	client.emit(Constants.Events.CHANNEL_DELETE, channel);
};

PacketHandlers.CHANNEL_UPDATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	let { old, updated } = client.actions.ChannelUpdate.handle(packet.d);
	client.emit(Constants.Events.CHANNEL_UPDATE, old, updated);
}

PacketHandlers.CHANNEL_PINS_UPDATE = (client, { d: data }, shard) => {
	let guild = data.guild_id ? client.guilds.cache.get(data.guild_id) || client.guilds.add({id:data.guild_id,shardID:shard.id}, false) : void 0;
	let channel = client.channels.cache.get(data.channel_id) || client.channels.add({id:data.channel_id,type:guild ? 0 : 1}, guild, false);
	let time = new Date(data.last_pin_timestamp);
	if(!Number.isNaN(time.getTime())) {
		channel.lastPinTimestamp = time.getTime() || null;
		client.emit(Constants.Events.CHANNEL_PINS_UPDATE, channel, time);
	}
}

PacketHandlers.GUILD_BAN_ADD = (client, { d: data }, shard) => {
	let guild = client.guilds.cache.get(data.guild_id) || client.guilds.add({id:data.guild_id,shardID:shard.id}, false);
	let user = client.users.add(data.user, client.users.cache.has(data.user.id));
	client.emit(Constants.Events.GUILD_BAN_ADD, guild, user);
}

PacketHandlers.GUILD_BAN_REMOVE = (client, { d: data }, shard) => {
	let guild = client.guilds.cache.get(data.guild_id) || client.guilds.add({id:data.guild_id,shardID:shard.id}, false);
	let user = client.users.add(data.user, client.users.cache.has(data.user.id));
	client.emit(Constants.Events.GUILD_BAN_REMOVE, guild, user);
}

PacketHandlers.GUILD_CREATE = (client, { d: data }, shard) => {
	data.shardID = shard.id;
	let guild = client.guilds.cache.get(data.id);
	if(guild) {
		if(!guild.available && !data.unavailable) {
			guild._patch(data);
			if(client.ws.status === Constants.Status.READY && client.options.fetchAllMembers && (!client.options.ws.intents || (client.options.ws.intents & Intents.FLAGS.GUILD_MEMBERS))) {
				guild.members.fetch().catch(err => client.emit(Constants.Events.DEBUG, `Failed to fetch all members: ${err}\n${err.stack}`));
			}
		}
	} else {
		guild = client.guilds.add(data,client.options.cacheGuilds);
		if(client.ws.status === Constants.Status.READY || !client.options.cacheGuilds) {
			if(client.options.fetchAllMembers && (!client.options.ws.intents || (client.options.ws.intents & Intents.FLAGS.GUILD_MEMBERS))) {
				guild.members.fetch().then(() => {
					client.emit(Constants.Events.GUILD_CREATE, guild);
				}).catch(err => client.emit(Constants.Events.DEBUG, `Failed to fetch all members: ${err}\n${err.stack}`));
			} else {
				client.emit(Constants.Events.GUILD_CREATE, guild);
			}
		}
	}
}

PacketHandlers.GUILD_DELETE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	let { guild } = client.actions.GuildDelete.handle(packet.d);
	if(guild) { client.emit(Constants.Events.GUILD_DELETE, guild); }
}

PacketHandlers.GUILD_UPDATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	let { old, updated } = client.actions.GuildUpdate.handle(packet.d);
	client.emit(Constants.Events.GUILD_UPDATE, old, updated);
}

PacketHandlers.GUILD_EMOJIS_UPDATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	client.actions.GuildEmojisUpdate.handle(packet.d);
}

PacketHandlers.GUILD_INTEGRATIONS_UPDATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	client.actions.GuildIntegrationsUpdate.handle(packet.d);
}

PacketHandlers.GUILD_MEMBERS_CHUNK = (client, { d: data }, shard) => {
	let guild = client.guilds.cache.get(data.guild_id) || client.guilds.add({id:data.guild_id,shardID:shard.id}, false);
	client.emit(Constants.Events.GUILD_MEMBERS_CHUNK, guild, data);
}

PacketHandlers.GUILD_MEMBER_ADD = (client, { d: data }, shard) => {
	let guild = client.guilds.cache.get(data.guild_id) || client.guilds.add({id:data.guild_id,shardID:shard.id}, false);
	let member = guild.members.add(data, client.users.cache.has(data.user.id));
	if(guild.memberCount) { guild.memberCount++; }
	client.emit(Constants.Events.GUILD_MEMBER_ADD, member);
}

PacketHandlers.GUILD_MEMBER_REMOVE = (client, packet, shard) => {
	let { member } = client.actions.GuildMemberRemove.handle(packet.d, shard);
	client.emit(Constants.Events.GUILD_MEMBER_REMOVE, member);
}

PacketHandlers.GUILD_MEMBER_UPDATE = (client, { d: data }, shard) => {
	let guild = client.guilds.cache.get(data.guild_id) || client.guilds.add({id:data.guild_id,shardID:shard.id}, false);
	let member = guild.members.cache.get(data.user.id);
	if(member) {
		let old = member._update(data);
		if(!member.equals(old)) {
			client.emit(Constants.Events.GUILD_MEMBER_UPDATE, old, member);
		}
	} else {
		member = guild.members.add(data, client.users.cache.has(data.user.id));
		client.emit(Constants.Events.GUILD_MEMBER_UPDATE, null, member);
	}
}

PacketHandlers.GUILD_ROLE_CREATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	let { role } = client.actions.GuildRoleCreate.handle(packet.d);
	client.emit(Constants.Events.GUILD_ROLE_CREATE, role);
}

PacketHandlers.GUILD_ROLE_DELETE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	let { role } = client.actions.GuildRoleDelete.handle(packet.d);
	client.emit(Constants.Events.GUILD_ROLE_DELETE, role);
}

PacketHandlers.GUILD_ROLE_UPDATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	let { old, updated } = client.actions.GuildRoleUpdate.handle(packet.d);
	client.emit(Constants.Events.GUILD_ROLE_UPDATE, old, updated);
}

PacketHandlers.INVITE_CREATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	let { invite } = client.actions.InviteCreate.handle(packet.d);
	client.emit(Constants.Events.INVITE_CREATE, invite);
}

PacketHandlers.INVITE_DELETE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	let { invite } = client.actions.InviteDelete.handle(packet.d);
	client.emit(Constants.Events.INVITE_DELETE, invite);
}

PacketHandlers.MESSAGE_CREATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	let { message } = client.actions.MessageCreate.handle(packet.d);
	client.emit(Constants.Events.MESSAGE_CREATE, message);
}

PacketHandlers.MESSAGE_DELETE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	let { message } = client.actions.MessageDelete.handle(packet.d);
	client.emit(Constants.Events.MESSAGE_DELETE, message);
}

PacketHandlers.MESSAGE_DELETE_BULK = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	let { messages } = client.actions.MessageDeleteBulk.handle(packet.d);
	client.emit(Constants.Events.MESSAGE_BULK_DELETE, messages);
}

PacketHandlers.MESSAGE_UPDATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	let { old, updated } = client.actions.MessageUpdate.handle(packet.d);
	client.emit(Constants.Events.MESSAGE_UPDATE, old, updated);
}

PacketHandlers.MESSAGE_REACTION_ADD = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	let { reaction, user } = client.actions.MessageReactionAdd.handle(packet.d);
	client.emit(Constants.Events.MESSAGE_REACTION_ADD, reaction, user);
}

PacketHandlers.MESSAGE_REACTION_REMOVE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	let { reaction, user } = client.actions.MessageReactionRemove.handle(packet.d);
	client.emit(Constants.Events.MESSAGE_REACTION_REMOVE, reaction, user);
}

PacketHandlers.MESSAGE_REACTION_REMOVE_ALL = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	let { message } = client.actions.MessageReactionRemoveAll.handle(packet.d);
	client.emit(Constants.Events.MESSAGE_REACTION_REMOVE_ALL, message);
}

PacketHandlers.MESSAGE_REACTION_REMOVE_EMOJI = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	let { reaction } = client.actions.MessageReactionRemoveEmoji.handle(packet.d);
	client.emit(Constants.Events.MESSAGE_REACTION_REMOVE_EMOJI, reaction);
}

PacketHandlers.PRESENCE_UPDATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	client.actions.PresenceUpdate.handle(packet.d);
}

PacketHandlers.TYPING_START = (client, { d: data }, shard) => {
	let guild = data.guild_id ? client.guilds.cache.get(data.guild_id) || client.guilds.add({id:data.guild_id,shardID:shard.is}, false) : void 0;
	let channel = client.channels.cache.get(data.channel_id) || client.channels.add({id:data.channel_id,type:guild ? 0 : 1}, guild, false);
	let user = client.users.cache.get(data.user_id);
	if(user && data.member) {
		if(data.member.user && data.member.user.username && !user.equals(data.member.user)) {
			client.actions.UserUpdate.handle(data.member.user);
		}
		let member = guild.members.cache.get(data.user_id);
		if(member) {
			member._update(data.member);
		} else {
			guild.members.add(data.member);
		}
	} else if(!user) {
		user = client.users.add((data.member || {}).user || {id:data.user_id}, false);
	}
	let timestamp = new Date(data.timestamp * 1000);
	if(channel._typing.has(user.id)) {
		let typing = channel._typing.get(user.id);
		typing.lastTimestamp = timestamp;
		typing.elapsedTime = Date.now() - typing.since;
		client.clearTimeout(typing.timeout);
		typing.timeout = client.setTimeout(() => { channel._typing.delete(user.id); }, 10000);
	} else {
		channel._typing.set(user.id, {
			user,
			since: new Date(),
			lastTimestamp: new Date(),
			elapsedTime: 0,
			timeout: client.setTimeout(() => { channel._typing.delete(user.id); }, 10000)
		});
	}
	client.emit(Constants.Events.TYPING_START, channel, user);
}

PacketHandlers.USER_UPDATE = (client, packet) => {
	let { old, updated } = client.actions.UserUpdate.handle(packet.d);
	client.emit(Constants.Events.USER_UPDATE, old, updated);
}

PacketHandlers.VOICE_STATE_UPDATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	client.actions.VoiceStateUpdate.handle(packet.d);
}

PacketHandlers.WEBHOOKS_UPDATE = (client, packet, shard) => {
	packet.d.shardID = shard.id;
	client.actions.WebhooksUpdate.handle(packet.d);
}

module.exports = PacketHandlers;
