"use strict";

const Collection = require("@discordjs/collection");
const { override, getOrCreateChannel } = require("./functions");

override("/rest/APIRequest.js", X => class APIRequest extends X {
	async make() {
		const response = await super.make();
		if(this.client.listenerCount("rest")) {
			let data = "";
			response.body.on("data", d => { data += d.toString(); });
			response.body.on("end", () => {
				this.client.emit("rest", {
					path: this.path,
					method: this.method,
					responseHeaders: response.headers.raw(),
					responseBody: data
				});
			});
		}
		return response;
	}
});

override("/structures/MessageMentions.js", X => class MessageMentions extends X {
	constructor(message, users, roles, everyone, crosspostedChannels, repliedUser) {
		super(message, users, roles, everyone, crosspostedChannels, repliedUser);
		if(users?.length) {
			for(const mention of users) {
				if(mention.member && !this.members.has(mention.id)) {
					this._members.set(mention.id, this.guild.members._add(Object.assign(mention.member, { user: mention })));
				}
			}
		}
		if(roles?.length) {
			for(const id of roles) {
				if(!this.roles.has(id)) {
					this.roles.set(id, this.guild.roles._add({ id, permissions: 0 }, false));
				}
			}
		}
	}
	get channels() {
		if(this._channels) { return this._channels; }
		this._channels = new Collection();
		let matches;
		while((matches = this.constructor.CHANNELS_PATTERN.exec(this._content)) !== null) {
			const chan = getOrCreateChannel(this.client, matches[1], this.guild);
			this._channels.set(chan.id, chan);
		}
		return this._channels;
	}
});

override("/structures/Message.js", X => class Message extends X {
	_patch(data, partial) {
		super._patch(data, partial);
		if(data.member && !this.member && this.author) { this._member = this.guild.members._add(Object.assign(data.member, { user: this.author })); }
	}
	get member() {
		if(!this.guild) { return null; }
		const id = this.author?.id || this._member?.id;
		if(!id) { return null; }
		return this.guild.members.cache.get(id) || this._member || null;
	}
});

const Discord = require("discord.js");

Discord.GuildChannel.prototype.fetchOverwrites = async function() {
	const channel = await this.client.api.channels(this.id).get();
	const collection = new Collection();
	if(channel.permission_overwrites) {
		for(const overwrite of channel.permission_overwrites) {
			collection.set(overwrite.id, this.permissionOverwrites._add(overwrite));
		}
	}
	return collection;
};

Discord.UserManager.prototype.forge = function(id) {
	return this._add({ id }, false);
};

Discord.GuildManager.prototype.forge = function(id) {
	return this._add({ id }, false);
};

Discord.ChannelManager.prototype.forge = function(id, _type = "DM") {
	const type = Discord.Constants.ChannelTypes[_type.toUpperCase()];
	let guild;
	if(type !== 1) { guild = this.client.guilds.forge("0"); }
	return this._add({ id, type }, guild, { cache: false, allowUnknownGuild: true });
};

Discord.GuildChannelManager.prototype.forge = function(id, type = "GUILD_TEXT") {
	return this.client.channels._add({
		id,
		type: Discord.Constants.ChannelTypes[type.toUpperCase()]
	}, this.guild, { cache: false, allowUnknownGuild: true });
};

Discord.GuildMemberManager.prototype.forge = function(id) {
	return this._add({ user: { id } }, false);
};

Discord.GuildEmojiManager.prototype.forge = function(id) {
	return this._add({ id }, false);
};

Discord.ReactionManager.prototype.forge = function(id) {
	const emoji = {};
	if(isNaN(id)) {
		emoji.name = id;
	} else {
		emoji.id = id;
	}
	return this._add({ emoji }, false);
};

Discord.RoleManager.prototype.forge = function(id) {
	return this._add({ id }, false);
};

Discord.PresenceManager.prototype.forge = function(id) {
	return this._add({ user: { id } }, false);
};

Discord.MessageManager.prototype.forge = function(id) {
	return this._add({ id }, false);
};

Discord.GuildBanManager.prototype.forge = function(id) {
	return this._add({ user: { id } }, false);
};

Discord.ApplicationCommandManager.prototype.forge = function(id) {
	return this._add({ id }, false);
};

Discord.GuildInviteManager.prototype.forge = function(code, id) {
	return this._add({ code, channel: { id } }, false);
};

Discord.GuildStickerManager.prototype.forge = function(id) {
	return this._add({ id }, false);
};

Discord.StageInstanceManager.prototype.forge = function(id) {
	return this._add({ id }, false);
};

Discord.VoiceStateManager.prototype.forge = function(user_id) {
	return this._add({ user_id }, false);
};

Discord.PermissionOverwriteManager.prototype.forge = function(id, type) {
	return this._add({ id, type, allow: 0, deny: 0 });
};

Discord.ThreadMemberManager.prototype.forge = function(user_id) {
	return this._add({ user_id });
};

/*
- ApplicationCommandManager: 0,
- BaseGuildEmojiManager: 0,
- ChannelManager: 0,
- GuildBanManager: 0,
- GuildChannelManager: 0,
- GuildInviteManager: 0,
- GuildManager: 0,
- GuildMemberManager: 0,
- GuildStickerManager: 0,
- MessageManager: 0,
- PermissionOverwriteManager: 0,
- PresenceManager: 0,
- ReactionManager: 0,
ReactionUserManager: 0,
- RoleManager: 0,
- StageInstanceManager: 0,
ThreadManager: 0,
- ThreadMemberManager: 0,
- UserManager: 0,
- VoiceStateManager: 0
*/

module.exports = Discord;
