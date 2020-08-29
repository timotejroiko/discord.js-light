import * as Discord from "discord.js"

declare module "discord.js-light" {
    interface ClientOptions extends Discord.ClientOptions {
        cacheChannels?:boolean,
        cacheGuilds?:boolean,
        cachePresences?:boolean,
        cacheRoles?:boolean,
        cacheOverwrites?:boolean,
        cacheEmojis?:boolean
    }
    interface ClientEvents extends Discord.ClientEvents {
        rest:[{path:string,method:string,response:Promise<Buffer>}],
        shardConnect:[number,Discord.Collection<Discord.Snowflake,Discord.Guild>],
        guildEmojisUpdate:[Discord.Collection<Discord.Snowflake,Discord.GuildEmoji>]
    }
    class Client extends Discord.Client {
        constructor(options?: ClientOptions);
        public sweepUsers(lifetime: number): void;
        public sweepChannels(lifetime: number): void;
    }
}