"use strict";

const { Collection } = require("@discordjs/collection");
const { override, getOrCreateChannel, getOrCreateGuild } = require("./functions");

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

override("/managers/GuildMemberRoleManager.js", X => class GuildMemberRoleManager extends X {
	get cache() {
		const everyone = this.guild.roles.everyone;
		const roles = new Collection([[everyone.id, everyone]]);
		for(const id of this.member._roles) {
			let role = this.guild.roles.cache.get(id);
			if(!role) {
				role = this.guild.roles._add({ id, permissions: 0 }, false);
				role.partial = true;
			}
			roles.set(id, role);
		}
		return roles;
	}
});

override("/managers/RoleManager.js", X => class RoleManager extends X {
	get everyone() {
		return super.everyone || this._add({ id: this.guild.id, permissions: 0 }, false);
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
		if(roles?.length && this.guild) {
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
			if(!chan) { continue; }
			this._channels.set(chan.id, chan);
		}
		return this._channels;
	}
});

override("/structures/Message.js", obj => {
	obj.Message = class Message extends obj.Message {
		constructor(client, data) {
			super(client, data);
			if(data.guild_id && !this.guildId) {
				this.guildId = data.guild_id;
			}
		}
		_patch(data) {
			super._patch(data);
			if(data.member && !this.member && this.author && this.guild) {
				this._member = this.guild.members._add(Object.assign(data.member, { user: this.author }));
			}
		}
		get member() {
			if(!this.guild) { return null; }
			const id = this.author?.id || this._member?.id;
			if(!id) { return null; }
			return this.guild.members.cache.get(id) || this._member || null;
		}
		get channel() {
			return getOrCreateChannel(this.client, this.channelId, this.guild);
		}
		get guild() {
			return this.guildId ? getOrCreateGuild(this.client, this.guildId) : null;
		}
	};
	return obj;
});

override("/structures/BaseGuild.js", X => class BaseGuild extends X {
	get nameAcronym() {
		return this.name ? super.nameAcronym : null;
	}
});

override("/structures/Guild.js", obj => {
	obj.Guild = class Guild extends obj.Guild {
		_patch(data) {
			super._patch(data);
			if(data.members) {
				const me = data.members.find(member => member.user.id === this.client.user.id);
				if(me && !this.me) {
					this.members.cache.forceSet(me.user.id, this.members._add(me));
				}
			}
			if(data.roles) {
				const everyone = data.roles.find(role => role.id === this.id);
				if(everyone && !this.roles.cache.has(everyone.id)) { this.roles.cache.forceSet(everyone.id, this.roles._add(everyone)); }
			}
		}
	};
	return obj;
});

override("/structures/Interaction.js", X => class Interaction extends X {
	get channel() {
		return this.channelId ? getOrCreateChannel(this.client, this.channelId, this.guild) : null;
	}
	get guild() {
		return this.guildId ? getOrCreateGuild(this.client, this.guildId) : null;
	}
});

const Discord = require("discord.js");
const { create } = Discord.Channel;

Discord.Channel.create = function(client, data, guild, { fromInteraction } = {}) {
	if(data instanceof this) { return data; }
	const channel = create(client, data, guild, { allowUnknownGuild: true, fromInteraction });
	if(channel && channel.guild && channel.guild.channels) { channel.guild.channels.cache.set(channel.id, channel); }
	return channel;
};

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

Discord.GuildScheduledEventManager.prototype.forge = function(id) {
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

Discord.LimitedCollection.prototype.forceSet = function(key, value) {
	return Object.getPrototypeOf(Object.getPrototypeOf(this)).set.call(this, key, value);
};

Discord.Collection.prototype.forceSet = function(key, value) {
	return this.set(key, value);
};

module.exports = Discord;
