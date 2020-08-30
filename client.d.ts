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
}