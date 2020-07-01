# discord.js-light v3 (v3 is not released yet, for the v2 docs, check the v2 branch)

All the power of [discord.js](https://discord.js.org), zero caching.

This library overrides discord.js's internal classes and functions in order to give you full control over its caching behavior. Say goodbye to exorbitant memory usage!

[![npm](https://img.shields.io/npm/v/discord.js-light?label=current%20version)](https://www.npmjs.com/package/discord.js-light)
[![GitHub Release Date](https://img.shields.io/github/release-date/timotejroiko/discord.js-light?label=last%20updated)](https://github.com/timotejroiko/discord.js-light/releases)
[![npm (prod) dependency version](https://img.shields.io/npm/dependency-version/discord.js-light/discord.js)](https://discord.js.org)
[![node](https://img.shields.io/node/v/discord.js-light)](https://nodejs.org)
[![Discord](https://img.shields.io/discord/581072557512458241?label=support%20server)](https://discord.gg/BpeedKh)
[![Patreon](https://img.shields.io/endpoint.svg?url=https%3A%2F%2Fshieldsio-patreon.herokuapp.com%2Ftimotejroiko&label=support%20me%20on%20patreon)](https://www.patreon.com/timotejroiko)



## Why?

Discord.js has been THE javascript discord library for a long time now, and successfully powers thousands of bots, but as your bot grows larger, you will often notice a substantial increase in resource usage, especially in memory consumption.

This is due to the fact that discord.js caches nearly everything it can in order to avoid hitting the Discord API as much as possible and also to better provide many of its features. This behavior can however make your bot feel bloated because the library is caching and processing data that your bot will likely never use.

This library is an attempt at solving the problem by giving developers full control over how and when discord.js should cache the data it receives from the API.



## Features

* Provides all of discord.js's events without any automatic caching
* Most classes have their structures intact and can be used the same way as the original library
* Partials are given when the required data is not available and can be manually fetched and/or cached when needed
* Fully compatible with any combination of Gateway Intents
* Drastically lower resource usage at scale



## Usage

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
const client = new Discord.Client();

client.on("ready", () => {
	console.log("client ready");
});

client.on("message", message => {
	if(message.content === "?!ping") {
		message.reply("pong");
	}
});

client.login("TOKEN").catch(console.error);
```

Generally usage should be very similar to discord.js and you can safely refer to its documentation as long as you respect the caching differences explained later on in this readme.



## Client Options and Caching Behavior

The following client options were added to control caching behavior:

| Option | Type | Default | Description |
| ------------- | ------------- | ------------- | ------------- |
| cacheGuilds | boolean | true | Enables caching of all Guilds |
| cacheChannels | boolean | false | Enables caching of all Channels |
| cacheOverwrites | boolean | false | Enables caching of all Channel PermissionOverwrites. Required for channel permission checking |
| cacheRoles | boolean | false | Enables caching of all Roles. Required for permission checking |
| cacheEmojis | boolean | false | Enables caching of all Emojis |
| cachePresences | boolean | false | Enables caching of all Presences. If not enabled, Presences are cached only for cached Users |

If `cacheGuilds` is disabled, the library will completely give up control of guilds and will emit guildCreate events as per the Discord API, including the initial GUILD_CREATE packets as well as when guilds come back from being unavailable, so that you can implement your own guild tracking.

Users and Members are never cached automatically. The `fetchAllMembers` client option can be used to cache them, otherwise they must be manually fetched when required.

Voice States are cached while users are connected to a voice channel, and uncached when they leave. Requires the `GUILD_VOICE_STATES` intent.

This library implements its own partials system which is always enabled, therefore the `partials` client option is not available.

All other discord.js client options continue to be available and should work normally.


## Events Behavior

Most events should be identical to the originals aside from the caching behavior. Events always emit, regardless of the required data being cached or not, similar to enabling all partials in discord.js but including additional partials that discord.js doesnt support. When required data is missing, the event will emit a partial structure where only an id is guaranteed (the `.partial` property is not guaranteed to exist in all partials).

Events that emit past versions of a structure, such as update events, will emit `null` instead if not cached.

| Event | Emits | Notes |
| ------------- | ------------- | ------------- |
| message | Message | - |
| messageUpdate | Message or NULL, Message | - |
| messageDelete | Message | Partial Message if not cached |
| messageDeleteBulk | Collection | Collection of deleted Messages or Message Partials. |
| messageReactionAdd | Reaction, User | Partial User if DM and not cached. Does not include reaction count nor list of users if not cached |
| messageReactionRemove | Reaction, User | Partial User if DM and not cached. Does not include reaction count nor list of users if not cached |
| messageReactionRemoveAll | Message | Partial Message if not cached |
| messageReactionRemoveEmoji | Reaction | Does not include reaction count nor reaction users if not cached |
| channelCreate | Channel | - |
| channelUpdate | Channel or NULL, Channel | Old Channel is NULL if not cached |
| channelDelete | Channel | - |
| channelPinsUpdate | Channel, Date | Partial Channel if not cached |
| roleCreate | Role | - |
| roleUpdate | Role or NULL, Role | Old Role is NULL if not cached |
| roleDelete | Role | Partial Role if not cached |
| inviteCreate | Invite | - |
| inviteDelete | Invite | - |
| emojiCreate | Emoji | Only fires if Emojis are cached |
| emojiUpdate | Emoji, Emoji | Only fires if Emojis are cached |
| emojiDelete | Emoji | Only fires if Emojis are cached |
| guildBanAdd | Guild, User | Partial Guild if not cached |
| guildBanRemove | Guild, User | Partial Guild if not cached |
| guildCreate | Guild | - |
| guildUpdate | Guild or NULL, Guild | Old Guild is NULL if not cached |
| guildDelete | Guild | Partial Guild if not cached |
| guildUnavailable | Guild | Partial Guild if not cached |
| guildMemberAdd | Member | - |
| guildMemberUpdate | Member or NULL, Member | Old Member is NULL if not cached |
| guildMemberRemove | Member | Partial Member if not cached |
| guildIntegrationsUpdate | Guild | - |
| presenceUpdate | Presence or NULL, Presence | Old Presence is NULL if not cached |
| typingStart | Channel, User | Partial Channel and/or User if not cached |
| userUpdate | User or NULL, User | Old User is NULL if not cached |
| voiceStateUpdate | VoiceState or NULL, VoiceState or NULL | NULL if not connected to a voice channel |
| webhookUpdate | Channel | Partial Channel if not cached |
| guildEmojisUpdate | Collection | Non-standard event. Collection of up-to-date Emojis. Fired instead of Emoji events when Emojis are not cached |
| shardConnect | Number, Collection | Non-standard event. Shard ID and Collection of Partial Guilds assigned to this shard |

Non-partial structures only guarantee the contents of its top-level properties. Linked structures such as message**.channel** or reaction**.message** may be partials if not previously cached or fetched. This is especially true for Guild objects, which do not include Roles, Emojis, Channels, Members, Presences or VoiceStates unless previously cached, fetched, enabled or other conditions met.

Events not listed above should work normally as per the discord.js documentation.



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

All structures are replaced with a partial when the necessary data is not available. These partials only guarantee an id property but most of its class methods should still work. Depending on your needs, you may need to fetch these structures before being able to access their data.

The client itself will always be cached as a User and as a GuildMember in all cached guilds.

Unlike discord.js, this library will continue to function and emit partial events even if nothing is cached. You can send/receive messages and reactions to/from uncached channels and messages, receive update/delete events from uncached objects and even completely sweep the guild cache without breaking the library.



## Non-standard API

Some functionality was added and/or modified for dealing with the above caching changes among other conveniences:

### guild.channels.fetch(id,cache,withOverwrites)

Fetches channels from the `/guilds/:id/channels` endpoint. This endpoint bypasses VIEW_CHANNEL permissions.

**`id (string)`** - id of the channel to fetch. if omitted, fetches all guild channels instead, and the first and second parameters are treated as `cache` and `withOverwrites`

**`cache (boolean)`** - whether to cache the result. returns the guild channel cache if set to true without specifying a channel id, otherwise returns a channel or a collection of channels. defaults to true

**`withOverwrites (boolean)`** - whether to include channel permissionOverwrites. always true if `enablePermissions` is enabled or if guild roles are cached, otherwise defaults to false

**`returns`** - `Promise (Channel | Collection of Channels | guild.channels.cache)`

### guild.members.fetch(options)

Replaces the original guild.members.fetch() method. Fetches guild members from the gateway or from the `/guilds/:id/members` endpoint based on the options below.

**`options (object)`** - object of options

**`options.rest (boolean)`** - whether to use the rest endpoint instead of the gateway. defaults to false

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

Fetches all guild emojis from the `/guilds/:id/emojis` endpoint.

**`cache (boolean)`** - whether to cache the results. returns the emoji cache if set to true, otherwise returns a collection of emojis. defaults to true

**`returns`** - `Promise (Collection of Emojis | guild.emojis.cache)`

### guild.roles.fetch(cache)

Fetches all guild roles from the `/guilds/:id/roles` endpoint.

**`cache (boolean)`** - whether to cache the results. returns the role cache if set to true, otherwise returns a collection of roles. defaults to true

**`returns`** - `Promise (Collection of Roles | guild.roles.cache)`

### client.guilds.fetch(id,cache)

Fetches a single guild from the `/guilds/:id` endpoint.

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

### message.eval(content)

An eval function compatible with promises, async/await syntax and complex code. Can access the client via `client` and the message object via `this`

**`content (string)`** - string to evaluate. if evaluated to a promise, returns `{Promise:result}`, otherwise returns `result`

**`returns`** - `Promise (Object | Anything)`

### message.reply(content,options)

Replaces the original message.reply() method and includes the following changes:

* Does not automatically mention the author
* Handles promises, objects, falsey values and other non-string types
* Truncates large strings if no split options are provided
* Automatically caches the channel, author and messages involved
* Adds a lastActive timestamp to the author for activity tracking
* Adds response times and request-response pairing properties to both messages
* When triggered by a message update, replies by editing the previous response if possible

**`content (anything)`** - content to send. non-strings will be serialized. pass an empty string as a first parameter if you dont want to send any text content.

**`options (object)`** - message options object as per discord.js. the options object can only be passed as the second parameter, otherwise it will be serialized and sent as text.

**`returns`** - `Promise (Message)`

### message.commandResponse

(Message) The message object that was sent in response to this message (only if responded with message.reply)

### message.commandMessage

(Message) The message object that triggered this response (only if responded with message.reply)

### message.commandResponseTime

(number) Message response time in milliseconds (only if responded with message.reply)

### user.lastActive

(number) Timestamp of the last time the client interacted with this user

### user.noSweep

(boolean) Set to true to disable sweeping of this user

### channel.lastActive

(number) Timestamp of the last time the client interacted with this channel

### channel.noSweep

(boolean) Set to true to disabled sweeping of this channel



## Notes

This project is somewhat experimental, so there might be bugs and broken features in untested scenarios. You are encouraged make your own tests with your specific use cases and post any issues, questions, suggestions, feature requests or contributions you may find.

You can also find me in [discord](https://discord.gg/BpeedKh) (Tim#2373)

## Bots using discord.js-light

[Astrobot](https://top.gg/bot/astrobot)

[Message Viewer](https://top.gg/bot/642052166982303754)

[Helper](https://top.gg/bot/409538753997307915)

(using discord.js-light? let me know if you're interested in having your bot being listed here)