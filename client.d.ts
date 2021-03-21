import * as Discord from "discord.js"
export * from "discord.js"

export class Client extends Discord.Client {
	public sweepUsers(lifetime?: number): void;
	public sweepChannels(lifetime?: number): void;
}

type ChannelFetchOptions = {
	id?: Discord.Snowflake
	cache?: boolean
	withOverwrites?: boolean
	force?: boolean
}
type GuildFetchOptions = {
	id?: Discord.Snowflake
	cache?: boolean
	limit?: number
	before?: Discord.Snowflake
	after?: Discord.Snowflake
	force?: boolean
}
type MemberFetchOptions = {
	user?: Discord.Snowflake | Array<Discord.Snowflake>
	cache?: boolean
	rest?: boolean
	query?: string
	limit?: number
	after?: Discord.Snowflake
	withPresences?: boolean
	time?: number
	force?: boolean
}
type EmojiFetchOptions = {
	id?: Discord.Snowflake
	cache?: boolean
	force?: boolean
}
type RoleFetchOptions = {
	id?: Discord.Snowflake
	cache?: boolean
	force?: boolean
}
type ReactionUserFetchOptions = {
	cache?: boolean
	limit?: number
	before?: Discord.Snowflake
	after?: Discord.Snowflake
}

type SessionData = {
	[shardID: string]: {
		id: string
		sequence: number
	}
}

type HotReloadOptions = {
	sessionData: SessionData
	unpatchOnExit: boolean
	patchSource: string | Object
}

declare module "discord.js-light" {
	interface ClientOptions {
		cacheChannels?:boolean
		cacheGuilds?:boolean
		cachePresences?:boolean
		cacheRoles?:boolean
		cacheOverwrites?:boolean
		cacheEmojis?:boolean
		cacheMembers?:boolean
		disabledEvents?: Array<string>
		hotReload?: boolean | HotReloadOptions
	}
	interface ClientEvents {
		rest:[{path:string,method:string,response?:Promise<Buffer>}]
		shardConnect:[number,Discord.Collection<Discord.Snowflake,Discord.Guild>]
		guildEmojisUpdate:[Discord.Collection<Discord.Snowflake,Discord.GuildEmoji>]
	}
	interface UserManager {
		forge(id: Discord.Snowflake): Discord.User
	}
	interface GuildManager {
		forge(id: Discord.Snowflake): Discord.Guild
		fetch(): Promise<Discord.Collection<Discord.Snowflake, Discord.Guild>>
		fetch(id: Discord.Snowflake): Promise<Discord.Guild>
		fetch(id: Discord.Snowflake, cache: boolean): Promise<Discord.Guild>
		fetch(id: Discord.Snowflake, options: GuildFetchOptions): Promise<Discord.Guild>
		fetch(cache: boolean): Promise<Discord.Collection<Discord.Snowflake, Discord.Guild>>
		fetch(cache: boolean, options: GuildFetchOptions): Promise<Discord.Collection<Discord.Snowflake, Discord.Guild>>
		fetch(options: { id: Discord.Snowflake } & GuildFetchOptions): Promise<Discord.Guild>
		fetch(options: GuildFetchOptions): Promise<Discord.Collection<Discord.Snowflake, Discord.Guild>>
	}
	interface ChannelManager {
		forge(id: Discord.Snowflake, type?: "dm"): Discord.DMChannel
		forge(id: Discord.Snowflake, type: "text"): Discord.TextChannel
		forge(id: Discord.Snowflake, type: "voice"): Discord.VoiceChannel
		forge(id: Discord.Snowflake, type: "group"): Discord.PartialGroupDMChannel
		forge(id: Discord.Snowflake, type: "category"): Discord.CategoryChannel
		forge(id: Discord.Snowflake, type: "news"): Discord.NewsChannel
		forge(id: Discord.Snowflake, type: "store"): Discord.StoreChannel
		fetch(id: Discord.Snowflake): Promise<Discord.Channel>
		fetch(id: Discord.Snowflake, cache: boolean): Promise<Discord.Channel>
		fetch(id: Discord.Snowflake, options: ChannelFetchOptions): Promise<Discord.Channel>
		fetch(options: { id: Discord.Snowflake } & ChannelFetchOptions): Promise<Discord.Channel>
	}
	interface GuildChannelManager {
		forge(id: Discord.Snowflake, type?: "text"): Discord.TextChannel
		forge(id: Discord.Snowflake, type: "voice"): Discord.VoiceChannel
		forge(id: Discord.Snowflake, type: "category"): Discord.CategoryChannel
		forge(id: Discord.Snowflake, type: "news"): Discord.NewsChannel
		forge(id: Discord.Snowflake, type: "store"): Discord.StoreChannel
		fetch(): Promise<Discord.Collection<Discord.Snowflake, Discord.GuildChannel>>
		fetch(id: Discord.Snowflake): Promise<Discord.GuildChannel>
		fetch(id: Discord.Snowflake, cache: boolean): Promise<Discord.GuildChannel>
		fetch(id: Discord.Snowflake, options: ChannelFetchOptions): Promise<Discord.GuildChannel>
		fetch(cache: boolean): Promise<Discord.Collection<Discord.Snowflake, Discord.GuildChannel>>
		fetch(cache: boolean, options: ChannelFetchOptions): Promise<Discord.Collection<Discord.Snowflake, Discord.GuildChannel>>
		fetch(options: { id: Discord.Snowflake } & ChannelFetchOptions): Promise<Discord.GuildChannel>
		fetch(options: ChannelFetchOptions): Promise<Discord.Collection<Discord.Snowflake, Discord.GuildChannel>>
	}
	interface GuildMemberManager {
		forge(id: Discord.Snowflake): Discord.GuildMemberManager
		fetch(): Promise<Discord.Collection<Discord.Snowflake, Discord.GuildMember>>
		fetch(user: Discord.Snowflake): Promise<Discord.GuildMember>
		fetch(user: Discord.Snowflake, cache: boolean): Promise<Discord.GuildMember>
		fetch(user: Discord.Snowflake, options: MemberFetchOptions): Promise<Discord.GuildMember>
		fetch(cache: boolean): Promise<Discord.Collection<Discord.Snowflake, Discord.GuildMember>>
		fetch(cache: boolean, options: MemberFetchOptions): Promise<Discord.Collection<Discord.Snowflake, Discord.GuildMember>>
		fetch(options: { user: Discord.Snowflake } & MemberFetchOptions): Promise<Discord.GuildMember>
		fetch(options: MemberFetchOptions): Promise<Discord.Collection<Discord.Snowflake, Discord.GuildMember>>
	}
	interface GuildEmojiManager {
		forge(id: Discord.Snowflake): Discord.GuildEmojiManager
		fetch(): Promise<Discord.Collection<Discord.Snowflake, Discord.GuildEmoji>>
		fetch(id: Discord.Snowflake): Promise<Discord.GuildEmoji>
		fetch(id: Discord.Snowflake, cache: boolean): Promise<Discord.GuildEmoji>
		fetch(id: Discord.Snowflake, options: EmojiFetchOptions): Promise<Discord.GuildEmoji>
		fetch(cache: boolean): Promise<Discord.Collection<Discord.Snowflake, Discord.GuildEmoji>>
		fetch(cache: boolean, options: EmojiFetchOptions): Promise<Discord.Collection<Discord.Snowflake, Discord.GuildEmoji>>
		fetch(options: { id: Discord.Snowflake } & EmojiFetchOptions): Promise<Discord.GuildEmoji>
		fetch(options: EmojiFetchOptions): Promise<Discord.Collection<Discord.Snowflake, Discord.GuildEmoji>>
	}
	interface RoleManager {
		forge(id: Discord.Snowflake): Discord.Role
		fetch(): Promise<Discord.Collection<Discord.Snowflake, Discord.Role>>
		fetch(id: Discord.Snowflake): Promise<Discord.Role>
		fetch(id: Discord.Snowflake, cache: boolean): Promise<Discord.Role>
		fetch(id: Discord.Snowflake, options: RoleFetchOptions): Promise<Discord.Role>
		fetch(cache: boolean): Promise<Discord.Collection<Discord.Snowflake, Discord.Role>>
		fetch(cache: boolean, options: RoleFetchOptions): Promise<Discord.Collection<Discord.Snowflake, Discord.Role>>
		fetch(options: { id: Discord.Snowflake } & RoleFetchOptions): Promise<Discord.Role>
		fetch(options: RoleFetchOptions): Promise<Discord.Collection<Discord.Snowflake, Discord.Role>>
	}
	interface MessageManager {
		forge(id: Discord.Snowflake): Discord.Message
	}
	interface PresenceManager {
		forge(id: Discord.Snowflake): Discord.Presence
	}
	interface ReactionManager {
		forge(id: Discord.Snowflake): Discord.MessageReaction
		forge(unicodeEmoji: string): Discord.MessageReaction
	}
	interface ReactionUserManager {
		fetch(): Promise<Discord.Collection<Discord.Snowflake, Discord.User>>
		fetch(options: ReactionUserFetchOptions): Promise<Discord.Collection<Discord.Snowflake, Discord.User>>
	}
}
