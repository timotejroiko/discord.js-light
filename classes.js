const { Error, RangeError } = require("discord.js/src/errors");
const Discord = require("discord.js");

Discord.Structures.extend("Message", M => {
	return class Message extends M {
		_patch(data) {
			let d = {};
			for(let i in data) {
				if(!["author","member","mentions","mention_roles"].includes(i)) { d[i] = data[i]; }
			}
			super._patch(d);
			this.author = data.author ? this.client.users.add(data.author, this.client.users.cache.has(data.author.id)) : null;
			if(data.member && this.guild && this.author) {
				if(this.guild.members.cache.has(this.author.id)) {
					this.member._patch(data.member);
				} else {
					this._member = this.guild.members.add(Object.assign(data.member,{user:this.author}),false);
				}
			}
			this.mentions = new Discord.MessageMentions(this,null,null, data.mention_everyone, data.mention_channels);
			this.mentions._members = {};
			if(data.mentions && data.mentions.length) {
				for(let mention of data.mentions) {
					this.mentions.users.set(mention.id,this.client.users.add(mention,this.client.users.cache.has(mention.id)));
					if(mention.member && this.guild) {
						if(this.client.users.cache.has(mention.id)) {
							if(this.guild.members.cache.has(mention.id)) {
								this.guild.members.cache.get(mention.id)._patch(mention.member);
							} else {
								this.guild.members.add(mention.member);
							}
						} else {
							this.mentions._members[mention.id] = mention.member;
						}
					}
				}
			}
			if(data.mention_roles && data.mention_roles.length && this.guild) {
				for(let role of data.mention_roles) {
					this.mentions.roles.set(role,this.guild.roles.cache.get(role) || this.guild.roles.add({id:role},false));
				}
			}
		}
		get member() {
			if(!this.guild) { return null; }
			return this.guild.members.cache.get((this.author || {}).id || (this._member || {}).id) || this._member || null;
		}
		get pinnable() {
			if(this.guild && (!this.guild.roles.cache.size || !this.channel.permissionOverwrites.size)) { return false; }
			return this.type === Discord.Constants.MessageTypes[0] && (!this.guild || this.channel.permissionsFor(this.client.user).has(Discord.Permissions.FLAGS.MANAGE_MESSAGES, false));
		}
		get deletable() {
			if(!this.guild || !this.guild.roles.cache.size || !this.channel.permissionOverwrites.size) { return false; }
			return !this.deleted && (this.author.id === this.client.user.id || (this.guild && this.channel.permissionsFor(this.client.user).has(Discord.Permissions.FLAGS.MANAGE_MESSAGES, false)));
		}
	}
});

Discord.Structures.extend("GuildMember", G => {
	return class GuildMember extends G {
		constructor(client, data, guild) {
			let d = {};
			for(let i in data) {
				if(i !== "user") { d[i] = data[i]; }
			}
			super(client, d, guild);
			if(data.user) { this.user = client.users.add(data.user, data._cache || client.users.cache.has(data.user.id)); }
		}
		_patch(data) {
			let d = {};
			for(let i in data) {
				if(i !== "user") { d[i] = data[i]; }
			}
			super._patch(d);
			if(data.user) { this.user = this.client.users.add(data.user, data._cache || this.client.users.cache.has(data.user.id)); }
		}
		equals(member) {
			return member && this.deleted === member.deleted && this.nickname === member.nickname && this.roles.cache.size === member.roles.cache.size;
		}
	}
});

Discord.Structures.extend("Guild", G => {
	return class Guild extends G {
		_patch(data) {
			this.shardID = data.shardID;
			if(!this.emojis) { this.emojis = new Discord.GuildEmojiManager(this); }
			let d = {};
			for(let key in data) {
				if(!["channels","roles","members","presences","voice_states","emojis"].includes(key)) {
					d[key] = data[key];
				}
			}
			super._patch(d);
			if(data.approximate_member_count) {
				this.approximateMemberCount = data.approximate_member_count;
				this.approximatePresenceCount = data.approximate_presence_count;
				if(!this.memberCount) { this.memberCount = data.approximate_member_count; }
			}
			if(data.channels && Array.isArray(data.channels)) {
				if(this.client.options.cacheChannels) { this.channels.cache.clear(); }
				for(let channel of data.channels) {
					if(this.client.options.cacheChannels || this.client.channels.cache.has(channel.id) || (this.client.options.ws.intents & 128 && data.voice_states && data.voice_states.find(v => v.channel_id === channel.id))) {
						this.client.channels.add(channel, this);
					}
				}
			}
			if(data.roles && Array.isArray(data.roles) && (this.roles.cache.size || this.client.options.cacheRoles)) {
				this.roles.cache.clear();
				for(let role of data.roles) {
					this.roles.add(role);
				}
			}
			if(data.members && Array.isArray(data.members)) {
				for(let member of data.members) {
					if(this.client.users.cache.has(member.user.id)) {
						this.members.add(member);
					}
				}
				if(!this.members.cache.has(this.client.user.id)) {
					this.members.add({user:this.client.user});
				}
			}
			if(data.presences && Array.isArray(data.presences)) {
				for(let presence of data.presences) {
					if(this.client.users.cache.has(presence.user.id) || this.client.options.cachePresences) {
						this.presences.add(Object.assign(presence, { guild: this }));
					}
				}
			}
			if(data.voice_states && Array.isArray(data.voice_states) && this.client.options.ws.intents & 128) {
				this.voiceStates.cache.clear();
				for(let voiceState of data.voice_states) {
					this.voiceStates.add(voiceState);
				}
			}
			if(data.emojis && Array.isArray(data.emojis) && (this.emojis.cache.size || this.client.options.cacheEmojis)) {
				this.client.actions.GuildEmojisUpdate.handle({
					guild_id: this.id,
					emojis: data.emojis,
				});
			}
		}
		get nameAcronym() {
			return this.name ? this.name.replace(/\w+/g, name => name[0]).replace(/\s/g, '') : undefined;
		}
		get joinedAt() {
			return this.joinedTimestamp ? new Date(this.joinedTimestamp) : undefined;
		}
		fetchBan(user) {
			let id = this.client.users.resolveID(user);
			if(!id) throw new Error('FETCH_BAN_RESOLVE_ID');
			return this.client.api.guilds(this.id).bans(id).get().then(ban => ({
				reason: ban.reason,
				user: this.client.users.add(ban.user, this.client.users.cache.has(ban.user.id))
			}));
		}
		fetchBans() {
			return this.client.api.guilds(this.id).bans.get().then(bans =>
				bans.reduce((collection, ban) => {
					collection.set(ban.user.id, {
						reason: ban.reason,
						user: this.client.users.add(ban.user, this.client.users.cache.has(ban.user.id)),
					});
					return collection;
				}, new Discord.Collection())
			);
		}
		fetch() {
			return this.client.api.guilds(this.id+"?with_counts=true").get().then(data => {
				this._patch(data);
				return this;
			});
		}
	}
});

Discord.Structures.extend("VoiceChannel", V => {
	return class VoiceChannel extends V {
		get joinable() {
			if(Discord.Constants.browser) return false;
			if((!this.guild.roles.cache.size && !this.client.options.cacheRoles) || (!this.permissionOverwrites.size && !this.client.options.cacheOverwrites)) return true;
			if(!this.viewable) return false;
			if(!this.permissionsFor(this.client.user).has(Discord.Permissions.FLAGS.CONNECT, false)) return false;
			if(this.full && !this.permissionsFor(this.client.user).has(Discord.Permissions.FLAGS.MOVE_MEMBERS, false)) return false;
			return true;
		}
		async join() {
			if(Discord.Constants.browser) return Promise.reject(new Error('VOICE_NO_BROWSER'));
			let channel = await this.client.channels.fetch(this.id);
			return this.client.voice.joinChannel(channel);
		}
		leave() {
			if(Discord.Constants.browser) return;
			const connection = this.client.voice.connections.get(this.guild.id);
			if(connection && connection.channel.id === this.id) { connection.disconnect(); }
			if(!this.client.options.cacheChannels) { this.client.channels.remove(this.id); }
		}
	}
});

Discord.Structures.extend("DMChannel", D => {
	return class DMChannel extends D {
		_patch(data) {
			let d = {};
			for(let i in data) {
				if(i !== "recipients") { d[i] = data[i]; }
			}
			super._patch(d);
			if(data.recipients) {
				this.recipient = this.client.users.add(data.recipients[0], this.client.users.cache.has(data.recipients[0].id));
			}
		}
	}
});

Discord.Channel.create = (client, data, guild) => {
	let channel;
	if(!data.guild_id && !guild) {
		if((data.recipients && data.type !== Discord.Constants.ChannelTypes.GROUP) || data.type === Discord.Constants.ChannelTypes.DM) {
			const DMChannel = Discord.Structures.get('DMChannel');
			channel = new DMChannel(client, data);
		} else if(data.type === Discord.Constants.ChannelTypes.GROUP) {
			const PartialGroupDMChannel = require('discord.js/src/structures/PartialGroupDMChannel.js');
			channel = new PartialGroupDMChannel(client, data);
		}
	} else {
		if(!(guild instanceof Discord.Guild)) {
			guild = client.guilds.cache.get(data.guild_id) || client.guilds.add({id:data.guild_id,shardID:data.shardID},false);
		}
		if(guild) {
			switch(data.type) {
				case Discord.Constants.ChannelTypes.TEXT: {
					let TextChannel = Discord.Structures.get('TextChannel');
					channel = new TextChannel(guild, data);
					break;
				}
					case Discord.Constants.ChannelTypes.VOICE: {
					let VoiceChannel = Discord.Structures.get('VoiceChannel');
					channel = new VoiceChannel(guild, data);
					break;
				}
					case Discord.Constants.ChannelTypes.CATEGORY: {
					let CategoryChannel = Discord.Structures.get('CategoryChannel');
					channel = new CategoryChannel(guild, data);
					break;
				}
					case Discord.Constants.ChannelTypes.NEWS: {
					let NewsChannel = Discord.Structures.get('NewsChannel');
					channel = new NewsChannel(guild, data);
					break;
				}
					case Discord.Constants.ChannelTypes.STORE: {
					let StoreChannel = Discord.Structures.get('StoreChannel');
					channel = new StoreChannel(guild, data);
					break;
				}
			}
		}
	}
	return channel;
}

Discord.GuildAuditLogs.build = (guild,data) => {
	delete data.users;
	const logs = new Discord.GuildAuditLogs(guild,data);
	return Promise.all(logs.entries.map(e => e.target)).then(() => logs);
}

Discord.Invite.prototype._patch = function(data) {
	let d = {};
	for(let i in data) {
		if(!["inviter","target_user","guild","channel"].includes(i)) { d[i] = data[i]; }
	}
	Object.getPrototypeOf(this.constructor.prototype)._patch.call(this, data);
	this.inviter = data.inviter ? this.client.users.add(data.inviter,this.client.users.cache.has(data.inviter.id)) : null;
	this.targetUser = data.target_user ? this.client.users.add(data.target_user,this.client.users.cache.has(data.target_user.id)) : null;
	this.guild = data.guild instanceof Discord.Guild ? data.guild : this.client.guilds.add(data.guild, this.client.guilds.cache.has(data.guild.id));
	this.channel = data.channel instanceof Discord.Channel ? data.channel : this.client.channels.add(data.channel, this.guild, this.client.channels.cache.has(data.channel.id));
}

Discord.UserManager.prototype.forge = function(id) {
	return this.add({id},false);
}

Discord.GuildManager.prototype.fetch = async function(id, cache = true) {
	let options = {};
	switch(typeof cache) {
		case "boolean": options.cache = cache; break;
		case "object": options = cache; break;
	}
	switch(typeof id) {
		case "string": options.id = id; break;
		case "boolean": options.cache = id; break;
		case "object": options = id; break;
	}
	if(options.cache === undefined) { options.cache = true; }
	if(options.id) {
		let existing = this.cache.get(options.id);
		if(existing && existing.name) {
			return existing;
		} else {
			let guild = await this.client.api.guilds(options.id+"?with_counts=true").get();
			return this.add(guild, options.cache || this.cache.has(options.id));
		}
	} else {
		let c = new Discord.Collection();
		let l = options.limit > 100 ? 100 : options.limit || 100;
		let guilds = await this.client.api.users("@me")[`guilds?limit=${l}&after=${options.after || 0}&before=${options.before || 0}`].get();
		while(guilds.length) {
			for(let guild of guilds) {
				c.set(guild.id, this.add(guild,options.cache || this.cache.has(guild.id)));
				if(options.limit && c.size >= options.limit) { return c; }
			}
			guilds = guilds.length === 100 && (!options.limit || c.size < options.limit) ? await this.client.api.users("@me")[`guilds?limit=100&after=${c.last()}&before=${options.before || 0}`].get() : [];
		}
		return options.cache && !options.limit ? this.cache : c;
	}
}

Discord.GuildManager.prototype.forge = function(id) {
	return this.add({id},false);
}

Discord.ChannelManager.prototype.add = function(data, guild, cache = true) {
	if(data.permission_overwrites && !data._withOverwrites && !this.client.options.cacheOverwrites) {
		let g = this.client.guilds.cache.get(data.guild_id);
		if(!g || !g.roles.cache.size) {
			data.permission_overwrites = [];
		}
	}
	const existing = this.cache.get(data.id);
	if(existing && !(data._withOverwrites && !existing.permissionOverwrites.size && !cache)) {
		if(existing._patch && cache) { existing._patch(data); }
		if(existing.guild) { existing.guild.channels.add(existing); }
		return existing;
	}
	const channel = Discord.Channel.create(this.client, data, guild);
	if(!channel) {
		this.client.emit(Discord.Constants.Events.DEBUG, `Failed to find guild, or unknown type for channel ${data.id} ${data.type}`);
		return null;
	}
	if(cache) {
		this.cache.set(channel.id, channel);
		let g = channel.guild;
		if(g && this.client.guilds.cache.has(g.id)) {
			this.client.guilds.cache.get(g.id).channels.add(channel);
		}
	}
	return channel;
}

Discord.ChannelManager.prototype.fetch = async function(id, cache) {
	let options = {};
	switch(typeof cache) {
		case "boolean": options.cache = cache; break;
		case "object": options = cache; break;
	}
	switch(typeof id) {
		case "string": options.id = id; break;
		case "boolean": options.cache = id; break;
		case "object": options = id; break;
	}
	if(options.cache === undefined) { options.cache = true; }
	let existing = this.cache.get(options.id);
	if(existing && !existing.partial && (!existing.guild || !options.withOverwrites || existing.permissionOverwrites.size)) { return existing; }
	let data = await this.client.api.channels(options.id).get();
	if(options.withOverwrites !== undefined) { data._withOverwrites = options.withOverwrites; }
	return this.add(data, null, options.cache);
}

Discord.ChannelManager.prototype.forge = function(id,type = "dm") {
	let g = null;
	let t = Discord.Constants.ChannelTypes[type.toUpperCase()];
	if(t !== 1) { g = this.client.guilds.add({id:"0"},false); }
	return this.add({id,type:t},g,false);
}

Discord.GuildChannelManager.prototype.fetch = async function(id, cache) {
	let options = {};
	switch(typeof cache) {
		case "boolean": options.cache = cache; break;
		case "object": options = cache; break;
	}
	switch(typeof id) {
		case "string": options.id = id; break;
		case "boolean": options.cache = id; break;
		case "object": options = id; break;
	}
	if(options.cache === undefined) { options.cache = true; }
	if(options.id) {
		let existing = this.cache.get(options.id);
		if(existing && !existing.partial && (!options.withOverwrites || existing.permissionOverwrites.size)) { return existing; }
	}
	let channels = await this.client.api.guilds(this.guild.id).channels().get();
	if(options.id) {
		let c = channels.find(t => t.id === options.id);
		if(!c) { throw new Discord.DiscordAPIError(this.client.api.guilds(this.guild.id).channels() + ":id", {message:"Unknown Channel"}, "GET", 404) }
		if(options.withOverwrites) { c._withOverwrites = true; }
		return this.client.channels.add(c, this.guild, options.cache);
	}
	if(options.cache) {
		for(let channel of channels) {
			if(options.withOverwrites) { channel._withOverwrites = true; }
			let c = this.client.channels.add(channel, this.guild);
		}
		return this.cache;
	} else {
		let collection = new Discord.Collection();
		for(let channel of channels) {
			if(options.withOverwrites) { channel._withOverwrites = true; }
			let c = this.client.channels.add(channel, this.guild, false);
			collection.set(c.id, c);
		}
		return collection;
	}
}

Discord.GuildChannelManager.prototype.forge = function(id,type) {
	return this.client.channels.add({id,type:Discord.Constants.ChannelTypes[type.toUpperCase()]},{id:this.guild.id,shardID:this.guild.shardID},false);
}

Discord.GuildMemberManager.prototype.add = function(data, cache = true) {
	data._cache = cache;
	return Object.getPrototypeOf(this.constructor.prototype).add.call(this, data, cache, { id: data.user.id, extras: [this.guild] });
}

Discord.GuildMemberManager.prototype.fetch = async function(id, cache) {
	let options = {};
	switch(typeof cache) {
		case "boolean": options.cache = cache; break;
		case "object": options = cache; break;
	}
	switch(typeof id) {
		case "string": options.id = id; break;
		case "boolean": options.cache = id; break;
		case "object": options = id; break;
	}
	if(options.cache === undefined) { options.cache = true; }
	if(options.rest) {
		if(typeof options.id === "string") {
			let existing = this.cache.get(options.id);
			if(existing && !existing.partial) return Promise.resolve(existing);
			let member = await this.client.api.guilds(this.guild.id).members(options.id).get();
			return this.add(member, options.cache);
		} else {
			let c = new Discord.Collection();
			let l = options.limit > 1000 ? 1000 : options.limit || 1000;
			let members = await this.client.api.guilds(this.guild.id)[`members?limit=${l}&after=${options.after || 0}`].get();
			while(members.length) {
				for(let member of members) {
					c.set(member.user.id, this.add(member, options.cache));
					if(options.limit && c.size >= options.limit) { return c; }
				}
				members = members.length === 1000 && (!options.limit || c.size < options.limit) ? await this.client.api.guilds(this.guild.id)["members?limit=1000&after="+c.last()].get() : [];
			}
			if(!options.limit && !this.guild.memberCount) { this.guild.memberCount = c.size; }
			return options.cache && fetched.size >= this.guild.memberCount ? this.cache : c;
		}
	} else {
		return new Promise((r,j) => {
			let user_ids = options.id || (Array.isArray(options.ids) ? options.ids : undefined);
			let query = options.query;
			let time = options.time || 60000;
			let limit = Number.isInteger(options.limit) ? options.limit : 0;
			let presences = options.withPresences || false;
			let nonce = Date.now().toString(16);
			if(nonce.length > 32) { return j(new RangeError('MEMBER_FETCH_NONCE_LENGTH')); }
			if(!query && !user_ids) { query = ""; }
			if(this.guild.memberCount === this.cache.size && !query && !limit && !presences && !user_ids) {
				return r(this.cache);
			}
			if(typeof user_ids === "string" && this.cache.has(user_ids)) {
				return r(this.cache.get(user_ids));
			}
			if(Array.isArray(user_ids) && user_ids.every(t => this.cache.has(t))) {
				return r(user_ids.map(t => this.cache.get(t)));
			}
			this.guild.shard.send({
				op: Discord.Constants.OPCodes.REQUEST_GUILD_MEMBERS,
				d: {
					guild_id: this.guild.id,
					presences,
					user_ids,
					query,
					nonce,
					limit,
				},
			});
			let fetched = new Discord.Collection();
			let i = 0;
			let failed = 0;
			let timeout = this.client.setTimeout(() => {
				this.client.removeListener(Discord.Constants.Events.GUILD_MEMBERS_CHUNK, handler);
				this.client.decrementMaxListeners();
				j(new Error('GUILD_MEMBERS_TIMEOUT'));
			}, time);
			let handler = (guild, data) => {
				if(data.nonce !== nonce) return;
				timeout.refresh();
				i++;
				if(data.not_found) { failed += data.not_found.length; }
				for(let member of data.members) {
					fetched.set(member.user.id, this.add(member, options.cache || this.client.users.cache.has(member.user.id)));
				}
				if(presences && data.presences) {
					for(let presence of data.presences) {
						if(this.client.options.cachePresences || this.client.users.cache.has(presence.user.id)) {
							this.guild.presences.add(Object.assign(presence, { guild: this.guild }));
						}
					}
				}
				if(
					fetched.size >= this.guild.memberCount ||
					(limit && fetched.size >= limit) ||
					(typeof user_ids === "string" && fetched.size + failed === 1) ||
					(Array.isArray(user_ids) && user_ids.length === fetched.size + failed) ||
					i === data.chunk_count
				) {
					this.client.clearTimeout(timeout);
					this.client.removeListener(Discord.Constants.Events.GUILD_MEMBERS_CHUNK, handler);
					this.client.decrementMaxListeners();
					if(typeof user_ids === "string") {
						let result = fetched.first();
						if(result) {
							r(result);
						} else {
							j(new Discord.DiscordAPIError("GUILD_MEMBERS_CHUNK", {message:"Unknown User"}, "Gateway"))
						}
					} else {
						if(!options.limit && !this.guild.memberCount) { this.guild.memberCount = fetched.size; }
						r(options.cache && fetched.size >= this.guild.memberCount ? this.cache : fetched);
					}
				}
			}
			this.client.incrementMaxListeners();
			this.client.on(Discord.Constants.Events.GUILD_MEMBERS_CHUNK, handler);
		});
	}
}

Discord.GuildMemberManager.prototype.forge = function(id) {
	return this.add({user:{id}},false);
}

Discord.GuildEmojiManager.prototype.fetch = async function(id, cache) {
	if(arguments.length < 2 && typeof id !== "string") { cache = id; }
	if(cache === undefined) { cache = true; }
	if(id) {
		let existing = this.cache.get(id);
		if(existing) { return existing; }
		let emoji = await this.client.api.guilds(this.guild.id).emojis(id).get();
		return this.add(emoji, cache);
	} else {
		let emojis = await this.client.api.guilds(this.guild.id).emojis().get();
		if(cache) {
			for(let emoji of emojis) {
				this.add(emoji);
			}
			return this.cache;
		} else {
			let collection = new Discord.Collection();
			for(let emoji of emojis) {
				collection.set(emoji.id, this.add(emoji, false));
			}
			return collection;
		}
	}
}

Discord.GuildEmojiManager.prototype.forge = function(id) {
	return this.add({id},false);
}

Discord.RoleManager.prototype.fetch = async function(id, cache) {
	if(arguments.length < 2 && typeof id !== "string") { cache = id; }
	if(cache === undefined) { cache = true; }
	if(id) {
		let existing = this.cache.get(id);
		if(existing) { return existing; }
	}
	let roles = await this.client.api.guilds(this.guild.id).roles.get();
	if(id) {
		let r = roles.find(t => t.id === id);
		if(!r) { throw new Discord.DiscordAPIError(this.client.api.guilds(this.guild.id).roles() + ":id", {message:"Unknown Role"}, "GET", 404) }
		return this.add(r, cache);
	} else if(cache) {
		for(let role of roles) {
			this.add(role);
		}
		return this.cache;
	} else {
		let collection = new Discord.Collection();
		for(let role of roles) {
			collection.set(role.id, this.add(role, false));
		}
		return collection;
	}
}

Discord.ReactionUserManager.prototype.fetch = async function({ limit = 100, after, before, cache = true } = {}) {
	let message = this.reaction.message;
	let data = await this.client.api.channels[message.channel.id].messages[message.id].reactions[this.reaction.emoji.identifier].get({ query: { limit, before, after } });
	let users = new Discord.Collection();
	for(let rawUser of data) {
		let user = this.client.users.add(rawUser,this.client.users.cache.has(rawUser.id));
		this.cache.set(user.id, user);
		users.set(user.id, user);
	}
	return users;
}

Discord.RoleManager.prototype.forge = function(id) {
	return this.add({id},false);
}

Discord.MessageManager.prototype.forge = function(id) {
	return this.add({id},false);
}

Discord.PresenceManager.prototype.forge = function(id) {
	return this.add({user:{id}},false);
}

Object.defineProperty(Discord.RoleManager.prototype, "everyone", {
	get: function() {
		return this.cache.get(this.guild.id) || this.guild.roles.add({id:this.guild.id},false);
	}
});

Object.defineProperty(Discord.GuildMemberRoleManager.prototype, "_roles", {
	get: function() {
		let everyone = this.guild.roles.everyone;
		let roles = new Discord.Collection();
		roles.set(everyone.id, everyone);
		for(let role of this.member._roles) {
			roles.set(role, this.guild.roles.cache.get(role) || this.guild.roles.add({id:role},false));
		}
		return roles;
	}
});

Object.defineProperty(Discord.GuildEmojiRoleManager.prototype, "_roles", {
	get: function() {
		return this.guild.roles.cache.filter(role => this.emoji._roles.includes(role.id));
		let roles = new Discord.Collection();
		for(let role of this.emoji._roles) {
			roles.set(role, this.guild.roles.cache.get(role) || this.guild.roles.add({id:role},false));
		}
		return roles;
	}
});

Object.defineProperty(Discord.MessageMentions.prototype, "channels", {
	get: function() {
		this._channels = new Discord.Collection();
		let matches;
		while((matches = this.constructor.CHANNELS_PATTERN.exec(this._content)) !== null) {
			let chan = this.client.channels.cache.get(matches[1]) || this.client.channels.add({id:matches[1],type:this.guild?0:1}, this.guild, false);
			this._channels.set(chan.id, chan);
		}
		return this._channels;
	}
});

Object.defineProperty(Discord.MessageMentions.prototype, "members", {
	get: function() {
		if(!this.guild) return null;
		if(!this._members) { this._members = {}; }
		let members = new Discord.Collection();
		for(let id in this._members) {
			let member = this.guild.members.cache.get(id) || this.guild.members.add(Object.assign(this._members[id],{user:this.client.users.cache.get(id) || this.users.get(id)}),false);
			members.set(id,member);
		}
		return members
	}
});

module.exports = Discord;