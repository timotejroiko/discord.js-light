# discord.js-light

A minimalistic [discord.js (v12)](https://discord.js.org) framework focused on disabling the original library's aggressive caching behavior to prevent excessive resource usage. It works by modifying a few of discord.js' classes and functions to prevent data from being cached at the source, and introduces workarounds to keep its data structures intact as unofficial partials.

[![npm](https://img.shields.io/npm/v/discord.js-light?label=current%20version)](https://www.npmjs.com/package/discord.js-light)
[![GitHub Release Date](https://img.shields.io/github/release-date/timotejroiko/discord.js-light?label=last%20updated)](https://github.com/timotejroiko/discord.js-light/releases)
[![npm (prod) dependency version](https://img.shields.io/npm/dependency-version/discord.js-light/discord.js)](https://discord.js.org)
[![node](https://img.shields.io/node/v/discord.js-light)](https://nodejs.org)
[![Discord](https://img.shields.io/discord/581072557512458241?label=support%20server)](https://discord.gg/BpeedKh)

## Why?

Discord.js has been THE javascript discord library for a long time now, and successfully powers thousands of bots. But as your bot grows larger, you will start noticing a horrendous increase in resource usage, especially memory consumption.

This is due to the fact that discord.js caches EVERYTHING it can in order to avoid hitting the Discord API as much as possible. This behavior can however make the library feel bloated for most developers as many times the library is caching and processing data that your bot will never use.

This issue has been discussed a few times by the community but ultimately it has been decided that the library is too tightly coupled with its caching systems and seperating them would be unfeasible. Thus the task of scaling falls back to us bot developers.

Several solutions have been presented so far, such as regular cache sweeping. However i felt that the existing methods were lacking and decided to design my own solution. This project later became the base boilerplate for all my bots and it does a wonderful job keeping hosting costs and scaling maintenance in check.

## Features

* Provides most of discord.js's basic events without any automatic caching
* Most classes have their structures intact and can be used the same way as the original library
* Partial objects are given when data is missing and can be manually fetched and cached when needed
* Fully compatible with Discord's new intents system to receive only data that is actually used (enabled by default)
* Uses a fraction of memory, cpu and bandwidth compared to the original library (benchmarks can be found in the djs-shenanigans folder)

## Getting Started

Installation:

```npm install discord.js-light```

optional packages (recommended to improve performance, especially zlib-sync)

```
npm install zlib-sync
npm install bufferutil
npm install discordapp/erlpack
npm install utf-8-validate
```

Simple usage:

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

Unlike its predecessor, discord.js-light attempts to deliver a cleaner discord.js experience and as such it does not include prefix managers or command handlers. It is still however a fairly opinionated framework and includes some non-standard behavior such as convenience methods and functions, auto-login, internal sharding and intents enabled by default, sweeping intervals and logging of connection events. PM2 cluster support was also removed to be reworked as a separate feature in the future.

## Caching Behavior

This library alters the default caching behavior as follows:

* Users are not cached by default. Users can be manually cached by using `client.users.fetch(id)`. This will not cache the guild member.
* Channels are not cached by default. Channels can be manually cached using `client.channels.fetch(id)`. This will not cache the channel in the guild.
* Messages are not cached by default. Messages can be manually cached by fetching its channel and then using `channel.messages.fetch(id)`
* Guilds are cached at login and will be kept updated as long as they remain in the cache, but not all of its contents are cached (see below). Guilds can also be safely sweeped/removed from the cache for additional memory saving in exchange for losing access to some guild information.
* Guild Emojis are not cached by default. Emojis can be cached by using `guild.fetch()`. Once cached, they will be kept updated while they remain in the cache.
* Guild Roles are not cached by default unless the client option `enablePermissions` is set to true. Roles can be cached by using `guild.roles.fetch()`. Once cached, they will be kept updated while they remain in the cache.
* Guild Members are not cached by default. Members can be cached by using `guild.members.fetch(id)`. This will not cache the user which will need to be fetched separately.
* Guild Channels are not cached by default. Guild Channels can be added to the guild cache by fetching the channel and then linking it using `guild.channels.cache.set(fetchedChannel.id,fetchedChannel)`.
* Guild Channel Permission Overwrites are not cached by default unless the client option `enablePermissions` is set to true. They can only be cached by fetching guild roles to ensure roles are updated, then fetching the channel and linking it to the guild (if the channel was already cached before roles were enabled, you will need to delete it from the cache and fetch it again). Once cached, they will be updated as long as they remain in the cache.
* Guild Presences and VoiceStates are completely disabled at the moment.

All relevant events provide a temporary/partial object if the full object is not cached. These objects may have missing information, so depending on your needs, you might need to fetch them before using them.

Messages sent by the client itself will automatically cache the relevant objects (DMChannel/User, GuildChannel and Message).

Unlike discord.js, discord.js-light will function properly even if nothing is cached and methods will work properly when called on the provided partials and temporary objects. You can send/receive messages to/from uncached channels, send/receive reactions to/from uncached messages, receive update/delete events from uncached objects and even completely sweep the guild cache without breaking the library.

## Client options

Some additional client options were introduced to control certain aspects of this library

| Option | Type | Description |
| ------------- | ------------- | ------------- |
| clientSweepInterval | number | Set how often to sweep inactive cached channels and users in seconds. Set to `0` to disable (default:86400) |
| shardCheckInterval | number | Set how often to check for shard activity in seconds (internal sharding only). Inactive shards will be forced to reconnect (workaround for a rare issue with discord.js where shards randomly disconnect and refuse to reconnect). Set to `0` to disable (default:600) |
| enablePermissions | boolean | This option enables caching of Guild Roles and GuildChannel PermissionOverwrites in order to allow for permission checking. This will of course increase memory usage a bit (default:false) |

## Events

Most events should be identical to the originals besides the caching behavior. All partial objects will be full objects if cached.

| Event | Description |
| ------------- | ------------- |
| message | This event is fired by both new messages and edited messages. It provides a full Message object with a partial Channel object. The messageUpdate event was merged into the message event in order to make it easy for the bot to reply to edited messages. Edited messages can be identified by checking for the existence of message.editedTimestamp and be accessed from message.edits if cached |
| messageDelete | Provides a partial Message object with a partial Channel object |
| messageDeleteBulk | Provides a Collection of deleted messages as above |
| messageReactionAdd | Provides full Reaction object with partial Message object, and full User object (partial if DM). Does not provide Reaction count nor Reaction users if not cached |
| messageReactionRemove | Provides full Reaction object with partial Message object, and full User object (partial if DM). Does not provide Reaction count nor Reaction users if not cached |
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
| guildUpdate | Provides a NULL old Guild object if not cached and a NULL new Guild object if not cached \* |
| guildDelete | Provides a NULL Guild object if not cached |
| userUpdate | Provides a NULL old User object if not cached and a full new User object |
| guildMemberAdd | Provides a full Member object. Requires the GUILD MEMBERS priviledged intent |
| guildMemberUpdate | Provides a NULL old Member object if not cached and a full new Member object. Requires the GUILD MEMBERS priviledged intent |
| guildMemberRemove | Provides a partial Member object. Requires the GUILD MEMBERS priviledged intent |

\* Guild Objects do not contain Roles, Emojis, Channels or Members unless previously cached or fetched. Presences and VoiceStates are always empty.

All other events (except connection events) are currently disabled.

## Additional Functionality

Some extra functionality is also included:

| Func/Prop | Type | Description |
| ------------- | ------------- | ------------- |
| Message.eval(string) | promise>anything | An eval function compatible with promises, async/await syntax and complex code. Can access the client via `client` and the message object via `this` (should not be public) |
| Message.reply(content,options) | promise>message | Completely replaces the original message.reply(). It does the same as message.channel.send() but adds several improvements: handles promises, objects, falsey values and other non-string types, truncates large strings if no split options are provided, automatically caches the channel, author and messages involved, tracks activity for automatic sweeping, adds response times, adds request-response pairing and if possible sends responses as edits when triggered by editing a previous command |
| Message.commandResponse | message | The message object that was sent as a response to this command. Only available if it was sent with message.reply() |
| Message.commandMessage | message | The message object that triggered this response. Only available if this response was sent with message.reply() |
| Message.commandResponseTime | number | Message response time in milliseconds. Only available in response messages if they were sent with message.reply() |
| Channel.lastActive | number | Timestamp of the last time this channel was used by the client |
| Channel.noSweep | boolean | Set to `true` if this channel should be cached forever |
| User.lastActive | number | Timestamp of the last time this user was replied to by message.reply() |
| User.noSweep | boolean | Set to `true` if this user should be cached forever |
| Client.options.clientSweepInterval | number | Client option to set how often to sweep inactive cached channels and users in seconds. Set to `0` to disable (default:86400) |
| Client.options.shardCheckInterval | number | Client option to set how often to check for shard activity in seconds (internal sharding only). Inactive shards will be forced to reconnect (workaround for a rare issue with discord.js where shards randomly disconnect and refuse to reconnect). Set to `0` to disable (default:600) |
| Client.sweepInactive() |  | Sweep inactive users/channels |
| Client.checkShards() |  | Check for inactive shards (internal sharding only) |
| Client.getInfo() | promise>object | Gather several statistics about the client such as guild count, user count, sharding information, total active (cached) users and channels, websocket pings, uptimes, cpu usage and memory usage |

## About

This project is somewhat experimental, so there might be bugs and broken features in untested scenarios. You are encouraged make your own tests with your specific use cases and post any issues, questions, suggestions, feature requests or contributions you might find.

You can also find me in [discord](https://discord.gg/BpeedKh) (Tim#2373)

[![Patreon](https://img.shields.io/endpoint.svg?url=https%3A%2F%2Fshieldsio-patreon.herokuapp.com%2Ftimotejroiko&label=support%20me%20on%20patreon)](https://www.patreon.com/timotejroiko)

## Bots using discord.js-light

[Astrobot](https://top.gg/bot/astrobot)

[Message Viewer](https://top.gg/bot/642052166982303754)

(using discord.js-light? let me know :3)