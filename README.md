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
* Fully compatible with Gateway Intents to receive only data that is actually wanted (enabled by default)
* Drastically lower resource usage for most use cases, especially at scale



## Getting Started

### Installation:

```npm install discord.js-light```

Optional packages (recommended to reduce bandwidth usage and improve websocket performance). These packages are plug and play, just install and discord.js will pick them up automatically.

```
npm install zlib-sync
npm install bufferutil
npm install discordapp/erlpack
npm install utf-8-validate
```

Additionally, using an alternative memory allocator such as [jemalloc](http://jemalloc.net/) can further reduce memory usage by a substantial amount in exchange for slightly higher cpu usage.

### Usage example:

```js
const Discord = require("discord.js-light");
const client = new Discord.Client({
	token: "your bot token"
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

Some client options were added to control certain aspects specific to this library while other options may have different defaults or behavior. Here's a list of changes and additions:

| Option | Type | Description |
| ------------- | ------------- | ------------- |
| token | string | Your bot token. If provided will make the client login automatically |
| enablePermissions | boolean | This option enables caching of all Guild Roles and Channel PermissionOverwrites in order to allow for permission checking. This will increase memory usage by a moderate amount (default:false) |
| enableChannels | boolean | This option enables caching of all channels and disables sweeping of inactive channels. This will increase memory usage by a substantial amount, use only if you need to track channel updates in real time (default:false) |
| trackPresences | boolean | This option enables caching of all presences when the GUILD_PRESENCES priviledged Intent is enabled or when Intents are not used. This will increase memory and cpu usage by a large amount, use only if you need to track people's statuses and activities in real time (default:false) |
| clientSweepInterval | number | Set how often to sweep inactive users and channels in seconds. Set to `0` to disable (default:86400) |
| userCacheLifetime | number | Set how long a user needs to be inactive to be sweepable in seconds. Set to `0` to disable user sweeping (default:86400) |
| channelCacheLifetime | number | Set how long a channel needs to be inactive to be sweepable in seconds. Set to `0` to disable channel sweeping (default:86400) |
| shardCheckInterval | number | Set how often to check for shard activity in seconds (internal shards only). Inactive shards will be forced to reconnect (workaround for a rare issue with discord.js where shards randomly stop trying to reconnect). Set to `0` to disable (default:1800) |
| queueLimit | number | Max amount of queued responses when rate limited. If this limit is hit, the client will temporarily stop firing message events in the relevant channel to prevent spam build up (default:5) |
| shards | number/string/array | Shards to spawn via internal sharding (default:"auto") |
| messageCacheMaxSize | number | Max amount of messages to cache in cached channels (default:10) |
| messageCacheLifetime | number | For how long are cached messages guaranteed to stay in the cache in seconds (default:86400) |
| messageSweepInterval | number | How often to clean the message cache in seconds (default:86400) |
| partials | - | This library implements its own partials system which is always enabled, therefore this option is not available |

All other discord.js client options continue to be available and should work normally.



## Intents

Discord released the Intents system some time ago, making it possible for developers to selectively subscribe to the events they want to receive, instead of being forced to receive and process all events. This enabled bot owners to greatly reduce cpu and bandwidth usage and thus reducing hosting costs.

This library comes preconfigured with a set of Intents enabled by default, and currently supports the following intents:

| Intent | Enabled | Description |
| ------------- | ------------- | ------------- |
| GUILDS (1) | yes | Enables emitting and processing of guildCreate, guildUpdate, guildDelete, guildRoleCreate, guildRoleUpdate, guildRoleDelete, channelCreate, channelUpdate, channelDelete, channelPinsUpdate |
| GUILD_MEMBERS (2) | no | Priviledged Intent - requires enabling in your Discord developer portal. Enables emitting and processing of guildMemberAdd, guildMemberRemove, guildMemberUpdate. Also keeps guild.memberCount updated and allows fetching all members |
| GUILD_BANS (4) | yes | Enables emitting and processing of guildBanAdd, guildBanRemove |
| GUILD_EMOJIS (8) | yes | Enables emitting and processing of emojiCreate, emojiUpdate, emojiDelete, guildEmojisUpdate |
| GUILD_VOICE_STATES (128) | no | Enables emitting and processing of voiceStateUpdate. Also enables caching of and access to VoiceState objects. This intent is required for the majority of voice features to work |
| GUILD_PRESENCES (256) | no | Priviledged Intent - requires enabling in your Discord developer portal. This Intent alone is responsible for about 90% of a bot's idle CPU and bandwidth usage so enabling it is not recommended unless you absolutely need it. Enables emitting and processing of presenceUpdate. Also allows fetching members with presences |
| GUILD_MESSAGES (512) | yes | Enables emitting and processing of messageCreate, messageUpdate, messageDelete, messageDeleteBulk |
| GUILD_MESSAGE_REACTIONS (1024) | yes | Enables emitting and processing of messageReactionAdd, messageReactionRemove, messageReactionRemoveAll, messageReactionRemoveEmoji |
| GUILD_MESSAGE_TYPING (2048) | no | Enables emitting and processing of typingStart |
| DIRECT_MESSAGES (4096) | yes | DMs only. Enables emitting and processing of channelCreate, messageCreate, messageUpdate, messageDelete, channelPinsUpdate |
| DIRECT_MESSAGE_REACTIONS (8192) | yes | DMs only. Enables emitting and processing of messageReactionAdd, messageReactionRemove, messageReactionRemoveAll, messageReactionRemoveEmoji |

You can enable/disable the above Intents by defining your own Intents combination in your client options as per the discord.js documentation.

Other Intents are currently not supported.



## Caching Behavior

This library alters the default caching behavior as follows:

| Store | Behavior | How to Fetch |
| ------------- | ------------- | ------------- |
| client.users | Cached when responding to DMs or when responding with message.reply() or when members are cached | client.users.fetch()  guild.members.fetch() |
| client.channels | Cached when `enableChannels` is enabled or when responding with channel.send() or message.reply() | client.channels.fetch()  guild.channels.fetch() |
| client.guilds | Always cached unless manually sweeped | client.guilds.fetch() |
| channel.messages | Own messages are cached by default, author messages are cached when responding with message.reply() | channel.messages.fetch() |
| channel.permissionOverwrites | Cached when `enablePermissions` is enabled or when guild roles are cached | client.channels.fetch()  guild.channels.fetch() |
| guild.emojis | Never automatically cached | guild.emojis.fetch()  guild.fetch()  client.guilds.fetch() |
| guild.roles | Cached when `enablePermissions` is enabled | guild.roles.fetch()  guild.fetch()  client.guilds.fetch() |
| guild.channels | Cached when channels are cached | client.channels.fetch()  guild.channels.fetch() |
| guild.members | Cached when responding with message.reply() | guild.members.fetch() |
| guild.voiceStates | Cached while the relevant members are connected to a voice channel (requires GUILD_VOICE_STATES intent) | - |
| guild.presences | Cached when `trackPresences` is enabled or when the relevant member is cached (requires GUILD_PRESENCES intent) | guild.members.fetch() (requires GUILD_PRESENCES intent) |
| member.roles | Always available but contains partial roles if guild roles are not cached | guild.roles.fetch()  guild.fetch()  client.guilds.fetch() |
| message.edits | Limited to 1 history state | - |

All structures are replaced with a partial object when the necessary data is not available. These objects only guarantee an id property but most of its class methods should still work. Depending on your needs, you may need to fetch these before being able to access their data.

The client itself will always be cached as a User and as a GuildMember in all cached guilds.

Unlike discord.js, this library will continue to function and emit partial events even if nothing is cached. You can send/receive messages and reactions to/from uncached channels and messages, receive update/delete events from uncached objects and even completely sweep the guild cache without breaking the library.



## Events Behavior

Most events should be identical to the originals aside from the caching behavior. Events will always emit, regardless of the required data being available or not (similar to enabling all partials in discord.js but including unsupported partials). When the required data is missing, the event will emit a partial structure where only an id is guaranteed. Events that emit multiple versions of a structure, such as update events, will emit `null` instead if not available.

| Event | Emits | Notes |
| ------------- | ------------- | ------------- |
| message | Message | This event is fired by both new messages and edited messages. The messageUpdate event was merged into the message event in order to make it easy for the client to reply to edited messages. Edited messages can be identified by checking for the existence of message.editedTimestamp and be accessed from message.edits if cached |
| messageDelete | Message | Partial Message if not cached |
| messageDeleteBulk | Collection | Provides a Collection of deleted messages as above |
| messageReactionAdd | Reaction, User | User may be partial if DM. Does not include reaction count nor list of users if not cached |
| messageReactionRemove | Reaction, User | User may be partial if DM. Does not include reaction count nor list of users if not cached |
| messageReactionRemoveAll | Message | Partial Message if not cached |
| messageReactionRemoveEmoji | Reaction | Does not include reaction count nor reaction users if not cached |
| channelCreate | Channel | - |
| channelUpdate | Channel or NULL, Channel | Old Channel is NULL if not cached |
| channelDelete | Channel | - |
| channelPinsUpdate | Channel, Date | Partial Channel if not cached |
| roleCreate | Role | - |
| roleUpdate | Role or NULL, Role | Old Role is NULL if not cached |
| roleDelete | Role | Partial Role if not cached |
| emojiCreate | Emoji | Only fires if guild emojis are cached |
| emojiUpdate | Emoji, Emoji | Only fires if guild emojis are cached |
| emojiDelete | Emoji | Only fires if guild emojis are cached |
| guildEmojisUpdate | Collection | Non-standard event that fires when guild emojis are not cached. Provides a Collection of up-to-date Emojis |
| guildBanAdd | Guild, User | Partial Guild if not cached |
| guildBanRemove | Guild, User | Partial Guild if not cached |
| guildCreate | Guild | - |
| guildUpdate | Guild or NULL, Guild | Old Guild is NULL if not cached |
| guildDelete | Guild | Partial Guild if not cached |
| guildMemberAdd | Member | Requires the GUILD_MEMBERS priviledged Intent |
| guildMemberUpdate | Member or NULL, Member | Old Member is NULL if not cached. Requires the GUILD_MEMBERS priviledged Intent |
| guildMemberRemove | Member | Partial Member if not cached. Requires the GUILD_MEMBERS priviledged Intent |
| voiceStateUpdate | VoiceState or NULL, VoiceState or NULL | NULL if not connected to a voice channel. Requires the GUILD_VOICE_STATES Intent |
| userUpdate | User or NULL, User | Old User is NULL if not cached |
| presenceUpdate | Presence or NULL, Presence | Old Presence is NULL if not cached. Requires the GUILD_PRESENCES priviledged Intent |
| typingStart | Channel, User | Partial Channel and/or User if not cached. Requires one of the \_MESSAGE_TYPING Intents |

Events that do not return partials only guarantee the contents of the top-level object. Linked objects such as message.channel or reaction.message may be partials if not previously cached or fetched. This is especially true with Guild objects which do not include Roles, Emojis, Channels, Members, Presences or VoiceStates unless previously cached, fetched, enabled or other conditions met.

Other events are currently not supported (except errors, sharding and connection events)



## Non-standard API

Some functionality was added and/or modified for dealing with the above caching changes among other conveniences:

### message.eval(content)

An eval function compatible with promises, async/await syntax and complex code. Can access the client via `client` and the message object via `this`

**`content (string)`** - string to evaluate. if evaluated to a promise, returns `{Promise:result}`, otherwise returns `result`

**`returns`** - `Promise (Object | Anything)`

### message.reply(content,options)

Replaces the original message.reply() and includes several changes:

* Does not automatically mention the author
* Handles promises, objects, falsey values and other non-string types
* Truncates large strings if no split options are provided
* Automatically caches the channel, author and messages involved
* Tracks user activity for automatic sweeping
* Adds response times and request-response pairing properties
* When triggered by a message update, replies by editing the previous response if possible

**`content (anything)`** - content to send. non-strings will be serialized. cannot pass options as first parameter, pass an empty string instead

**`options (object)`** - message options object as per discord.js

**`returns`** - `Promise (Message)`

### guild.channels.fetch(id,cache,withOverwrites)

Fetches channels from the /guilds/:id/channels endpoint. This endpoint bypasses VIEW_CHANNEL permissions.

**`id (string)`** - id of the channel to fetch. if not a string, fetches all channels in the guild and first and second parameters become cache and withOverwrites

**`cache (boolean)`** - whether to cache the result. returns the guild channel cache if set to true and no id is specified, otherwise returns a channel or a collection of channels. defaults to true

**`withOverwrites (boolean)`** - whether to include channel permissionOverwrites. always true if `enablePermissions` is enabled or if guild roles are cached, otherwise defaults to false

**`returns`** - `Promise (Channel | Collection of Channels | guild.channels.cache)`

### guild.members.fetch(options)

Fetches guild members.

**`options (object)`** - object of options

**`options.rest (boolean)`** - whether to use the /guilds/:id/members endpoint instead of the gateway. defaults to false

**`options.id (string)`** - id of the member to fetch (rest & gateway)

**`options.ids (array)`** - array of member ids to fetch (gateway only, requires GUILD_MEMBERS intent)

**`options.query (string)`** - query to search for members by username (gateway only). set to empty string for all members (requires GUILD_MEMBERS intent)

**`options.limit (number)`** - max amount of results (rest & gateway). set to 0 for unlimited (gateway only, requires GUILD_MEMBERS intent). max 1000 for rest. defaults to 50

**`options.after (string)`** - last member id from the previous request (rest only). used for pagination in the rest endpoint

**`options.cache (boolean)`** - whether to cache results (rest & gateway). returns the member cache if results match guild.memberCount, otherwise returns a member or a collection of members. defaults to true

**`options.withPresences (boolean)`** - whether to include presences (gateway only, requires GUILD_PRESENCES intent, requires `trackPresences` to be enabled or relevant members to be cached)

**`options.time (number)`** - time limit to wait for a response in milliseconds (gateway only). defaults to 60 seconds

**`returns`** - `Promise (GuildMember | Collection of GuildMembers | guild.members.cache)`

### guild.emojis.fetch(cache)

Fetches guild emojis.

**`cache (boolean)`** - whether to cache the results. returns the emoji cache if set to true, otherwise returns a collection of emojis. defaults to true

**`returns`** - `Promise (Collection of Emojis | guild.emojis.cache)`

### guild.roles.fetch(cache)

Fetches guild roles.

**`cache (boolean)`** - whether to cache the results. returns the role cache if set to true, otherwise returns a collection of roles. defaults to true

**`returns`** - `Promise (Collection of Roles | guild.roles.cache)`

### client.guilds.fetch(id,cache)

Fetches a guild.

**`id (string)`** - id of the guild to fetch

**`cache (boolean)`** - whether to cache the results. defaults to true

**`returns`** - `Promise (Guild)`

### client.sweepInactive()

Sweep inactive users and channels from the cache

**`returns`** - `Void`

### client.checkShards()

Check internal shards for activity and force them to restart if inactive

**`returns`** - `Void`

### client.getInfo()

Fetches information about the current client and process, its caches, resource usage and shard information

**`returns`** - `Promise (Object)`

### user.lastActive

(number) Timestamp of the last time the client interacted with this user

### user.noSweep

(boolean) Set to true to disable sweeping of this user

### channel.lastActive

(number) Timestamp of the last time the client interacted with this channel

### channel.noSweep

(boolean) Set to true to disabled sweeping of this channel

### message.commandResponse

(Message) The message object that was sent in response to this message (only if responded with message.reply)

### message.commandMessage

(Message) The message object that triggered this response (only if responded with message.reply)

### message.commandResponseTime

(number) Message response time in milliseconds (only if responded with message.reply)



## Notes

This project is somewhat experimental, so there might be bugs and broken features in untested scenarios. You are encouraged make your own tests with your specific use cases and post any issues, questions, suggestions, feature requests or contributions you may find.

You can also find me in [discord](https://discord.gg/BpeedKh) (Tim#2373)

## Bots using discord.js-light

[Astrobot](https://top.gg/bot/astrobot)

[Message Viewer](https://top.gg/bot/642052166982303754)

[Helper](https://top.gg/bot/409538753997307915)

(using discord.js-light? let me know if you're interested in having your bot being listed here)