"use strict";

const Discord = require("./extensions.js");
const PacketHandlers = require("./handlers.js");
const Actions = require("./actions.js");

Discord.LimitedCollection.prototype.forceSet = function(key, value) {
	return Object.getPrototypeOf(Object.getPrototypeOf(this)).set.call(this, key, value);
};

Discord.Collection.prototype.forceSet = function(key, value) {
	return this.set(key, value);
};

Discord.Client = class Client extends Discord.Client {
	constructor(options = {}) {
		if(Array.isArray(options.disabledEvents)) {
			for(const event of options.disabledEvents) { delete PacketHandlers[event]; }
		}
		if(!options.makeCache) {
			options.makeCache = Discord.Options.cacheWithLimits({
				ApplicationCommandManager: 0,
				BaseGuildEmojiManager: 0,
				ChannelManager: 0,
				GuildBanManager: 0,
				GuildChannelManager: 0,
				GuildInviteManager: 0,
				// GuildManager: 0,
				GuildMemberManager: 0,
				GuildStickerManager: 0,
				MessageManager: 0,
				PermissionOverwriteManager: 0,
				PresenceManager: 0,
				ReactionManager: 0,
				ReactionUserManager: 0,
				RoleManager: 0,
				StageInstanceManager: 0,
				ThreadManager: 0,
				ThreadMemberManager: 0,
				UserManager: 0,
				VoiceStateManager: 0
			});
		}
		super(options);
		for(const action of Object.keys(Actions)) { this.actions[action].handle = Actions[action]; }
		this.ws.handlePacket = (packet, shard) => {
			if(packet && PacketHandlers[packet.t]) {
				PacketHandlers[packet.t](this, packet, shard);
			}
			return true;
		};
	}
};

const pkg = require("./package.json");
Discord.version = `${pkg.version} (${Discord.version})`;

module.exports = Discord;
