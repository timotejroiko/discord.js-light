const PacketHandlers = require(require.resolve("discord.js").replace("index.js","client/websocket/handlers"));
const disabledEvents = [
	"CHANNEL_CREATE", // 1 // 4096 for dm
	"CHANNEL_DELETE", // 1
	"CHANNEL_PINS_UPDATE", // 1 // 4096 for dm
	"CHANNEL_UPDATE", // 1
	"GUILD_BAN_ADD", // 4
	"GUILD_BAN_REMOVE", // 4
	"GUILD_CREATE", // 1
	//"GUILD_DELETE", // 1
	"GUILD_EMOJIS_UPDATE", // 8
	"GUILD_INTEGRATIONS_UPDATE", // 16
	"GUILD_MEMBERS_CHUNK", // passthrough // requires guild members priviledge
	"GUILD_MEMBER_ADD", // 2 // requires guild members priviledge
	"GUILD_MEMBER_REMOVE", // 2 // requires guild members priviledge
	"GUILD_MEMBER_UPDATE", // 2 // requires guild members priviledge
	"GUILD_ROLE_CREATE", // 1
	"GUILD_ROLE_DELETE", // 1
	"GUILD_ROLE_UPDATE", // 1
	"GUILD_UPDATE", // passthrough // probably implies guilds
	"INVITE_CREATE", // 64
	"INVITE_DELETE", // 64
	"MESSAGE_CREATE", // 512 // 4096 for dm
	"MESSAGE_DELETE", // 512 // 4096 for dm
	"MESSAGE_DELETE_BULK", // passthrough ?
	"MESSAGE_REACTION_ADD", // 1024 // 8192 for dm
	"MESSAGE_REACTION_REMOVE", // 1024 // 8192 for dm
	"MESSAGE_REACTION_REMOVE_ALL", // 1024 // 8192 for dm
	"MESSAGE_REACTION_REMOVE_EMOJI", // 1024 // 8192 for dm
	"MESSAGE_UPDATE", // 512 // 4096 for dm
	"PRESENCE_UPDATE", // 256 // requires presences priviledge
	//"READY",
	//"RESUMED",
	"TYPING_START", // 2048 // 16384 for dm
	"USER_UPDATE", // passthrough
	//"VOICE_SERVER_UPDATE", // passthrough // client voice channel
	"VOICE_STATE_UPDATE", // 128
	"WEBHOOKS_UPDATE" // 32
];

for(let event of disabledEvents) {
	delete PacketHandlers[event];
}

const { Error, TypeError, RangeError } = require(require.resolve("discord.js").replace("index.js","errors"));
const Discord = require('discord.js');
const util = require('util');

module.exports = Discord;

Discord.Structures.extend("Message", M => {
	return class Message extends M {
		constructor(client, data, channel) {
			let d = {};
			let list = ["author","member","mentions","mention_roles"];
			for(let i in data) {
				if(!list.includes(i)) { d[i] = data[i]; }
			}
			super(client, d, channel);
			if(data.author) {
				if(data.author instanceof Discord.User) {
					this.author = data.author;
				} else {
					this.author = client.users.cache.get(data.author.id) || client.users.add(data.author,false);
				}
			}
			if(data.member && this.guild && !this.guild.members.cache.has(data.author.id)) {
				if(data.member instanceof Discord.GuildMember) {
					this._member = data.member;
				} else {
					this._member = this.guild.members.add(Object.assign(data.member,{user:this.author}),false);
				}
			}
			if(data.mentions && data.mentions.length) {
				for(let mention of data.mentions) {
					this.mentions.users.set(mention.id,client.users.cache.get(mention.id) || client.users.add(mention,false));
					if(mention.member && this.guild) {
						if(!this.mentions._members) { this.mentions._members = {} }
						this.mentions._members[mention.id] = mention.member;
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
			return this.guild ? this.guild.members.cache.get((this.author || {}).id) || this._member || null : null;
		}
		get pinnable() {
			return (this.type === 'DEFAULT' && (!this.guild || !this.guild.roles.cache.size || this.channel.permissionsFor(this.client.user).has(Discord.Permissions.FLAGS.MANAGE_MESSAGES, false)));
		}
		get deletable() {
			return (!this.deleted && (this.author.id === this.client.user.id ||	(this.guild && this.guild.roles.cache.size && this.channel.permissionsFor(this.client.user).has(Discord.Permissions.FLAGS.MANAGE_MESSAGES, false))));
		}
		async reply(content,options = {}) {
			if(content && typeof content === "object" && typeof content.then === "function") { content = {Promise:await content}; }
			if(content && typeof content === "object") {
				if(content.Promise) {
					let obj = util.inspect(content.Promise,{getters: true, depth: 2 }).replace(/  /g,"\t\t").replace(/`/g,"\\`");
					if(obj.length > 1950) { obj = util.inspect(content.Promise,{getters: true, depth: 1 }).replace(/  /g,"\t\t").replace(/`/g,"\\`"); }
					if(obj.length > 1950) { obj = util.inspect(content.Promise,{getters: true, depth: 0 }).replace(/  /g,"\t\t").replace(/`/g,"\\`"); }
					content = "```js\n<Promise> " + obj + "```";
				} else {
					let obj = util.inspect(content,{getters: true, depth: 2 }).replace(/  /g,"\t\t").replace(/`/g,"\\`");
					if(obj.length > 1950) { obj = util.inspect(content,{getters: true, depth: 1 }).replace(/  /g,"\t\t").replace(/`/g,"\\`"); }
					if(obj.length > 1950) { obj = util.inspect(content,{getters: true, depth: 0 }).replace(/  /g,"\t\t").replace(/`/g,"\\`"); }
					content = "```js\n" + obj + "```";
				}
			}
			if(typeof content !== "string") { content = content+""; }
			if(content && content.length > 1950 && !options.split) {
				content = `${content.substring(0, 1950)}\n\n ... and ${content.slice(1950).split("\n").length} more lines ${content.startsWith("```") ? "```" : ""}`;
			}
			if(!content && !options.content && !options.embed && !options.files) {
				content = "⠀";
			}
			if(!this.client.channels.cache.has(this.channel.id)) {
				this.channel = await this.client.channels.fetch(this.channel.id);
			}
			if(this.member && !this.channel.guild.members.cache.has(this.author.id)) {
				this.guild.members.cache.set(this.member.id,this.member);
			}
			if(!this.client.users.cache.has(this.author.id)) {
				this.author = this.client.users.add(this.author);
			}
			if(!this.channel.messages.cache.has(this.id)) {
				this.channel.messages.cache.set(this.id,this);
			}
			if(this.editedTimestamp && this.commandResponse) {
				if(this.commandResponse.attachments.size || options.files) {
					let response = await this.channel.send(content,options);
					if(!this.commandResponse.deleted) { this.commandResponse.delete().catch(e => {}); }
					this.commandResponse = response;
				} else {
					if(this.commandResponse.embeds.length && !options.embed) {
						options.embed = null;
					}
					this.commandResponse = await this.commandResponse.edit(content,options);
				}
			} else {
				this.commandResponse = await this.channel.send(content,options);
			}
			this.commandResponse.commandMessage = this;
			this.commandResponse.commandResponseTime = (this.commandResponse.editedTimestamp || this.commandResponse.createdTimestamp) - (this.editedTimestamp || this.createdTimestamp);
			this.author.lastActive = Date.now();
			return this.commandResponse;
		}
		async eval(f) {
			let client = this.client;
			try {
				let _TEST_ = eval(`(()=>{
					return ${f}
				})()`);
				return typeof _TEST_ === "object" && typeof _TEST_.then === "function" ? {Promise:await _TEST_} : _TEST_;
			} catch(e) {}
			try {
				return await eval(`(async()=>{
					return ${f}
				})()`);
			} catch(e) {}
			try {
				let _TEST_ = eval(`(()=>{
					${f}
				})()`);
				return typeof _TEST_ === "object" && typeof _TEST_.then === "function" ? {Promise:await _TEST_} : _TEST_;
			} catch(e) {}
			try {
				return await eval(`(async() => {
					${f}
				})()`);
			} catch(e) {
				return e;
			}
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
			if(data.user) {
				if(data.user instanceof Discord.User) {
					if(data._cache && !client.users.cache.has(data.user.id)) { client.users.cache.set(data.user.id, data.user); }
					this.user = data.user;
				} else {
					this.user = client.users.add(data.user, Boolean(data._cache));
				}
			}
		}
		equals(member) {
			let equal = member && this.deleted === member.deleted && this.nickname === member.nickname && this._roles.length === member._roles.length;
			return equal;
		}
	}
});

Discord.Structures.extend("Guild", G => {
	return class Guild extends G {
		get nameAcronym() {
			return this.name ? this.name.replace(/\w+/g, name => name[0]).replace(/\s/g, '') : undefined;
		}
		get joinedAt() {
			return this.joinedTimestamp ? new Date(this.joinedTimestamp) : undefined;
		}
	}
});

Discord.Structures.extend("TextChannel", T => {
	return class TextChannel extends T {
		get deletable() {
			return this.guild.roles.cache.size ? this.permissionsFor(this.client.user).has(Discord.Permissions.FLAGS.MANAGE_CHANNELS, false) : undefined;
		}
		async send(content, options) {
			if(!this.client.channels.cache.has(this.id)) { await this.fetch(); }
			this.lastActive = Date.now();
			return super.send(content, options);
		}
	}
});

Discord.Structures.extend("VoiceChannel", V => {
	return class VoiceChannel extends V {
		get joinable() {
			if(Discord.Constants.browser) return false;
			if(!this.guild.roles.cache.size && !this.client.options.enablePermissions) return true;
			if(!this.viewable) return false;
			if(!this.permissionsFor(this.client.user).has(Discord.Permissions.FLAGS.CONNECT, false)) return false;
			if(this.full && !this.permissionsFor(this.client.user).has(Discord.Permissions.FLAGS.MOVE_MEMBERS, false)) return false;
			return true;
		}
		async join() {
			if(Discord.Constants.browser) return Promise.reject(new Error('VOICE_NO_BROWSER'));
			let channel = await this.client.channels.fetch(this.id);
			channel.noSweep = true;
			return this.client.voice.joinChannel(channel);
		}
		leave() {
			if(Discord.Constants.browser) return;
			const connection = this.client.voice.connections.get(this.guild.id);
			if(connection && connection.channel.id === this.id) { connection.disconnect(); }
			this.noSweep = false;
		}
	}
});

Discord.Structures.extend("DMChannel", D => {
	return class DMChannel extends D {
		_patch(data) {
			let d = {}
			for(let i in data) {
				if(i !== "recipients") { d[i] = data[i]; }
			}
			super._patch(d);
			if(data.recipients) {
				this.recipient = this.client.users.cache.get(data.recipients[0].id) || this.client.users.add(data.recipients[0],false);
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
			const PartialGroupDMChannel = require('./PartialGroupDMChannel');
			channel = new PartialGroupDMChannel(client, data);
		}
	} else {
		guild = guild || client.guilds.cache.get(data.guild_id) || client.guilds.add({id:data.guild_id,shardID:data.shardID},false);
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

Discord.ChannelManager.prototype.add = function(data, guild, cache = true) {
	if(data.permission_overwrites && !data._withOverwrites && !this.client.options.enablePermissions) {
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
		if(channel.guild) {
			channel.guild.channels.add(channel);
		}
	}
	return channel;
}

Discord.ChannelManager.prototype.fetch = async function(id, cache = true, withOverwrites) {
	let existing = this.cache.get(id);
	if(existing && !existing.partial && (!existing.guild || !withOverwrites || existing.permissionOverwrites.size)) { return existing; }
	let data = await this.client.api.channels(id).get();
	if(withOverwrites !== undefined) { data._withOverwrites = Boolean(withOverwrites); }
	return this.add(data, null, cache);
}

Discord.GuildChannelManager.prototype.fetch = async function(id, cache = true, withOverwrites) {
	if(arguments.length < 3 && typeof arguments[0] !== "string") {
		withOverwrites = arguments[1];
		cache = arguments[0] || true;
	}
	if(id) {
		let existing = this.cache.get(id);
		if(existing && !existing.partial && (!withOverwrites || existing.permissionOverwrites.size)) { return existing; }
	}
	let channels = await this.client.api.guilds(this.guild.id).channels().get();
	if(id) {
		let c = channels.find(t => t.id === id);
		if(!c) { throw new Discord.DiscordAPIError(this.client.api.guilds(this.guild.id).channels() + ":id", {message:"Unknown Channel",code: 10003}, "GET", 404) }
		if(withOverwrites) { c._withOverwrites = true; }
		return this.client.channels.add(c, this.guild, cache);
	}
	if(cache) {
		for(let channel of channels) {
			if(withOverwrites) { channel._withOverwrites = true; }
			let c = this.client.channels.add(channel, this.guild);
		}
		return this.cache;
	} else {
		let collection = new Discord.Collection();
		for(let channel of channels) {
			if(withOverwrites) { channel._withOverwrites = true; }
			let c = this.client.channels.add(channel, this.guild, false);
			collection.set(c.id, c);
		}
		return collection;
	}
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
	if(typeof options.id === "string" && typeof options.rest === undefined) { options.rest = true; }
	if(options.rest) {
		if(typeof options.id === "string") {
			let existing = this.cache.get(options.id);
			if(existing && !existing.partial) return Promise.resolve(existing);
			let member = await this.client.api.guilds(this.guild.id).members(options.id).get();
			return this.add(member, options.cache);
		} else {
			let c = new Discord.Collection();
			let l = options.limit > 1000 ? 1000 : options.limit || 1000;
			let members = await this.client.api.guilds(this.guild.id).members().get({query:{limit:l,after:options.after || 0}});
			while(members.length) {
				for(let member of members) {
					c.set(member.user.id, this.add(member, options.cache));
					if(options.limit && c.size >= options.limit) { return c; }
				}
				members = members.length === 1000 && (!options.limit || c.size < options.limit) ? await this.client.api.guilds(this.guild.id).members().get({query:{limit:1000,after:c.last()}}) : [];
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

Discord.GuildManager.prototype.fetch = async function(id, cache) {
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
			let guild = await this.client.api.guilds(options.id).get({query:{with_counts:true}});
			return this.add(guild, options.cache || this.cache.has(options.id));
		}
	} else {
		let c = new Discord.Collection();
		let l = options.limit > 100 ? 100 : options.limit || 100;
		let guilds = await this.client.api.users("@me").guilds().get({query:{limit:l,after:options.after || 0,before:options.before || 0}});
		while(guilds.length) {
			for(let guild of guilds) {
				c.set(guild.id, this.add(guild,options.cache || this.cache.has(guild.id)));
				if(options.limit && c.size >= options.limit) { return c; }
			}
			guilds = guilds.length === 100 && (!options.limit || c.size < options.limit) ? await this.client.api.users("@me").guilds().get({query:{limit:100,after:c.last(),before:options.before || 0}}) : [];
		}
		return options.cache && !options.limit ? this.cache : c;
	}
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

Discord.VoiceState.prototype._patch = function(data) {
	Object.getPrototypeOf(this.constructor.prototype)._patch.call(this, data);
	if(data.member && data.member.user && !this.guild.members.cache.has(data.member.user.id)) {
		this._member = data.member;
	}
}

Object.defineProperty(Discord.VoiceState.prototype, "channel", {
	get: function() {
		return this.client.channels.cache.get(this.channelID) || this.client.channels.add({id:this.channelID,type:2}, this.guild, false);
	}
});

Object.defineProperty(Discord.VoiceState.prototype, "member", {
	get: function() {
		return this.guild.members.cache.get(this.id) || this.guild.members.add(this._member,false);
	}
});

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