const GC = require("discord.js/src/structures/GuildChannel.js");

require.cache[require.resolve("discord.js/src/structures/GuildChannel.js")].exports = class GuildChannel extends GC {
	constructor(guild, data) {
		super({client: guild.client}, data);
		if(!this.client.options.cacheGuilds) {
			this._guildID = guild.id;
			this._shardID = guild.shardID;
			Object.defineProperty(this, "guild", {
				enumerable: false,
				get: function() {
					return this.client.guilds.cache.get(this._guildID) || this.client.guilds.add({id:this._guildID,shardID:this._shardID}, false);
				}
			});
		} else {
			this.guild = guild;
		}
	}
	get deletable() {
		return this.guild.roles.cache.size && this.permissionOverwrites.size ? this.permissionsFor(this.client.user).has(Discord.Permissions.FLAGS.MANAGE_CHANNELS, false) : false;
	}
}

const RM = require("discord.js/src/managers/ReactionManager.js");
require.cache[require.resolve("discord.js/src/managers/ReactionManager.js")].exports = class ReactionManager extends RM {
	fake(id) {
		return this.add({emoji:{id}},false);
	}
}

const Action = require("discord.js/src/client/actions/Action.js");
Action.prototype.getPayload = function(data, manager, id, partialType, cache) {
	const existing = manager.cache.get(id);
	if(!existing) {
		return manager.add(data, cache);
	}
	return existing;
}

const Discord = require("./classes.js");
const Handlers = require("./actions.js");

Discord.Client = class Client extends Discord.Client {
	constructor(options = {}) {
		options = Object.assign(
			{
				cacheChannels:false,
				cacheGuilds:true,
				cachePresences:false,
				cacheRoles:false,
				cacheOverwrites:false,
				cacheEmojis:false
			},
			options
		);
		super(options);
		Handlers(this);
	}
	incrementMaxListeners() {
		const maxListeners = this.getMaxListeners();
		if(maxListeners !== 0) {
			this.setMaxListeners(maxListeners + 1);
		}
	}
	decrementMaxListeners() {
		const maxListeners = this.getMaxListeners();
		if(maxListeners !== 0) {
			this.setMaxListeners(maxListeners - 1);
		}
	}
}

module.exports = Discord;