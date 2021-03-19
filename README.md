# discord.js-light

All the power of [discord.js](https://discord.js.org), zero caching.

This library modifies discord.js's internal classes and functions in order to give you full control over its caching behaviour. Say goodbye to exorbitant memory usage!

[![npm](https://img.shields.io/npm/v/discord.js-light?label=current%20version)](https://www.npmjs.com/package/discord.js-light)
[![GitHub Release Date](https://img.shields.io/github/release-date/timotejroiko/discord.js-light?label=last%20updated)](https://github.com/timotejroiko/discord.js-light/releases)
[![npm (prod) dependency version](https://img.shields.io/npm/dependency-version/discord.js-light/discord.js)](https://discord.js.org)
[![node](https://img.shields.io/node/v/discord.js-light)](https://nodejs.org)
[![Discord](https://img.shields.io/discord/581072557512458241?label=support%20server)](https://discord.gg/BpeedKh)

## Branches

* **master** - latest updates, based on the discord.js master branch
* **v3** - current npm version, based on the discord.js stable branch
* **v2** - deprecated
* **v1** - deprecated

## Why?

Discord.js has been THE javascript discord library for a long time now, and successfully powers thousands of bots, but as your bot grows larger, you will notice a substantial increase in resource usage, especially in memory consumption.

This is because discord.js caches as much as it can in order to avoid hitting the Discord API as well as to better provide many of its features. This can however make your bots feel bloated because the library is caching and processing data that your bot will likely never use.

This library solves the problem by giving developers full control over how and when discord.js should cache the data it receives from the API.

## The Impact of Caching

Caching is the process of keeping a copy of something in memory. Most Discord libraries will keep data received from Discord in memory for any eventual needs. Caching Discord data gives you access to features such as looping through channels, finding something by name or by anything other than an ID, keeping a backup of old data accessible to update and delete events, perform permission checking and so on. Caching is very useful and makes a lot of features possible, but at a cost...

The following test is a \~3 hour run (each tick is 10 minutes), with \~3700 guilds total (4 internal shards), with all intents enabled (including presences), and with message caching disabled (messageCacheMaxSize:0). This test measures caching overhead by periodically checking `process.memoryUsage().heapUsed` in MB. Your actual memory usage still depends on your code and the node.js overhead so it will likely be higher.

![The Impact of Caching](bench.png)

As you can see, excessive caching can be very costly in terms of memory requirements, especially at scale. By disabling all major caches we were able to reduce memory usage from \~500mb to less than 20mb. Unfortunately neither discord.js nor eris, the two most popular javascript libraries, provide a way to control or disable parts of their caching systems. The ability to selectively disable caches that your bot doesn't need can greatly reduce resource usage, so much that it becomes invaluable at scale.

More and more projects are being developed with such flexibility in mind, such as `@klasa/core` and `detritus`, and this library brings this much needed caching flexibility to discord.js with as little side effects as possible.

## Features

* Provides all of discord.js's events without any kind of automated caching
* Most structures remain intact so your existing discord.js code should work without many changes
* Custom partials system ensures events are always emitted regardless of caching state
* Fully functional partials are given when the required data is not cached
* Most things can be manually fetched and/or cached when needed
* Drastically lower resource usage at scale

## Usage

### Installation

```npm install discord.js-light```

Optional packages (recommended to reduce bandwidth usage and improve websocket performance). These packages are plug and play, just install and they will be picked up automatically.

```bash
npm install zlib-sync
npm install bufferutil
npm install discord/erlpack
npm install utf-8-validate
```

Additionally, using an alternative memory allocator such as [jemalloc](http://jemalloc.net) can further reduce memory usage by avoiding fragmentation in exchange for slightly higher cpu usage.

### Usage example

```js
const Discord = require("discord.js-light");
const client = new Discord.Client({
    cacheGuilds: true,
    cacheChannels: false,
    cacheOverwrites: false,
    cacheRoles: false,
    cacheEmojis: false,
    cachePresences: false
});

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

Generally, usage should be identical to discord.js and you can safely refer to its documentation as long as you respect the caching differences explained below.

## Client Options

The following client options are available to control caching behavior:

| Option | Type | Default | Description |
| ------------- | ------------- | ------------- | ------------- |
| cacheGuilds | boolean | true | Enables caching of all Guilds at login |
| cacheChannels | boolean | false | Enables caching of all Channels at login |
| cacheOverwrites | boolean | false | Enables PermissionOverwrites in cached and fetched channels |
| cacheRoles | boolean | false | Enables caching of all Roles at login |
| cacheEmojis | boolean | false | Enables caching of all Emojis at login |
| cachePresences | boolean | false | Enables caching of all Presences. If not enabled, Presences will be cached only for cached Users |
| cacheMembers | boolean | false | Enables caching of Users and Members when possible |
| disabledEvents | array | [] | An array of events to ignore ([Discord events](https://github.com/discordjs/discord.js/blob/master/src/util/Constants.js#L339), not Discord.JS events). Use this in combination with intents for fine tuning which events your bot should process |

This library implements its own partials system, therefore the `partials` client option is not available. All other discord.js client options continue to be available and should work normally.

## Caching Behavior

Below is a quick summary and explanation on caches:

### Guilds

This cache has a very low memory footprint and provides lots of useful information that most bots will want to use at some point. If disabled, the library will give up control of guilds and instead emit `guildCreate` events as per the Discord API, including the initial `GUILD_CREATE` packets as well as when guilds come back from being unavailable. This is so that you can implement your own guild tracking and/or caching. Guilds can also be fetched when needed but some properties may not be available this way.

### Channels

Channels have a pretty large impact on memory usage and most common bot features should work normally without them. You only need this cache if you track channel updates or if you want to find channels by anything other than an ID, and even then there might be more efficient solutions. Channels can always be fetched when needed.

### Overwrites

PermissionOverwrites may have a moderate impact on memory usage when channels are cached, and are required for checking permissions on specific channels. Enabling this cache without enabling `cacheChannels` will eliminate its memory footprint but requires you to cache or fetch the channel before being able to check permissions on it. PermissionOverwrites are included when fetching channels if the `withOverwrites` option is enabled.

### Roles

Roles may have a moderate memory footprint but are required for general permission checking. You can still access Member Roles without enabling this cache, but they will be partials instead, which only contain an ID and nothing else. Roles can also be fetched when needed.

### Emojis

Emojis usually have a low memory footprint but are only really needed if you want to list emojis often, find emojis by name or keep track of emoji updates, otherwise they can always be fetched when needed.

### Presences

Presences have a large impact on memory usage and are not needed most of the time. Presences are only cached if the User they belong to is cached but enabling this cache will enable caching of all Presences, including those belonging to uncached Users and Members. You only need this if you want to track people's statuses and activities in real time. Presences are included when fetching members if the `withPresences` option is enabled. Presences require the `GUILD_PRESENCES` intent.

### Users and Members

The bot itself is always cached in `client.user` and `guild.me`. All other Users and Members must be manually fetched if this cache is disabled. If enabled, fetching is still recommended because the cache may be incomplete unless you manually fetch all members in all guilds. Events that include some User and/or Member data usually do not require fetching as the event itself already contains enough information to provide a complete User and/or Member object.

### VoiceStates

Voice States will be cached if the `GUILD_VOICE_STATES` intent is enabled (required for voice features to work), otherwise they will not be cached.

### Messages

Messages are cached only if the Channel they belong to is cached. Message caching can further be controlled via discord.js's `messageCacheMaxSize`, `messageCacheLifetime` and `messageSweepInterval` client options as usual. Additionally, the `messageEditHistoryMaxSize` client option is set to `1` by default (instead of infinity).

## Events

Most events should be identical to the originals aside from the caching behavior plus they always emit regardless of caching state. When required data is missing, a partial structure where only an id is guaranteed will be given (the `.partial` property is not guaranteed to exist on all partials).

Events that emit past versions of a structure, such as update and delete events, will emit either `null` or partial if not cached instead of not being emitted at all.

| Event | Emits | Notes |
| ------------- | ------------- | ------------- |
| message | Message | Includes some User and Member data |
| messageUpdate | Message?,  Message | Old Message is NULL if not cached. New Message includes some User and Member data |
| messageDelete | Message | Partial Message if not cached |
| messageDeleteBulk | Collection | Collection of deleted Messages or Partial Messages as above |
| messageReactionAdd | Reaction,  User | Includes some User and Member data (partial if DMs) |
| messageReactionRemove | Reaction,  User | Partial User if not cached |
| messageReactionRemoveAll | Message | Partial Message if not cached |
| messageReactionRemoveEmoji | Reaction | - |
| channelCreate | Channel | - |
| channelUpdate | Channel?,  Channel | Old Channel is NULL if not cached |
| channelDelete | Channel | - |
| channelPinsUpdate | Channel,  Date | Partial Channel if not cached |
| roleCreate | Role | - |
| roleUpdate | Role?,  Role | Old Role is NULL if not cached |
| roleDelete | Role | Partial Role if not cached |
| inviteCreate | Invite | Includes some User data |
| inviteDelete | Invite | - |
| emojiCreate | Emoji | Only emits if Emojis are cached |
| emojiUpdate | Emoji,  Emoji | Only emits if Emojis are cached |
| emojiDelete | Emoji | Only emits if Emojis are cached |
| guildEmojisUpdate | Collection | Non-standard event. Emitted instead of Emoji events when Emojis are not cached. Provides a Collection of updated Emojis |
| guildBanAdd | Guild,  User | Partial Guild if not cached |
| guildBanRemove | Guild,  User | Partial Guild if not cached |
| guildCreate | Guild | Does not include disabled data |
| guildUpdate | Guild?,  Guild | Old Guild is NULL if not cached |
| guildDelete | Guild | Partial Guild if not cached |
| guildUnavailable | Guild | Partial Guild if not cached |
| guildMemberAdd | Member | Includes some User data |
| guildMemberUpdate | Member?,  Member | Old Member is NULL if not cached. new Member includes some User data |
| guildMemberRemove | Member | Partial Member if not cached |
| guildIntegrationsUpdate | Guild | Partial Guild if not cached |
| presenceUpdate | Presence?,  Presence | Old Presence is NULL if not cached. New Presence includes some Member data |
| typingStart | Channel,  User | Partial Channel. Includes some User and Member data (partial if DMs) |
| userUpdate | User?,  User | Old User is NULL if not cached |
| voiceStateUpdate | VoiceState?,  VoiceState? | NULL when data does not include a Channel ID (indicates disconnection). Includes some User and Member data |
| webhookUpdate | Channel | Partial Channel if not cached |
| shardConnect | Number,  Collection | Non-standard event. Emitted when a shard connects to Discord. Provides a Shard ID and a Collection of Partial Guilds assigned to this shard |
| rest | Object | Non-standard event. Emitted when the library makes an API request to Discord. Provides an object containing the request method, path and optionally a response buffer (buffer is only included if the client option restEventIncludeBuffer is set to true) |

Events that include some User and/or Member data will contain full or mostly full User and/or Member objects even if not cached, for example `message.author` will always contain a full User object, including most of its properties, even if said user is not cached.

Structures not marked as partial only guarantee the contents of its top-level properties. Linked structures such as message`.channel` or reaction`.message` may still be partials if not previously cached or fetched. This is especially true for Guild objects, which do not include Roles, Emojis, Channels, Members, Presences or VoiceStates unless previously cached, fetched, enabled or other conditions met.

Events not listed above should continue to work normally as per the discord.js documentation.

## Fetch Methods

Fetch methods are used to obtain data from the Discord API when needed and optionally cached for reuse. Once data is cached, it will remain in the cache until manually removed. Cached data will be automatically updated as new Discord events are received.

Some fetch methods are already included by default in discord.js, others were added or tweaked as below:

### client.channels.fetch()

`.fetch(id)`  
`.fetch(id,cache)`  
`.fetch(id,options)`  
`.fetch(options)`  

**`returns`** - `Promise (Channel)`

Fetches a single channel from the `/channels/:id` endpoint. This method is identical to the original except that it includes an additional `withOverwrites` option.

* **`id or options.id (string)`** - id of the channel to fetch.
* **`cache or options.cache (boolean)`** - whether to cache the result if not cached. defaults to true.
* **`options.withOverwrites (boolean)`** - whether to include permissionOverwrites. always true if `cacheOverwrites` is enabled. defaults to false.
* **`options.force (boolean)`** - whether to force fetch the channel from the api even if its already cached. defaults to false.

### client.guilds.fetch()

`.fetch()`  
`.fetch(cache)`  
`.fetch(id)`  
`.fetch(id,cache)`  
`.fetch(id,options)`  
`.fetch(options)`  

**`returns`** - `Promise (Guild | Collection of Guilds)`

Fetches a single guild from the `/guilds/:id` endpoint, or multiple guilds from the `/users/@me/guilds` endpoint. When fetching multiple guilds, some guild information may be stripped away by Discord. Additionally fetching multiple guilds is extremely slow, taking roughly 20 seconds per 1000 guilds. If you need to fetch thousands of guilds, it's much faster to create a new connection to the gateway. Fetching multiple guilds also bypasses the guild cache, whereas fetching a specific guild id will always check the cache first.

* **`id or options.id (string)`** - id of the guild to fetch. if not provided, fetches all guilds instead.
* **`cache or options.cache (boolean)`** - whether to cache the results. defaults to true.
* **`options.limit (number)`** - max amount of results (0 for no limit). defaults to 0.
* **`options.before (string)`** - a guild id to search only guilds with a smaller id (0 for any). defaults to 0.
* **`options.after (string)`** - a guild id to search only guilds with a bigger id (0 for any). defaults to 0.
* **`options.force (boolean)`** - whether to force fetch the guild from the api even if already cached. defaults to false.

### guild.channels.fetch()

`.fetch()`  
`.fetch(cache)`  
`.fetch(id)`  
`.fetch(id,cache)`  
`.fetch(id,options)`  
`.fetch(options)`  

**`returns`** - `Promise (Channel | Collection of Channels)`

Fetches channels from the `/guilds/:id/channels` endpoint. This endpoint bypasses the `VIEW_CHANNEL` permission. Fetching all channels also bypasses the channel cache, whereas fetching a specific channel id always checks the cache first.

* **`id or options.id (string)`** - id of the channel to fetch. if not provided, fetches all guild channels instead.
* **`cache or options.cache (boolean)`** - whether to cache the results. defaults to true.
* **`options.withOverwrites (boolean)`** - whether to include permissionOverwrites. always true if `cacheOverwrites` is enabled. defaults to false.
* **`options.force (boolean)`** - whether to force fetch the channel from the api even if its already cached. defaults to false.

### guild.members.fetch()

`.fetch()`  
`.fetch(cache)`  
`.fetch(id)`  
`.fetch(id,cache)`  
`.fetch(id,options)`  
`.fetch(options)`  

**`returns`** - `Promise (GuildMember | Collection of GuildMembers)`

Fetches guild members from the gateway or from the `/guilds/:id/members` endpoint. This method is identical to the original but includes a few additional options.

* **`id or options.user (string)`** - id of the member to fetch. if not provided, fetches all guild members instead.
* **`id or options.user (array)`** - array of member ids to fetch (gateway only, requires the `GUILD_MEMBERS` intent).
* **`cache or options.cache (boolean)`** - whether to cache all results. defaults to true.
* **`options.rest (boolean)`** - whether to use the rest endpoint instead of the gateway. defaults to true when fetching a single id, otherwise defaults to false.
* **`options.query (string)`** - query to search for members by username (gateway only). set to `""` for all members (setting to `""` requires the `GUILD_MEMBERS` intent). defaults to `""`;
* **`options.limit (number)`** - max amount of results (0 for no limit. setting to 0 requires the `GUILD_MEMBERS` intent). defaults to 0.
* **`options.after (string)`** - a user id to search only users with a bigger id (rest only).
* **`options.withPresences (boolean)`** - whether to include presence data (gateway only, requires the `GUILD_PRESENCES` intent). this option also requires the `cachePresences` client option to be enabled, or that the `cache` option is enabled, or that the relevant users are already cached.
* **`options.time (number)`** - max amount of time to wait for a response in milliseconds (gateway only). defaults to 60000.
* **`options.force (boolean)`** - whether to force fetch members even if already cached. defaults to false.

### guild.emojis.fetch()

`.fetch()`  
`.fetch(cache)`  
`.fetch(id)`  
`.fetch(id,cache)`  
`.fetch(id,options)`  
`.fetch(options)`  

**`returns`** - `Promise (Emoji | Collection of Emojis)`

Fetches guild emojis from the `/guilds/:id/emojis` endpoint.

* **`id or options.id (string)`** - the id of the emoji to fetch. if not provided, fetches all guild emojis instead.
* **`cache or cache.id (boolean)`** - whether to cache the results. defaults to true.
* **`options.force (boolean)`** - whether to force fetch the emoji even if already cached. defaults to false.

### guild.roles.fetch()

`.fetch()`  
`.fetch(cache)`  
`.fetch(id)`  
`.fetch(id,cache)`  
`.fetch(id,options)`  
`.fetch(options)`  

**`returns`** - `Promise (Role | Collection of Roles)`

Fetches guild roles from the `/guilds/:id/roles` endpoint.

* **`id or options.id (string)`** - the id of the role to fetch. if not provided, fetches all guild roles instead.
* **`cache or options.cache (boolean)`** - whether to cache the results. defaults to true
* **`options.force (boolean)`** - whether to force fetch the role even if already cached. defaults to false.

### reaction.users.fetch()

`.fetch(options)`

**`returns`** - `Promise (Collection of Users)`

Fetches users from the `/channels/:id/messages/:id/reactions/:emoji`. This endpoint is identical to the original except that it includes a `cache` option.

* **`options.limit (number)`** - max amount of results (0 for no limit). defaults to 0.
* **`options.before (string)`** - a user id to search only users with a smaller id (0 for any). defaults to 0.
* **`options.after (string)`** - a user id to search only users with a bigger id (0 for any). defaults to 0.
* **`options.cache (boolean)`** - whether to cache the results. defaults to true.

## Forge Methods

Forge methods are a set of non-standard methods used to interact with the Discord API without requiring a cache. They provide a way to create Partial instances on demand, which is especially useful when sharding. For example, sending a message to a specific channel ID:

```js
// fetch method, requires an API round trip if channel is not available
let channel = await client.channels.fetch(id, false);
await channel.send("message");

// using broadcastEval if channel is available in another shard
await client.broadcastEval(`
    let channel = client.channels.cache.get("${id}");
    if(channel) { channel.send("message"); }
`);

// forge method, works from any shard and regardless of caching
await client.channels.forge(id).send("message");
```

Forge methods avoid unnecessary round trips and give you access to all the api methods of each class, however there isn't any form of data validation, it's up to you to provide valid IDs.

The following forge methods are available:

### client.users.forge(id)

Creates a User instance from a user ID.

### client.guilds.forge(id)

Creates a Guild instance from a guild ID.

### client.channels.forge(id,type)

Creates a Channel instance from a channel ID and channel type. Defaults to DMChannel.

### guild.channels.forge(id,type)

Creates a Channel instance from a channel ID and channel type. Defaults to TextChannel.

### guild.members.forge(id)

Creates a GuildMember instance from a user ID and the current guild.

### guild.emojis.forge(id)

Creates an Emoji instance from an emoji ID.

### guild.roles.forge(id)

Creates a Role instance from a role ID.

### guild.presences.forge(id)

Creates a Presence instance from a user ID.

### channel.messages.forge(id)

Creates a Message instance from a message ID.

### message.reactions.forge(emoji or id)

Creates a MessageReaction instance from an emoji id or emoji unicode and the current message.

## Sweep Methods

This library includes two additional utility methods to help with manual cache control. Furthermore all discord.js Collections include .sweep() and .clear() methods which can be used to manually clear caches.

### client.sweepUsers()

`client.sweepUsers(lifetime)`

**`returns`** - `Void`

Sweeps all cached Users and Members whose last message is older than the supplied time.

* **`lifetime (number)`** - User's last message's age in seconds. Defaults to 86400 (24 hours).

### client.sweepChannels()

`client.sweepChannels(lifetime)`

**`returns`** - `Void`

Sweeps all cached Channels whose last message is older than the supplied time.

* **`lifetime (number)`** - Channel's last message's age in seconds. Defaults to 86400 (24 hours).

## Notes

This project has come a long way and gone through a lot of testing, however it is still somewhat experimental. There might be silly bugs or broken features in untested scenarios. You are encouraged to make your own tests with your specific use cases and post any issues, questions, suggestions, feature requests or contributions you may find.

You can also find me in [discord](https://discord.gg/BpeedKh) (Tim#2373)

## Bots using discord.js-light
<!-- markdownlint-disable MD045 -->
| Bot | Servers |
|-|-|
| [Birthday Bot](https://top.gg/bot/656621136808902656) | ![](https://top.gg/api/widget/servers/656621136808902656.svg) |
| [Dio](https://top.gg/bot/565050363313389588) | ![](https://top.gg/api/widget/servers/565050363313389588.svg) |
| [Truth or Dare](https://top.gg/bot/692045914436796436) | ![](https://top.gg/api/widget/servers/692045914436796436.svg) |
| [Friend Time](https://top.gg/bot/471091072546766849) | ![](https://top.gg/api/widget/servers/471091072546766849.svg) |
| [Nagito 2](https://top.gg/bot/741061042343510147) | ![](https://top.gg/api/widget/servers/741061042343510147.svg) |
| [Suggestions](https://top.gg/bot/474051954998509571) | ![](https://top.gg/api/widget/servers/474051954998509571.svg) |
| [D-Safe](https://discordsafe.com) | ![](https://top.gg/api/widget/servers/461171501715161108.svg) |
| [QOTD Bot](https://top.gg/bot/713586207119900693) | ![](https://top.gg/api/widget/servers/713586207119900693.svg) |
| [Bump Reminder](https://top.gg/bot/735147814878969968) | ![](https://top.gg/api/widget/servers/735147814878969968.svg) |
| [Filo](https://filobot.xyz) | ![](https://top.gg/api/widget/servers/568083171455795200.svg) |
| [Alita](https://top.gg/bot/590047618479030272) | ![](https://top.gg/api/widget/servers/590047618479030272.svg) |
| [Astrobot](https://top.gg/bot/astrobot) | ![](https://top.gg/api/widget/servers/344272098488877057.svg) |
| [Kable](https://kable.bot) | ![](https://top.gg/api/widget/servers/699844962057060393.svg) |
| [Monika](https://top.gg/bot/340476335279570945) | ![](https://top.gg/api/widget/servers/340476335279570945.svg) |
| [Helper](https://top.gg/bot/409538753997307915) | ![](https://top.gg/api/widget/servers/409538753997307915.svg) |
| [CalcBot](https://top.gg/bot/674457690646249472) | ![](https://top.gg/api/widget/servers/674457690646249472.svg) |
| [Scathach](https://discord.bots.gg/bots/724047481561809007) | ![](https://top.gg/api/widget/servers/724047481561809007.svg) |
| [Hydra bot](https://hydrabot.xyz) | ![](https://top.gg/api/widget/servers/716708153143590952.svg) |
| [Game Tracker](https://game-tracker.js.org) | ![](https://top.gg/api/widget/servers/475421235950518292.svg) |
| [Denky](https://denkybot.ga) | ![](https://top.gg/api/widget/servers/704517722100465746.svg) |
| [Melody](https://melodybot.tk) | ![](https://top.gg/api/widget/servers/739725994344316968.svg) |
| [Anti NSFW](https://top.gg/bot/706054368318980138) | ![](https://top.gg/api/widget/servers/706054368318980138.svg) |
| [FlaviBot](https://flavibot.xyz) | ![](https://top.gg/api/widget/servers/684773505157431347.svg) |
| [Animal Bot](https://top.gg/bot/716061781172158464) | ![](https://top.gg/api/widget/servers/716061781172158464.svg) |
| [Aeon](https://aeon.js.org) | ![](https://top.gg/api/widget/servers/635833307510079490.svg) |
| [T_Moderator_Bot](https://top.gg/bot/412003088732389396) | ![](https://top.gg/api/widget/servers/412003088732389396.svg) |
| [Custom Command](https://ccommandbot.ga) | ![](https://top.gg/api/widget/servers/725721249652670555.svg) |
| [Tamaki](https://top.gg/bot/716322665283059754) | ![](https://top.gg/api/widget/servers/716322665283059754.svg) |
| [CleverChat](https://top.gg/bot/781834206325243954) | ![](https://top.gg/api/widget/servers/781834206325243954.svg) |
| [Music Boat](https://top.gg/bot/735963752259911752) | ![](https://top.gg/api/widget/servers/735963752259911752.svg) |
| [Message Viewer](https://top.gg/bot/642052166982303754) | ![](https://top.gg/api/widget/servers/642052166982303754.svg) |
| [Art Prompts](https://eledris.com/art-prompts/discord-bot) | ![](https://top.gg/api/widget/servers/676880644076339228.svg) |
| [T_Music_Bot](https://top.gg/bot/421978090823090186) | ![](https://top.gg/api/widget/servers/421978090823090186.svg) |
| [Stalk.live](https://stalk.live) |  |
| [Multipurpose+](https://music.udit.gq) |  |
| [Stereo](https://github.com/NathanPenwill/Stereo) |  |
| [Coconut Mall'd](https://github.com/Million900o/coconut-malld) |  |
| [Discord.js Bot Template](https://github.com/Giuliopime/discordjs-bot-template) |  |

(using discord.js-light? let me know if you're interested in having your bot listed here)
