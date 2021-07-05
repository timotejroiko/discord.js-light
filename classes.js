"use strict";

const { resolve } = require("path");
const { Error, RangeError } = require(resolve(require.resolve("discord.js").replace("index.js", "/errors")));
const PartialGroupDMChannel = require(resolve(require.resolve("discord.js").replace("index.js", "/structures/PartialGroupDMChannel.js")));
const Discord = require("discord.js");

Discord.Structures.extend("Message", M => {
	return class Message extends M {
		constructor(client, data, channel) {
			super(client, data, channel);
			if(!this.client.channels.cache.get(channel.id)) {
				this._channel = channel;
				Object.defineProperty(this, "channel", {
					enumerable: false,
					get: function() {
						return this.client.channels.cache.get(this._channel.id) || this._channel;
					}
				});
			}
		}
		patch(data) {
			const d = {};
			for(const i in data) {
				if(!["mentions", "mention_roles", "thread", "referenced_message"].includes(i)) { d[i] = data[i]; }
			}
			const clone = super.patch(d);
			if(data.mentions && data.mentions.length) {
				this.mentions.users.clear();
				this.mentions._members = [];
				for(const mention of data.mentions) {
					this.mentions.users.set(mention.id, this.client.users.add(mention, this.client.users.cache.has(mention.id)));
					if(mention.member && this.guild) {
						mention.member = Object.assign(mention.member, { user: mention });
						if(this.client.users.cache.has(mention.id)) {
							if(this.guild.members.cache.has(mention.id)) {
								this.guild.members.cache.get(mention.id)._patch(mention.member);
							} else {
								this.guild.members.add(mention.member);
							}
						} else {
							this.mentions._members.push(mention.member);
						}
					}
				}
			}
			if(data.mention_roles && data.mention_roles.length && this.guild) {
				this.mentions.roles.clear();
				for(const role of data.mention_roles) {
					this.mentions.roles.set(role, this.guild.roles.cache.get(role) || this.guild.roles.add({ id: role }, false));
				}
			}
			if(data.thread) {
				this.thread = this.client.channels.add(data.thread, null, this.client.options.cacheChannels || this.client.channels.cache.has(data.thread.id));
			}
			if(data.referenced_message) {
				const author = data.referenced_message.author;
				this.mentions.repliedUser = this.client.users.add(author, this.client.options.cacheMembers || this.client.users.cache.has(author.id));
			}
			return clone;
		}
		_patch(data) {
			const d = {};
			for(const i in data) {
				if(!["author", "member", "mentions", "mention_roles", "interaction", "thread", "referenced_message"].includes(i)) { d[i] = data[i]; }
			}
			super._patch(d);
			this.author = data.author ? this.client.users.add(data.author, this.client.options.cacheMembers || this.client.users.cache.has(data.author.id)) : null;
			if(data.member && this.guild && this.author) {
				const member = this.guild.members.add(Object.assign(data.member, { user: this.author }), this.client.options.cacheMembers || this.client.users.cache.has(data.author.id));
				if(!this.guild.members.cache.has(this.author.id)) {
					this._member = member;
				}
			}
			this.mentions = new Discord.MessageMentions(this, null, null, data.mention_everyone, data.mention_channels);
			this.mentions._members = [];
			if(data.mentions && data.mentions.length) {
				for(const mention of data.mentions) {
					this.mentions.users.set(mention.id, this.client.users.add(mention, this.client.users.cache.has(mention.id)));
					if(mention.member && this.guild) {
						mention.member = Object.assign(mention.member, { user: mention });
						if(this.client.users.cache.has(mention.id)) {
							if(this.guild.members.cache.has(mention.id)) {
								this.guild.members.cache.get(mention.id)._patch(mention.member);
							} else {
								this.guild.members.add(mention.member);
							}
						} else {
							this.mentions._members.push(mention.member);
						}
					}
				}
			}
			if(data.mention_roles && data.mention_roles.length && this.guild) {
				for(const role of data.mention_roles) {
					this.mentions.roles.set(role, this.guild.roles.cache.get(role) || this.guild.roles.add({
						id: role,
						permissions: 0
					}, false));
				}
			}
			if(data.interaction) {
				this.interaction = {
					id: data.interaction.id,
					type: Discord.Constants.InteractionTypes[data.interaction.type],
					commandName: data.interaction.name,
					user: this.client.users.add(data.interaction.user, this.client.options.cacheMembers || this.client.users.cache.has(data.author.id))
				};
			}
			if(data.thread) {
				this.thread = this.client.channels.add(data.thread, null, this.client.options.cacheChannels || this.client.channels.cache.has(data.thread.id));
			} else if(!this.thread) {
				this.thread = null;
			}
			if(data.referenced_message) {
				const author = data.referenced_message.author;
				this.mentions.repliedUser = this.client.users.add(author, this.client.options.cacheMembers || this.client.users.cache.has(author.id));
			}
		}
		get member() {
			if(!this.guild) { return null; }
			const id = (this.author || {}).id || (this._member || {}).id;
			if(!id) { return null; }
			return this.guild.members.cache.get(id) || this._member || null;
		}
		get pinnable() {
			if(this.type !== Discord.Constants.MessageTypes[0]) { return false; }
			if(!this.guild) { return true; }
			if(!this.client.options.cacheRoles || !this.client.options.cacheOverwrites) { return true; }
			return this.channel.permissionsFor(this.client.user).has(Discord.Permissions.FLAGS.MANAGE_MESSAGES, false);
		}
		get deletable() {
			if(this.deleted) { return false; }
			if(this.author.id === this.client.user.id) { return true; }
			if(!this.guild) { return false; }
			if(!this.client.options.cacheRoles || !this.client.options.cacheOverwrites) { return true; }
			return this.channel.permissionsFor(this.client.user).has(Discord.Permissions.FLAGS.MANAGE_MESSAGES, false);
		}
		get crosspostable() {
			if(this.channel.type !== "news" || this.type !== "DEFAULT" || this.flags.has(Discord.MessageFlags.FLAGS.CROSSPOSTED)) { return false; }
			if(!this.client.options.cacheRoles || !this.client.options.cacheOverwrites) { return true; }
			return this.channel.viewable &&	this.channel.permissionsFor(this.client.user).has(Discord.Permissions.FLAGS.SEND_MESSAGES) && (this.author.id === this.client.user.id || this.channel.permissionsFor(this.client.user).has(Discord.Permissions.FLAGS.MANAGE_MESSAGES));
		}
	};
});

Discord.Structures.extend("GuildMember", G => {
	return class GuildMember extends G {
		_patch(data) {
			const d = {};
			for(const i in data) {
				if(i !== "user") { d[i] = data[i]; }
			}
			super._patch(d);
			if(data.user) {
				this._userID = data.user.id;
				if(data.user.username) {
					const user = this.client.users.add(data.user, data._cache || this.client.options.cacheMembers || this.client.users.cache.has(data.user.id));
					if(!this.client.users.cache.has(user.id)) {
						this._user = user;
					}
				}
			}
		}
		get user() {
			if(!this._userID) { return null; }
			return this.client.users.cache.get(this._userID) || this._user || this.client.users.add({ id: this._userID }, false);
		}
		get presence() {
			if(!this.guild.presences.cache.has(this.id) && this._presence) {
				return this._presence;
			}
			return super.presence;
		}
	};
});

Discord.Structures.extend("Guild", G => {
	return class Guild extends G {
		_patch(data) {
			if(typeof this.shardID === "undefined" && typeof data.shardID !== "undefined") { this.shardID = data.shardID; }
			const d = {};
			const emojis = Boolean(this.emojis);
			for(const key in data) {
				if(!["channels", "roles", "members", "presences", "voice_states", "emojis", "threads"].includes(key)) {
					d[key] = data[key];
				}
			}
			super._patch(d);
			if(Array.isArray(data.channels)) {
				if(this.client.options.cacheChannels && data.channels.length) { this.channels.cache.clear(); }
				for(const channel of data.channels) {
					if(this.client.options.cacheChannels || this.client.channels.cache.has(channel.id)) {
						this.client.channels.add(channel, this);
					}
				}
			}
			if(Array.isArray(data.roles) && (this.roles.cache.size || this.client.options.cacheRoles)) {
				this.roles.cache.clear();
				for(const role of data.roles) {
					this.roles.add(role);
				}
			}
			if(Array.isArray(data.members)) {
				for(const member of data.members) {
					if(this.client.users.cache.has(member.user.id) || this.client.options.cacheMembers) {
						this.members.add(member);
					}
				}
				if(!this.members.cache.has(this.client.user.id)) {
					this.members.fetch(this.client.user.id).catch(() => {});
				}
			}
			if(Array.isArray(data.presences)) {
				for(const presence of data.presences) {
					if(this.client.users.cache.has(presence.user.id) || this.client.options.cachePresences) {
						this.presences.add(Object.assign(presence, { guild: this }));
					}
				}
			}
			if(Array.isArray(data.voice_states) && (!this.client.options.ws.intents || (this.client.options.ws.intents & Discord.Intents.FLAGS.GUILD_VOICE_STATES))) {
				this.voiceStates.cache.clear();
				for(const voiceState of data.voice_states) {
					this.voiceStates.add(voiceState);
				}
			}
			if(Array.isArray(data.emojis)) {
				if(emojis) {
					this.client.actions.GuildEmojisUpdate.handle({
						guild_id: this.id,
						emojis: data.emojis
					});
				} else if(this.client.options.cacheEmojis) {
					for(const emoji of data.emojis) {
						this.emojis.add(emoji);
					}
				}
			}
			if(Array.isArray(data.threads)) {
				for (const rawThread of data.threads) {
					if(this.client.options.cacheChannels || this.client.channels.cache.has(rawThread.id)) {
						this.client.channels.add(rawThread, this);
					}
				}
			}
		}
		get nameAcronym() {
			return this.name ? super.nameAcronym : void 0;
		}
		get joinedAt() {
			return this.joinedTimestamp ? super.joinedAt : void 0;
		}
		async fetchWidget() {
			const data = await this.client.api.guilds(this.id).widget.get();
			this.widgetEnabled = data.enabled;
			this.widgetChannelID = data.channel_id;
			return {
				enabled: data.enabled,
				channel: data.channel_id ? this.channels.cache.get(data.channel_id) || this.client.channels.add({
					id: data.channel_id,
					type: 0
				}, this, false) : null
			};
		}
	};
});

Discord.Structures.extend("GuildEmoji", E => {
	return class GuildEmoji extends E {
		constructor(client, data, guild) {
			super(client, data, guild);
			Object.defineProperty(this, "author", {
				enumerable: false,
				get: function() {
					return this._author ? this.client.users.cache.get(this._author) || this.client.users.add({ id: this._author }, false) : null;
				}
			});
		}
		_patch(data) {
			const d = {};
			for(const i in data) {
				if(i !== "user") { d[i] = data[i]; }
			}
			super._patch(d);
			if(typeof data.user !== "undefined") {
				this._author = data.user.id;
			}
		}
		async fetchAuthor(cache = true) {
			if(this.managed) {
				throw new Error("EMOJI_MANAGED");
			} else {
				if(!this.guild.me) { throw new Error("GUILD_UNCACHED_ME"); }
				if(this.guild.roles.cache.size && !this.guild.me.permissions.has(Discord.Permissions.FLAGS.MANAGE_EMOJIS)) {
					throw new Error("MISSING_MANAGE_EMOJIS_PERMISSION", this.guild);
				}
			}
			const data = await this.client.api.guilds(this.guild.id).emojis(this.id).get();
			this._patch(data);
			return this.client.users.add(data.user, cache);
		}
	};
});

Discord.Structures.extend("VoiceState", V => {
	return class VoiceState extends V {
		_patch(data) {
			super._patch(data);
			if(data.member && data.member.user && !this.guild.members.cache.has(data.member.user.id)) {
				this._member = data.member;
			}
			return this;
		}
		get channel() {
			return this.channelID ? this.client.channels.cache.get(this.channelID) || this.client.channels.add({
				id: this.channelID,
				type: 2
			}, this.guild, false) : null;
		}
		get member() {
			return this.guild.members.cache.get(this.id) || this.guild.members.add(this._member || { user: { id: this.id } }, false);
		}
	};
});

Discord.Structures.extend("VoiceChannel", V => {
	return class VoiceChannel extends V {
		get joinable() {
			if(!this.client.options.cacheRoles || !this.client.options.cacheOverwrites) { return true; }
			if(!this.viewable) { return false; }
			if(!this.permissionsFor(this.client.user).has(Discord.Permissions.FLAGS.CONNECT, false)) { return false; }
			if(this.full && !this.permissionsFor(this.client.user).has(Discord.Permissions.FLAGS.MOVE_MEMBERS, false)) { return false; }
			return true;
		}
	};
});

Discord.Structures.extend("StageChannel", V => {
	return class StageChannel extends V {
		get joinable() {
			if(!this.client.options.cacheRoles || !this.client.options.cacheOverwrites) { return true; }
			if(!this.viewable) { return false; }
			if(!this.permissionsFor(this.client.user).has(Discord.Permissions.FLAGS.CONNECT, false)) { return false; }
			return true;
		}
	};
});

Discord.Structures.extend("DMChannel", D => {
	return class DMChannel extends D {
		_patch(data) {
			const d = {};
			for(const i in data) {
				if(i !== "recipients") { d[i] = data[i]; }
			}
			super._patch(d);
			if(data.recipients) {
				this.recipient = this.client.users.add(data.recipients[0], this.client.users.cache.has(data.recipients[0].id));
			}
		}
	};
});

Discord.Structures.extend("Presence", P => {
	return class Presence extends P {
		patch(data) {
			super.patch(data);
			if(this.guild && !this.guild.members.cache.has(data.user.id)) {
				this._member = {
					user: data.user,
					roles: data.roles,
					nick: data.nick,
					premium_since: data.premium_since
				};
			}
			return this;
		}
		get user() {
			return this.client.users.cache.get(this.userID) || this.client.users.add((this._member || {}).user || { id: this.userID }, false);
		}
		get member() {
			if(!this.guild) { return null; }
			return this.guild.members.cache.get(this.userID) || this.guild.members.add(this._member || { user: { id: this.userID } }, false);
		}
	};
});

Discord.Structures.extend("ClientPresence", P => {
	return class ClientPresence extends P {
		get user() {
			return this.client.user;
		}
		get member() {
			return null;
		}
	};
});

Discord.Structures.extend("CommandInteraction", I => {
	return class CommandInteraction extends I {
		transformOption(option, resolved) {
			const result = {
				name: option.name,
				type: Discord.Constants.ApplicationCommandOptionTypes[option.type]
			};
			if("value" in option) { result.value = option.value; }
			if("options" in option) { result.options = option.options.map(o => this.transformOption(o, resolved)); }
			const user = resolved?.users?.[option.value];
			if(user) { result.user = this.client.users.add(user, this.client.options.cacheMembers || this.client.users.cache.has(user.id)); }
			const member = resolved?.members?.[option.value];
			if(member) {
				result.member = this.guild?.members.add({
					user,
					...member
				}, this.client.options.cacheMembers || this.client.users.cache.has(user.id)) ?? member;
			}
			const channel = resolved?.channels?.[option.value];
			if(channel) { result.channel = this.client.channels.add(channel, this.guild, this.client.options.cacheChannels || this.client.channels.cache.has(channel.id)) ?? channel; }
			const role = resolved?.roles?.[option.value];
			if(role) { result.role = this.guild?.roles.add(role, this.client.options.cacheRoles || this.guild?.roles.cache.size) ?? role; }
			return result;
		}
	};
});

Discord.Channel.create = (client, data, _guild) => {
	let channel;
	let guild = _guild;
	if(!data.guild_id && !guild) {
		if((data.recipients && data.type !== Discord.Constants.ChannelTypes.GROUP) || data.type === Discord.Constants.ChannelTypes.DM) {
			const DMChannel = Discord.Structures.get("DMChannel");
			channel = new DMChannel(client, data);
		} else if(data.type === Discord.Constants.ChannelTypes.GROUP) {
			channel = new PartialGroupDMChannel(client, data);
		}
	} else {
		if(!(guild instanceof Discord.Guild)) {
			guild = client.guilds.cache.get(data.guild_id) || client.guilds.add({
				id: data.guild_id,
				shardID: data.shardID
			}, false);
		}
		if(guild) {
			switch(data.type) {
				case Discord.Constants.ChannelTypes.TEXT: {
					const TextChannel = Discord.Structures.get("TextChannel");
					channel = new TextChannel(guild, data);
					break;
				}
				case Discord.Constants.ChannelTypes.VOICE: {
					const VoiceChannel = Discord.Structures.get("VoiceChannel");
					channel = new VoiceChannel(guild, data);
					break;
				}
				case Discord.Constants.ChannelTypes.CATEGORY: {
					const CategoryChannel = Discord.Structures.get("CategoryChannel");
					channel = new CategoryChannel(guild, data);
					break;
				}
				case Discord.Constants.ChannelTypes.NEWS: {
					const NewsChannel = Discord.Structures.get("NewsChannel");
					channel = new NewsChannel(guild, data);
					break;
				}
				case Discord.Constants.ChannelTypes.STORE: {
					const StoreChannel = Discord.Structures.get("StoreChannel");
					channel = new StoreChannel(guild, data);
					break;
				}
				case Discord.Constants.ChannelTypes.STAGE: {
					const StageChannel = Discord.Structures.get("StageChannel");
					channel = new StageChannel(guild, data);
					break;
				}
				case Discord.Constants.ChannelTypes.NEWS_THREAD:
				case Discord.Constants.ChannelTypes.PUBLIC_THREAD:
				case Discord.Constants.ChannelTypes.PRIVATE_THREAD: {
					const ThreadChannel = Discord.Structures.get("ThreadChannel");
					channel = new ThreadChannel(guild, data);
					channel.parent?.threads.cache.set(channel.id, channel);
					break;
				}
			}
		}
	}
	return channel;
};

Discord.GuildBan.prototype._patch = function(data) {
	this.user = this.client.users.add(data.user, this.client.users.cache.has(data.user.id));
	if("reason" in data) {
		this.reason = data.reason;
	}
};

Discord.Invite.prototype._patch = function(data) {
	this.code = data.code;
	this.presenceCount = "approximate_presence_count" in data ? data.approximate_presence_count : null;
	this.memberCount = "approximate_member_count" in data ? data.approximate_member_count : null;
	this.temporary = "temporary" in data ? data.temporary : null;
	this.maxAge = "max_age" in data ? data.max_age : null;
	this.uses = "uses" in data ? data.uses : null;
	this.maxUses = "max_uses" in data ? data.max_uses : null;
	this.targetUserType = typeof data.target_user_type === "number" ? data.target_user_type : null;
	this.createdTimestamp = "created_at" in data ? new Date(data.created_at).getTime() : null;
	this.inviter = data.inviter ? this.client.users.add(data.inviter, this.client.users.cache.has(data.inviter.id)) : null;
	this.targetUser = data.target_user ? this.client.users.add(data.target_user, this.client.users.cache.has(data.target_user.id)) : null;
	this.guild = data.guild ? data.guild instanceof Discord.Guild ? data.guild : this.client.guilds.add(data.guild, false) : null;
	this.channel = data.channel instanceof Discord.Channel ? data.channel : this.client.channels.add(data.channel, this.guild, false);
	this.stageInstance = data.stage_instance ? new Discord.InviteStageInstance(this.client, data.stage_instance, this.channel.id, this.guild?.id) : null;
};

Discord.GuildTemplate.prototype._patch = function(data) {
	this.code = data.code;
	this.name = data.name;
	this.description = data.description;
	this.usageCount = data.usage_count;
	this.creatorID = data.creator_id;
	this.creator = this.client.users.add(data.creator, this.client.users.cache.has(data.creator.id));
	this.createdAt = new Date(data.created_at);
	this.updatedAt = new Date(data.updated_at);
	this.guildID = data.source_guild_id;
	this.serializedGuild = data.serialized_source_guild;
	this.unSynced = "is_dirty" in data ? Boolean(data.is_dirty) : null;
	return this;
};

Discord.ClientApplication.prototype._patch = function(data) {
	this.id = data.id;
	this.name = data.name ?? this.name ?? null;
	this.description = data.description ?? this.description ?? null;
	this.icon = data.icon ?? this.icon ?? null;
	this.flags = "flags" in data ? new Discord.ApplicationFlags(data.flags).freeze() : this.flags;
	this.cover = data.cover_image ?? this.cover ?? null;
	this.rpcOrigins = data.rpc_origins ?? this.rpcOrigins ?? [];
	this.botRequireCodeGrant = data.bot_require_code_grant ?? this.botRequireCodeGrant ?? null;
	this.botPublic = data.bot_public ?? this.botPublic ?? null;
	this.owner = data.team ? new Discord.Team(this.client, data.team) : data.owner ? this.client.users.add(data.owner, this.client.users.cache.has(data.owner.id)) : this.owner ?? null;
	return this;
};

Discord.TeamMember.prototype._patch = function(data) {
	this.permissions = data.permissions;
	this.membershipState = Discord.Constants.MembershipStates[data.membership_state];
	this.user = this.client.users.add(data.user, this.client.users.cache.has(data.user.id));
	return this;
};

Discord.IntegrationApplication.prototype._patch = function(data) {
	this.id = data.id;
	this.name = data.name ?? this.name ?? null;
	this.description = data.description ?? this.description ?? null;
	this.icon = data.icon ?? this.icon ?? null;
	this.bot = data.bot ? this.client.users.add(data.bot, this.client.users.cache.has(data.bot.id)) : this.bot ?? null;
	return this;
};

Discord.Webhook.prototype._patch = function(data) {
	this.name = data.name;
	Object.defineProperty(this, "token", {
		value: data.token || null,
		writable: true,
		configurable: true
	});
	this.avatar = data.avatar;
	this.id = data.id;
	this.type = Discord.Constants.WebhookTypes[data.type];
	this.guildID = data.guild_id;
	this.channelID = data.channel_id;
	this.owner = data.user ? this.client.users?.add(data.user, this.client.users.cache.has(data.user.id)) ?? data.user : null;
	this.sourceGuild = data.source_guild ? this.client.guilds?.add(data.source_guild, false) ?? data.source_guild : null;
	this.sourceChannel = this.client.channels?.resolve(data.source_channel?.id) ?? data.source_channel ?? null;
};

/*
Discord.InviteStageInstance.prototype._patch = function(data) {
	this.topic = data.topic;
	this.participantCount = data.participant_count;
	this.speakerCount = data.speaker_count;
	this.members.clear();
	for (const rawMember of data.members) {
		const member = this.guild.members.add(rawMember, this.client.options.cacheMembers || this.client.users.cache.has(rawMember.id));
		this.members.set(member.id, member);
	}
};
*/

Discord.UserManager.prototype.forge = function(id) {
	return this.add({ id }, false);
};

Discord.GuildManager.prototype.forge = function(id) {
	return this.add({ id }, false);
};

Discord.ChannelManager.prototype.add = function(data, guild, cache = true) {
	if(data.permission_overwrites && !data._withOverwrites && !this.client.options.cacheOverwrites) {
		data.permission_overwrites = [];
	}
	const existing = this.cache.get(data.id);
	if(existing && !(data._withOverwrites && !existing.permissionOverwrites?.size && !cache)) {
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
		const g = channel.guild;
		if(g && (this.client.options.cacheGuilds || this.client.guilds.cache.has(g.id))) {
			g.channels.add(channel);
		}
	}
	return channel;
};

Discord.ChannelManager.prototype.fetch = async function(id, opts) {
	const options = typeof opts === "object" ? opts : {};
	if(typeof options.cache === "undefined") { options.cache = true; }
	const existing = this.cache.get(id);
	if(!options.force && existing && !existing.partial && (!existing.guild || !existing.permissionOverwrites || !options.withOverwrites || existing.permissionOverwrites.size)) { return existing; }
	const data = await this.client.api.channels(id).get();
	if(typeof options.withOverwrites !== "undefined") { data._withOverwrites = options.withOverwrites; }
	return this.add(data, null, options.cache);
};

Discord.ChannelManager.prototype.forge = function(id, type = "dm") {
	let g = null;
	const t = Discord.Constants.ChannelTypes[type.toUpperCase()];
	if(t !== 1) { g = this.client.guilds.add({ id: "0" }, false); }
	return this.add({
		id,
		type: t
	}, g, false);
};

Discord.GuildChannelManager.prototype.fetch = async function(id, cache) {
	let options = {};
	switch(typeof cache) {
		case "boolean": options.cache = cache; break;
		case "object": options = cache || {}; break;
	}
	switch(typeof id) {
		case "string": options.id = id; break;
		case "boolean": options.cache = id; break;
		case "object": options = id || {}; break;
	}
	if(typeof options.cache === "undefined") { options.cache = true; }
	if(options.id) {
		const existing = this.cache.get(options.id);
		if(!options.force && existing && !existing.partial && (!existing.permissionOverwrites || !options.withOverwrites || existing.permissionOverwrites.size)) { return existing; }
	}
	const channels = await this.client.api.guilds(this.guild.id).channels().get();
	if(options.id) {
		const c = channels.find(t => t.id === options.id);
		if(!c) {
			throw new Discord.DiscordAPIError({ message: "Unknown Channel" }, 404, {
				path: `${this.client.api.guilds(this.guild.id).channels()}:id`,
				method: "GET",
				options: {}
			});
		}
		if(options.withOverwrites) { c._withOverwrites = true; }
		return this.client.channels.add(c, this.guild, options.cache);
	}
	if(options.cache) {
		for(const channel of channels) {
			if(options.withOverwrites) { channel._withOverwrites = true; }
			this.client.channels.add(channel, this.guild);
		}
		return this.cache;
	}
	const collection = new Discord.Collection();
	for(const channel of channels) {
		if(options.withOverwrites) { channel._withOverwrites = true; }
		const c = this.client.channels.add(channel, this.guild, false);
		if(!c) { continue; }
		collection.set(c.id, c);
	}
	return collection;
};

Discord.GuildChannelManager.prototype.forge = function(id, type = "text") {
	return this.client.channels.add({
		id,
		type: Discord.Constants.ChannelTypes[type.toUpperCase()]
	}, this.guild, false);
};

Discord.GuildMemberManager.prototype.add = function(data, cache = true) {
	data._cache = cache;
	return Object.getPrototypeOf(this.constructor.prototype).add.call(this, data, cache, {
		id: data.user.id,
		extras: [this.guild]
	});
};

Discord.GuildMemberManager.prototype.fetch = async function(id, cache) {
	let options = {};
	switch(typeof cache) {
		case "boolean": options.cache = cache; break;
		case "object": options = cache || {}; break;
	}
	switch(typeof id) {
		case "string": options.user = id; break;
		case "boolean": options.cache = id; break;
		case "object": options = id || {}; break;
	}
	if(typeof options.user === "string" && typeof options.rest === "undefined" && !options.withPresences) { options.rest = true; }
	if(typeof options.cache === "undefined") { options.cache = true; }
	if(options.rest) {
		if(typeof options.user === "string") {
			const existing = this.cache.get(options.user);
			if(!options.force && existing && !existing.partial) { return existing; }
			const member = await this.client.api.guilds(this.guild.id).members(options.user).get();
			return this.add(member, options.cache);
		}
		if(Array.isArray(options.user)) { return new RangeError("CANNOT_FETCH_ARRAY_IN_REST_MODE"); }
		const c = new Discord.Collection();
		const l = options.limit > 1000 ? 1000 : options.limit || 1000;
		let members = await this.client.api.guilds(this.guild.id).members().get({
			query: {
				limit: l,
				after: options.after || 0
			}
		});
		while(members.length) {
			for(const member of members) {
				c.set(member.user.id, this.add(member, options.cache));
				if(options.limit && c.size >= options.limit) { return c; }
			}
			members = members.length === 1000 && (!options.limit || c.size < options.limit) ? await this.client.api.guilds(this.guild.id).members().get({
				query: {
					limit: 1000,
					after: c.last()
				}
			}) : [];
		}
		if(!options.limit && !this.guild.memberCount) { this.guild.memberCount = c.size; }
		return options.cache && c.size >= this.guild.memberCount ? this.cache : c;
	}
	return new Promise((r, j) => {
		const { time = 60000, withPresences: presences = false } = options;
		let { query } = options;
		let user_ids = typeof options.user === "string" ? options.user : Array.isArray(options.user) ? options.user : void 0;
		const limit = Number.isInteger(options.limit) ? options.limit : 0;
		const nonce = Discord.SnowflakeUtil.generate();
		if(nonce.length > 32) {
			j(new RangeError("MEMBER_FETCH_NONCE_LENGTH"));
			return;
		}
		if(!query && !user_ids) {
			if(this.client.options.ws.intents && !(this.client.options.ws.intents & Discord.Intents.FLAGS.GUILD_MEMBERS)) {
				j(new Discord.DiscordAPIError({ message: "fetching all members requires the GUILD_MEMBERS intent" }, 403, {
					path: "GUILD_MEMBERS_CHUNK",
					method: "Gateway",
					options: {}
				}));
				return;
			}
			query = "";
		}
		if(this.guild.memberCount === this.cache.size && !query && !limit && !presences && !user_ids && !options.force) {
			r(this.cache);
			return;
		}
		if(typeof user_ids === "string") {
			if(isNaN(user_ids) || user_ids.length < 15 || user_ids.length > 25) {
				j(new Discord.DiscordAPIError({ message: "Unknown User" }, 403, {
					path: "GUILD_MEMBERS_CHUNK",
					method: "Gateway",
					options: {}
				}));
				return;
			}
			if(this.cache.has(user_ids) && (!presences || this.client.options.cachePresences) && !options.force) {
				r(this.cache.get(user_ids));
				return;
			}
		}
		if(Array.isArray(user_ids)) {
			if(user_ids.every(t => this.cache.has(t)) && (!presences || this.client.options.cachePresences) && !options.force) {
				const cached = new Discord.Collection();
				for(let i = 0; i < user_ids.length; i++) {
					const ID = user_ids[i];
					cached.set(ID, this.cache.get(ID));
				}
				r(cached);
				return;
			}
			user_ids = user_ids.map(u => u.replace(/\D+/g, ""));
		}
		this.guild.shard.send({
			op: Discord.Constants.OPCodes.REQUEST_GUILD_MEMBERS,
			d: {
				guild_id: this.guild.id,
				presences,
				user_ids,
				query,
				nonce,
				limit
			}
		});
		const fetched = new Discord.Collection();
		let i = 0;
		let failed = 0;
		const timeout = this.client.setTimeout(() => {
			this.client.removeListener(Discord.Constants.Events.GUILD_MEMBERS_CHUNK, handler);
			this.client.decrementMaxListeners();
			j(new Error("GUILD_MEMBERS_TIMEOUT"));
		}, time);
		const handler = (_, data) => {
			if(data.nonce !== nonce) { return; }
			timeout.refresh();
			i++;
			if(data.not_found) { failed += data.not_found.length; }
			for(const member of data.members) {
				fetched.set(member.user.id, this.add(member, options.cache || this.client.users.cache.has(member.user.id)));
			}
			if(presences && data.presences) {
				for(const presence of data.presences) {
					const d = Object.assign(presence, { guild: this.guild });
					if(options.cache || this.client.options.cachePresences || this.guild.presences.cache.has(presence.user.id) || this.client.users.cache.has(presence.user.id)) {
						this.guild.presences.add(d);
					} else {
						fetched.get(presence.user.id)._presence = this.guild.presences.add(d, false);
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
					const result = fetched.first();
					if(result) {
						r(result);
					} else {
						j(new Discord.DiscordAPIError({ message: "Unknown User" }, 403, {
							path: "GUILD_MEMBERS_CHUNK",
							method: "Gateway",
							options: {}
						}));
					}
				} else {
					if(!options.limit && !this.guild.memberCount) { this.guild.memberCount = fetched.size; }
					r(fetched);
				}
			}
		};
		this.client.incrementMaxListeners();
		this.client.on(Discord.Constants.Events.GUILD_MEMBERS_CHUNK, handler);
	});
};

Discord.GuildMemberManager.prototype.forge = function(id) {
	return this.add({ user: { id } }, false);
};

Discord.GuildEmojiManager.prototype.fetch = async function(id, cache) {
	let options = {};
	switch(typeof cache) {
		case "boolean": options.cache = cache; break;
		case "object": options = cache || {}; break;
	}
	switch(typeof id) {
		case "string": options.id = id; break;
		case "boolean": options.cache = id; break;
		case "object": options = id || {}; break;
	}
	if(typeof options.cache === "undefined") { options.cache = true; }
	if(options.id) {
		const existing = this.cache.get(options.id);
		if(!options.force && existing) { return existing; }
		const emoji = await this.client.api.guilds(this.guild.id).emojis(options.id).get();
		return this.add(emoji, options.cache);
	}
	const emojis = await this.client.api.guilds(this.guild.id).emojis().get();
	if(options.cache) {
		for(const emoji of emojis) {
			this.add(emoji);
		}
		return this.cache;
	}
	const collection = new Discord.Collection();
	for(const emoji of emojis) {
		collection.set(emoji.id, this.add(emoji, false));
	}
	return collection;
};

Discord.GuildEmojiManager.prototype.forge = function(id) {
	return this.add({ id }, false);
};

Discord.RoleManager.prototype.fetch = async function(id, cache) {
	let options = {};
	switch(typeof cache) {
		case "boolean": options.cache = cache; break;
		case "object": options = cache || {}; break;
	}
	switch(typeof id) {
		case "string": options.id = id; break;
		case "boolean": options.cache = id; break;
		case "object": options = id || {}; break;
	}
	if(typeof options.cache === "undefined") { options.cache = true; }
	if(options.id) {
		const existing = this.cache.get(options.id);
		if(!options.force && existing) { return existing; }
	}
	const roles = await this.client.api.guilds(this.guild.id).roles.get();
	if(options.id) {
		const r = roles.find(t => t.id === options.id);
		if(!r) {
			throw new Discord.DiscordAPIError({ message: "Unknown Role" }, 404, {
				path: `${this.client.api.guilds(this.guild.id).roles()}:id`,
				method: "GET",
				options: {}
			});
		}
		return this.add(r, options.cache);
	} else if(options.cache) {
		for(const role of roles) {
			this.add(role);
		}
		return this.cache;
	}
	const collection = new Discord.Collection();
	for(const role of roles) {
		collection.set(role.id, this.add(role, false));
	}
	return collection;
};

Discord.ReactionManager.prototype.forge = function(id) {
	const emoji = {};
	if(isNaN(id)) {
		emoji.name = id;
	} else {
		emoji.id = id;
	}
	return this.add({ emoji }, false);
};

Discord.ReactionUserManager.prototype.fetch = async function({ limit = 100, after, cache = true } = {}) {
	const { message } = this.reaction;
	// removed `before` query parameter. see:
	// https://discord.com/channels/222078108977594368/682166281826598932/827243964871475260
	const data = await this.client.api.channels(message.channel.id).messages(message.id).reactions(this.reaction.emoji.identifier).get({
		query: {
			limit,
			after
		}
	});
	const users = new Discord.Collection();
	for(const rawUser of data) {
		const user = this.client.users.add(rawUser, cache || this.client.users.cache.has(rawUser.id));
		this.cache.set(user.id, user);
		users.set(user.id, user);
	}
	return users;
};

Discord.RoleManager.prototype.forge = function(id) {
	return this.add({ id }, false);
};

Discord.PresenceManager.prototype.forge = function(id) {
	return this.add({ user: { id } }, false);
};

Discord.MessageManager.prototype.forge = function(id) {
	return this.add({ id }, false);
};

Object.defineProperty(Discord.RoleManager.prototype, "everyone", {
	get: function() {
		return this.cache.get(this.guild.id) || this.guild.roles.add({
			id: this.guild.id,
			permissions: 0
		}, false);
	}
});

Object.defineProperty(Discord.GuildMemberRoleManager.prototype, "cache", {
	get: function() {
		const { everyone } = this.guild.roles;
		const roles = new Discord.Collection();
		roles.set(everyone.id, everyone);
		for(const role of this.member._roles) {
			roles.set(role, this.guild.roles.cache.get(role) || this.guild.roles.add({
				id: role,
				permissions: 0
			}, false));
		}
		return roles;
	}
});

Object.defineProperty(Discord.GuildEmojiRoleManager.prototype, "cache", {
	get: function() {
		const roles = new Discord.Collection();
		for(const role of this.emoji._roles) {
			roles.set(role, this.guild.roles.cache.get(role) || this.guild.roles.add({
				id: role,
				permissions: 0
			}, false));
		}
		return roles;
	}
});

Object.defineProperty(Discord.MessageMentions.prototype, "channels", {
	get: function() {
		this._channels = new Discord.Collection();
		let matches;
		while((matches = this.constructor.CHANNELS_PATTERN.exec(this._content)) !== null) {
			const chan = this.client.channels.cache.get(matches[1]) || this.client.channels.add({
				id: matches[1],
				type: this.guild ? 0 : 1
			}, this.guild, false);
			this._channels.set(chan.id, chan);
		}
		return this._channels;
	}
});

Object.defineProperty(Discord.MessageMentions.prototype, "members", {
	get: function() {
		if(!this.guild) { return null; }
		if(!this._members) { this._members = []; }
		const members = new Discord.Collection();
		for(const id of this.users.keys()) {
			let m = this.guild.members.cache.get(id);
			if(!m) {
				const data = this._members.find(member => member.user.id === id);
				if(!data) { continue; }
				m = this.guild.members.add(data, false);
			}
			members.set(id, m);
		}
		return members;
	}
});

Object.defineProperty(Discord.Interaction.prototype, "channel", {
	get: function() {
		return this.channelID ? this.client.channels.cache.get(this.channelID) || this.client.channels.add({
			id: this.channelID,
			type: 0
		}, this.guild, false) : null;
	}
});

Object.defineProperty(Discord.Interaction.prototype, "guild", {
	get: function() {
		return this.guildID ? this.client.guilds.cache.get(this.guildID) || this.client.guilds.add({
			id: this.guildID,
			shardID: Discord.ShardClientUtil.shardIDForGuildID(this.guildID, this.client.options.shardCount)
		}, false) : null;
	}
});

module.exports = Discord;
