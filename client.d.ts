import * as Discord from "discord.js"
export * from "discord.js"

declare module "discord.js-light" {
	interface Caches {
		ChannelManager: [manager: typeof Discord.ChannelManager, holds: typeof Discord.Channel];
		GuildChannelManager: [manager: typeof Discord.GuildChannelManager, holds: typeof Discord.GuildChannel];
		GuildManager: [manager: typeof Discord.GuildManager, holds: typeof Discord.Guild];
		PermissionOverwriteManager: [manager: typeof Discord.PermissionOverwriteManager, holds: typeof Discord.PermissionOverwrites];
		RoleManager: [manager: typeof Discord.RoleManager, holds: typeof Discord.Role];
	}
	interface ClientOptions {
		disabledEvents?: Array<string>
	}
	interface ClientEvents {
		rest: [
			{
				path: string,
				method: string,
				responseHeaders: object,
				responseBody: string
			}
		];
		shardConnect: [
			number,
			Discord.Collection<Discord.Snowflake, Discord.Guild>
		];
		guildEmojisUpdate: [
			Discord.Collection<Discord.Snowflake, Discord.GuildEmoji>
		];
		guildStickersUpdate: [
			Discord.Collection<Discord.Snowflake, Discord.Sticker>
		];
	}
	interface UserManager {
		forge(user_id: Discord.Snowflake): Discord.User
	}
	interface GuildManager {
		forge(guild_id: Discord.Snowflake): Discord.Guild
	}
	interface ChannelManager {
		forge(id: Discord.Snowflake, type?: "DM"): Discord.DMChannel
		forge(id: Discord.Snowflake, type: "GUILD_TEXT"): Discord.TextChannel
		forge(id: Discord.Snowflake, type: "GUILD_VOICE"): Discord.VoiceChannel
		forge(id: Discord.Snowflake, type: "GUILD_CATEGORY"): Discord.CategoryChannel
		forge(id: Discord.Snowflake, type: "GUILD_NEWS"): Discord.NewsChannel
		forge(id: Discord.Snowflake, type: "GUILD_STORE"): Discord.StoreChannel
		forge(id: Discord.Snowflake, type: "GUILD_STAGE_VOICE"): Discord.StageChannel
		forge(id: Discord.Snowflake, type: "GUILD_PUBLIC_THREAD" | "GUILD_PRIVATE_THREAD" | "GUILD_NEWS_THREAD"): Discord.ThreadChannel
	}
	interface GuildChannelManager {
		forge(id: Discord.Snowflake, type: "GUILD_TEXT"): Discord.TextChannel
		forge(id: Discord.Snowflake, type: "GUILD_VOICE"): Discord.VoiceChannel
		forge(id: Discord.Snowflake, type: "GUILD_CATEGORY"): Discord.CategoryChannel
		forge(id: Discord.Snowflake, type: "GUILD_NEWS"): Discord.NewsChannel
		forge(id: Discord.Snowflake, type: "GUILD_STORE"): Discord.StoreChannel
		forge(id: Discord.Snowflake, type: "GUILD_STAGE_VOICE"): Discord.StageChannel
		forge(id: Discord.Snowflake, type: "GUILD_PUBLIC_THREAD" | "GUILD_PRIVATE_THREAD" | "GUILD_NEWS_THREAD"): Discord.ThreadChannel
	}
	interface GuildMemberManager {
		forge(user_id: Discord.Snowflake): Discord.GuildMember
	}
	interface GuildEmojiManager {
		forge(emoji_id: Discord.Snowflake): Discord.GuildEmojiManager
	}
	interface RoleManager {
		forge(role_id: Discord.Snowflake): Discord.Role
	}
	interface MessageManager {
		forge(message_id: Discord.Snowflake): Discord.Message
	}
	interface PresenceManager {
		forge(user_id: Discord.Snowflake): Discord.Presence
	}
	interface ReactionManager {
		forge(emoji_id: Discord.Snowflake): Discord.MessageReaction
		forge(unicode_emoji: string): Discord.MessageReaction
	}
	interface GuildBanManager {
		forge(user_id: Discord.Snowflake): Discord.GuildBan
	}
	interface ApplicationCommandManager {
		forge(application_id: Discord.Snowflake): Discord.ApplicationCommand
	}
	interface GuildInviteManager {
		forge(code: string, channel_id: Discord.Snowflake): Discord.Invite
	}
	interface GuildStickerManager {
		forge(sticker_id: Discord.Snowflake): Discord.Sticker
	}
	interface StageInstanceManager {
		forge(stage_id: Discord.Snowflake): Discord.StageInstance
	}
	interface VoiceStateManager {
		forge(user_id: Discord.Snowflake): Discord.VoiceState
	}
	interface PermissionOverwriteManager {
		forge(user_id: Discord.Snowflake, type: Discord.OverwriteType): Discord.PermissionOverwrites
	}
	interface ThreadMemberManager {
		forge(user_id: Discord.Snowflake): Discord.ThreadMember
	}
}
