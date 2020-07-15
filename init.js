const { resolve } = require("path");

const GCPath = resolve(require.resolve("discord.js").replace("index.js","/structures/GuildChannel.js"));
const GC = require(GCPath);
require.cache[GCPath].exports = class GuildChannel extends GC {
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

const RMPath = resolve(require.resolve("discord.js").replace("index.js","/managers/ReactionManager.js"));
const RM = require(RMPath);
require.cache[RMPath].exports = class ReactionManager extends RM {
	forge(id) {
		let emoji = {};
		id.length > 16 ? emoji.id = id : emoji.name = id;
		return this.add({emoji},false);
	}
}

const Action = require(resolve(require.resolve("discord.js").replace("index.js","/client/actions/Action.js")));
Action.prototype.getPayload = function(data, manager, id, partialType, cache) {
	return manager.cache.get(id) || manager.add(data, cache);
}