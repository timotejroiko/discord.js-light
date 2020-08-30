import * as Discord from "discord.js"
export * from "discord.js"

export class Client extends Discord.Client {
	public sweepUsers(lifetime: number): void;
	public sweepChannels(lifetime: number): void;
}

declare module "discord.js-light" {
	interface ClientOptions {
		cacheChannels?:boolean,
		cacheGuilds?:boolean,
		cachePresences?:boolean,
		cacheRoles?:boolean,
		cacheOverwrites?:boolean,
		cacheEmojis?:boolean
	}
	interface ClientEvents {
		rest:[{path:string,method:string,response:Promise<Buffer>}],
		shardConnect:[number,Discord.Collection<Discord.Snowflake,Discord.Guild>],
		guildEmojisUpdate:[Discord.Collection<Discord.Snowflake,Discord.GuildEmoji>]
	}
	interface UserManager {
		forge(id: Discord.Snowflake): Discord.User
	}
	interface GuildManager {
		forge(id: Discord.Snowflake): Discord.Guild
	}
	interface ChannelManager {
		forge(id: Discord.Snowflake, type?: "dm"): Discord.DMChannel
		forge(id: Discord.Snowflake, type: "text"): Discord.TextChannel
		forge(id: Discord.Snowflake, type: "voice"): Discord.VoiceChannel
		forge(id: Discord.Snowflake, type: "group"): Discord.PartialGroupDMChannel
		forge(id: Discord.Snowflake, type: "category"): Discord.CategoryChannel
		forge(id: Discord.Snowflake, type: "news"): Discord.NewsChannel
		forge(id: Discord.Snowflake, type: "store"): Discord.StoreChannel
	}
	interface GuildChannelManager {
		forge(id: Discord.Snowflake, type?: "text"): Discord.TextChannel
		forge(id: Discord.Snowflake, type: "voice"): Discord.VoiceChannel
		forge(id: Discord.Snowflake, type: "category"): Discord.CategoryChannel
		forge(id: Discord.Snowflake, type: "news"): Discord.NewsChannel
		forge(id: Discord.Snowflake, type: "store"): Discord.StoreChannel
	}
	interface GuildMemberManager {
		forge(id: Discord.Snowflake): Discord.GuildMemberManager
	}
	interface GuildEmojiManager {
		forge(id: Discord.Snowflake): Discord.GuildEmojiManager
	}
	interface RoleManager {
		forge(id: Discord.Snowflake): Discord.Role
	}
	interface MessageManager {
		forge(id: Discord.Snowflake): Discord.Message
	}
	interface PresenceManager {
		forge(id: Discord.Snowflake): Discord.Presence
	}
	interface ReactionManager {
		forge(id: Discord.Snowflake | string): Discord.MessageReaction
	}
	interface ReactionUserManager {
		
	}
}