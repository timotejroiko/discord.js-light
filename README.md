# discord.js-light

A [discord.js (v12)](https://discord.js.org) "anti-caching" framework focused on combating the original library's aggressive caching behavior to prevent excessive resource usage. It works by modifying a few of discord.js' internal classes and functions to prevent data from being cached at the source while introducing workarounds to keep its data structures as intact as possible.

[![npm](https://img.shields.io/npm/v/discord.js-light?label=current%20version)](https://www.npmjs.com/package/discord.js-light)
[![GitHub Release Date](https://img.shields.io/github/release-date/timotejroiko/discord.js-light?label=last%20updated)](https://github.com/timotejroiko/discord.js-light/releases)
[![npm (prod) dependency version](https://img.shields.io/npm/dependency-version/discord.js-light/discord.js)](https://discord.js.org)
[![node](https://img.shields.io/node/v/discord.js-light)](https://nodejs.org)
[![Discord](https://img.shields.io/discord/581072557512458241?label=support%20server)](https://discord.gg/BpeedKh)
[![Patreon](https://img.shields.io/endpoint.svg?url=https%3A%2F%2Fshieldsio-patreon.herokuapp.com%2Ftimotejroiko&label=support%20me%20on%20patreon)](https://www.patreon.com/timotejroiko)

## Why?

Discord.js has been THE javascript discord library for a long time now, and successfully powers thousands of bots. But as bots grows larger, you will often notice a substantial increase in resource usage, especially memory consumption.

This is due to the fact that discord.js caches nearly everything it can in order to avoid hitting the Discord API as much as possible and also to provide all its features. This behavior can however make the library feel bloated for bigger bots as many times the library is caching and processing data that your bot will never use.

This issue has been discussed a few times by the community but ultimately it has been decided that the library is too tightly coupled with its caching systems and seperating them would be unfeasible. Thus the task of scaling falls back to us bot developers.

Several solutions have been presented so far, such as regular cache sweeping, intents and disabling events. However i felt that the existing methods were lacking and decided to study the discord.js source code to see what could be done about it.

This project later became the base framework for all my bots and it does a wonderful job keeping hosting costs and scaling maintenance in check (\~120mb ram at 3000+ guilds).

## Features

* Provides most of discord.js's basic events without automatic caching
* Most classes have their structures intact and can be used the same way as the original library
* Partial objects are given when data is missing and can be manually fetched and cached when needed
* Fully compatible with Discord intents to receive only data that is actually used (enabled by default)
* Drastically lower resource usage for most use cases especially at scale

## Getting Started

Installation:

```npm install discord.js-light```

Optional packages (recommended to reduce bandwidth usage and improve websocket performance). These packages are plug and play, just install and discord.js will pick them up automatically. Additionally, using an alternative memory allocator such as [jemalloc](http://jemalloc.net/) can further reduce memory usage by a substantial amount in exchange for slightly higher cpu usage.

```
npm install zlib-sync
npm install bufferutil
npm install discordapp/erlpack
npm install utf-8-validate
```

Usage example:

```js
const Discord = require("discord.js-light");
const client = new Discord.Client({
	token: "yourbottoken"
});

client.on("ready", () => {
	// do stuff
});

client.on("message", message => {
	if(message.content === "?!ping") {
		message.reply("pong")
	}
});
```

Generally usage should be very similar to discord.js and you can safely refer to its documentation as long as you respect the caching differences explained later on in this readme.

## Client options

Some extra client options were added to control certain aspects specific to this library.

| Option | Type | Description |
| ------------- | ------------- | ------------- |
| token | string | Your Discord token. If provided will make the client login automatically |
| clientSweepInterval | number | Set how often to sweep inactive cached users and channels in seconds. Set to `0` to disable (default:86400) |
| shardCheckInterval | number | Set how often to check for shard activity in seconds (internal sharding only). Inactive shards will be forced to reconnect (workaround for a rare issue with discord.js where shards randomly disconnect and refuse to reconnect). Set to `0` to disable (default:600) |
| enablePermissions | boolean | This option enables caching of all Guild Roles and Channel PermissionOverwrites in order to allow for permission checking. This will increase memory usage by a moderate amount (default:false) |
| enableChannels | boolean | This option enables caching of all channels and disables sweeping of inactive channels. This will increase memory usage by a substantial amount, use only if you need to track channel updates in real time (default:false) |
| trackPresences | boolean | This option enables caching of all presences when the GUILD_PRESENCES priviledged Intent is enabled or when Intents are not used. This will increase memory and cpu usage by a large amount, use only if you need to track people's statuses and activities in real time (default:false) |
| queueLimit | number | Max amount of queued responses when rate limited. If this limit is hit, the client will temporarily stop firing message events in the relevant channel to prevent spam build up (default:5) |

All other discord.js client options continue to be available except for partials which this library implements in its own way.

## Intents

Discord released the Intents system some time ago, making it possible for developers to selectively subscribe to the events they want to receive, instead of being forced to receive and process EVERYTHING. This enabled bot owners to greatly reduce cpu and bandwidth usage and thus reducing hosting costs.

This library comes preconfigured with a set of Intents enabled by default, and currently supports the following intents:

| Intent | Enabled | Description |
| ------------- | ------------- | ------------- |
| GUILDS (1) | yes | Enables emitting and processing of guildCreate, guildUpdate, guildDelete, guildRoleCreate, guildRoleUpdate, guildRoleDelete, channelCreate, channelUpdate, channelDelete, channelPinsUpdate |
| GUILD_BANS (4) | yes | Enables emitting and processing of guildBanAdd, guildBanRemove |
| GUILD_MESSAGES (512) | yes | Enables emitting and processing of messageCreate, messageUpdate, messageDelete, messageDeleteBulk |
| GUILD_MESSAGE_REACTIONS (1024) | yes | Enables emitting and processing of messageReactionAdd, messageReactionRemove, messageReactionRemoveAll, messageReactionRemoveEmoji |
| DIRECT_MESSAGES (4096) | yes | DMs only. Enables emitting and processing of channelCreate, messageCreate, messageUpdate, messageDelete, channelPinsUpdate |
| DIRECT_MESSAGE_REACTIONS (8192) | yes | DMs only. Enables emitting and processing of messageReactionAdd, messageReactionRemove, messageReactionRemoveAll, messageReactionRemoveEmoji |
| GUILD_MEMBERS (2) | no | Priviledged Intent - requires enabling in your Discord developer portal. Enables emitting and processing of guildMemberAdd, guildMemberRemove, guildMemberUpdate. Also keeps guild.memberCount updated and allows fetching all members |
| GUILD_VOICE_STATES (128) | no | Enables emitting and processing of voiceStateUpdate. Also enables caching of and access to VoiceState objects. This intent is required for the majority of voice features to work |
| GUILD_PRESENCES (256) | no | Priviledged Intent - requires enabling in your Discord developer portal. This Intent alone is responsible for about 90% of a bot's idle CPU and bandwidth usage so enabling it is not recommended unless you absolutely need it. Enables emitting and processing of presenceUpdate. Also allows fetching members with presences |

You can enable/disable the above Intents by defining your own Intents combination in your client options as per the discord.js documentation.

Other Intents are currently not supported.

## Caching Behavior

This library alters the default caching behavior as follows:

| Store | Behavior | How to Fetch |
| ------------- | ------------- | ------------- |
| client.users | Cached when sending DMs or when members are cached | client.users.fetch() & guild.members.fetch() |
| client.channels | Cached when `enableChannels` is enabled or when sending messages | client.channels.fetch() & guild.channels.fetch() |
| client.guilds | Always cached unless manually sweeped | client.guilds.fetch() |
| channel.messages | Cached when sending messages, author messages are also cached when responding with message.reply() | channel.messages.fetch() |
| channel.permissionOverwrites | Cached when `enablePermissions` is enabled | channel.fetchOverwrites() & guild.channels.fetch() |
| guild.emojis | Not automatically cached | guild.emojis.fetch() & guild.fetch() & client.guilds.fetch() |
| guild.roles | Cached when `enablePermissions` is enabled | guild.roles.fetch() & guild.fetch() & client.guilds.fetch() |
| guild.channels | Cached when client.channels are cached | client.channels.fetch() & guild.channels.fetch() |
| guild.members | Cached when responding with message.reply() | guild.members.fetch() |
| guild.voiceStates | Cached only when the GUILD_VOICE_STATES intent is enabled and its respective member is connected to a voice channel | - |
| guild.presences | Cached when the GUILD_PRESENCES intent is enabled and, `trackPresences` is enabled or its respective user is cached | guild.members.fetch() if GUILD_PRESENCES intent is enabled |
| member.roles | Always cached, partial roles if guild.roles are not cached | guild.roles.fetch() |


* Users are not cached by default. Users can be manually cached by using `client.users.fetch(id)`. Fetching Users will not fetch nor cache its GuildMember counterpart.
* Channels are not cached by default unless the `enableChannels` client option is set to true. Channels can be manually cached using `client.channels.fetch(id)`.
* Messages are not cached by default. Messages can be manually cached by fetching its channel and then using `channel.messages.fetch(id)`
* Guilds are cached at login and will be kept updated as long as they remain in the cache, but not all of its contents are cached (see below). Guilds can also be safely sweeped and removed from the cache for additional memory saving in exchange for losing access to some guild information.
* Guild Emojis are not cached by default. Emojis can be fully cached by using `guild.fetch()`. Emojis are currently not automatically updated and will need to be fetched again if needed.
* Guild Roles are not cached by default unless the `enablePermissions` client option is set to true. Roles can be fully cached by using `guild.roles.fetch()`. Once cached, they will be kept updated while they remain in the cache.
* Guild Members are not cached by default. Members can be individually cached by using `guild.members.fetch(id)`. Fetching a large number of members with Intents enabled requires the priviledged GUILD_MEMBERS Intent. This will not cache its User counterpart.
* Guild Channels are not cached by default unless the `enableChannels` client option is set to true. Guild Channels can be added to the guild cache by fetching the channel and then linking it using `guild.channels.cache.set(fetchedChannel.id,fetchedChannel)`.
* Guild Channels have their Permission Overwrites removed by default unless the `enablePermissions` client option is set to true or the guild's roles are cached. If `enablePermissions` is disabled and a channel is already cached before guild roles are fetched, you will need to delete it from the cache and fetch it again in order to obtain its permission overwrites. Permission Overwrites will be kept updated as long as the mentioned conditions are met.
* VoiceStates are completely disabled unless the GUILD_VOICE_STATES Intent is enabled. If the Intent is enabled, VoiceStates will be cached automatically, remain in the cache as long as the relevant members are connected to a voice channel and removed from the cache when they disconnect. This will not cache their GuildMember nor User. There is no way to manually obtain voice states otherwise.
* Presences are completely disabled unless the priviledged GUILD_PRESENCES Intent is enabled. If the Intent is enabled, Presences can be manually cached by using `guild.members.fetch({user:id,withPresences:true})` or fully cached by setting the `trackPresences` client option to true.

All relevant events provide a temporary/partial object if the necessary object is not cached. These objects may have missing information, so depending on your needs, you might need to fetch them before using them.

The client itself will always be cached as a User and as a GuildMember in all cached guilds. All messages it sends will also automatically cache all the relevant objects (DMChannel/RecipientUser, GuildChannel and Message).

Unlike discord.js, this library will continue to function even if nothing is cached and most methods will work properly when called on the provided partials and temporary objects. You can send/receive messages to/from uncached channels, send/receive reactions to/from uncached messages, receive update/delete events from uncached objects and even completely sweep the guild cache without breaking the library.

## Events

Most events should be identical to the originals besides the caching behavior. All "partial" objects below will be full objects if cached or a temporary/partial version of them if not cached.

| Event | Description |
| ------------- | ------------- |
| message | This event is fired by both new messages and edited messages. It provides a full Message object with a partial Channel object. The messageUpdate event was merged into the message event in order to make it easy for the bot to reply to edited messages. Edited messages can be identified by checking for the existence of message.editedTimestamp and be accessed from message.edits if cached |
| messageDelete | Provides a partial Message object with a partial Channel object |
| messageDeleteBulk | Provides a Collection of deleted messages as above |
| messageReactionAdd | Provides a full Reaction object with partial Message object, and a full User object (partial if DM). Does not provide Reaction count nor Reaction users if not cached |
| messageReactionRemove | Provides a full Reaction object with partial Message object, and a full User object (partial if DM). Does not provide Reaction count nor Reaction users if not cached |
| messageReactionRemoveAll | Provides a partial Message object |
| messageReactionRemoveEmoji | Provides a full Reaction object with a partial Message object. Does not provide Reaction count nor Reaction users if not cached |
| channelCreate | Provides a full Channel object |
| channelUpdate | Provides a NULL old Channel object if not cached and a full new Channel object |
| channelDelete | Provides a full Channel object |
| channelPinsUpdate | Provides a partial Channel object and a Date object |
| roleCreate | Provides a full Role object |
| roleUpdate | Provides a NULL old Role object if not cached and a full new Role object |
| roleDelete | Provides a partial Role object |
| guildBanAdd | Provides a full Guild object and a full User object |
| guildBanRemove | Provides a full Guild object and a full User object |
| guildCreate | Provides a full Guild object \* |
| guildUpdate | Provides full old and new Guild objects if cached, otherwise both old and new will be null \* |
| guildDelete | Provides a NULL Guild object if not cached |
| guildMemberAdd | Provides a full Member object. Requires the GUILD_MEMBERS priviledged Intent |
| guildMemberUpdate | Provides a NULL old Member object if not cached and a full new Member object. Requires the GUILD_MEMBERS priviledged Intent |
| guildMemberRemove | Provides a partial Member object. Requires the GUILD_MEMBERS priviledged Intent |
| voiceStateUpdate | Provides a NULL old state and full new state when connecting, full old and new states when updating, full old and NULL new state when disconnecting. Requires the GUILD_VOICE_STATES Intent |
| userUpdate | Provides a NULL old User object if not cached and a full new User object |
| presenceUpdate | Provides a NULL old Presence object if not cached and a full new Presence object. Requires the GUILD_PRESENCES priviledged Intent |

\* Guild Objects do not contain Roles, Emojis, Channels, Members, Presences or VoiceStates unless previously cached, fetched, enabled or conditions met.

All other events (except connection events) are currently not supported.

## Additional Functionality

Some extra functionality is also included for convenience (mine mostly):

| Func/Prop | Type | Description |
| ------------- | ------------- | ------------- |
| Message.eval(string) | promise>anything | An eval function compatible with promises, async/await syntax and complex code. Can access the client via `client` and the message object via `this` (should not be public) |
| Message.reply(content,options) | promise>message | Completely replaces the original message.reply(). It does the same as message.channel.send() but adds several improvements: handles promises, objects, falsey values and other non-string types, truncates large strings if no split options are provided, automatically caches the channel, author and messages involved, tracks activity for automatic sweeping, adds response times, request-response pairing and if possible replies by editing a previous response when triggered by a message update. |
| Guild.channels.fetch(boolean) | promise>collection | Fetches the guild's channels from the API. Fetched channels are cached by default but caching can be disabled by setting the function argument to false. If set to false, it returns a collection of Channel objects, otherwise it returns the guild channel cache |
| Message.commandResponse | message | The message object that was sent as a response to this command. Only available if it was sent with message.reply() |
| Message.commandMessage | message | The message object that triggered this response. Only available if this response was sent with message.reply() |
| Message.commandResponseTime | number | Message response time in milliseconds. Only available in response messages if they were sent with message.reply() |
| Channel.lastActive | number | Timestamp of the last time this channel was used by the client |
| Channel.noSweep | boolean | Set to `true` if this channel should be cached forever |
| User.lastActive | number | Timestamp of the last time this user was replied to by message.reply() |
| User.noSweep | boolean | Set to `true` if this user should be cached forever |
| Client.sweepInactive() |  | Sweep inactive users/channels |
| Client.checkShards() |  | Check for inactive shards (internal sharding only) |
| Client.getInfo() | promise>object | Gather several statistics about the client such as guild count, user count, sharding information, total active (cached) users and channels, websocket pings, uptimes, cpu usage and memory usage |

## About

This project is somewhat experimental, so there might be bugs and broken features in untested scenarios. You are encouraged make your own tests with your specific use cases and post any issues, questions, suggestions, feature requests or contributions you might find.

You can also find me in [discord](https://discord.gg/BpeedKh) (Tim#2373)

## Bots using discord.js-light

[Astrobot](https://top.gg/bot/astrobot)

[Message Viewer](https://top.gg/bot/642052166982303754)

[Helper](https://top.gg/bot/409538753997307915)

(using discord.js-light? let me know if you're interested in having your bot being listed here)