# djs-shenanigans

A modified Discord client built on top of [discord.js](https://github.com/discordjs/discord.js) 12.0.0, Shenanigans aims to drastically reduce discord.js's resource usage while also adding its own set of utilities. This package is very experimental and should be used with caution and lots of testing, as it may disable or break some of discord.js's features.

## Features

djs-shenanigans tweaks discord.js by removing some of its features for performance gains and adding some other features on top.

Pros:

* Drastically lower cpu usage (see performance section)
* Drastically lower memory usage (see performance section)
* Built-in automatic sharding
* Built-in command handlers
* Built-in error handlers
* Built-in custom prefix handler
* Built-in discordbots.org server count updater
* Designed to run as replicable independent instances (compatible with pm2 cluster)
* Some additional functions and methods for convenience (see non-standard API section)

Cons:

* Disabled everything except messages and reactions (some stuff might be re-enableable)
* Disabled caching and auto-updating of channels, users, members, roles, emojis and voice states (must be fetched and cached by end-user when needed)
* Presences and typing events are permanently disabled
* Some features that rely on cached data might require fixes or workarounds
* Voice features were not tested

## Getting Started

Installation:

```npm install timotejroiko/djs-shenanigans```

optional packages (recommended to improve performance, especially zlib-sync)

```
npm install zlib-sync
npm install bufferutil
npm install discordapp/erlpack (if it doesnt work, use this fork: churchofthought/erlpack)
npm install utf-8-validate
```

Simple usage:

```js
const client = require("djs-shenanigans")(options); // good old discord.js client

client.on("message", message => {
	// do stuff
});

client.login("TOKEN")
```

With auto-login, auto-sharding, logging, prefix and command handlers:

```js
const client = require("djs-shenanigans")({
	token:"TOKEN",
	defaultPrefix:"!",
	enableLogger: true,
	enableHandler: "YOURCOMMANDSFOLDER",
	sendErrors:true
});

// create commands in your command folder (see command handlers section)
```

## Client options

All fields are optional.

| Option | Type | Description |
| ------------- | ------------- | ------------- |
| token | string | Your discord bot token. If provided, the client will attempt negotiate shards and login automatically, else you will need to run client.login() and manually specify shard settings |
| dblToken | string | Your discordbots.org token. If provided, the client will send your guild count to discordbots.org every 24 hours |
| dblTest | boolean | If set to true, the client will also send your guild count to discordbots.org immediatelly after logging in |
| owners | array | Array of user IDs. Used by the non-standard method message.isOwner() |
| processes | number | Total number of processes running this bot if running multiple instances manually. Ignored when using pm2 cluster mode |
| process | number | The zero-indexed id of the current process if running multiple instances manually. Ignored when using pm2 cluster mode |
| shardsPerProcess | number | Manually specify the number of shards each process should spawn. Uses recommended shards if omitted or set to "auto" |
| defaultPrefix | string | Default prefix for all guilds and dms |
| customPrefix | function(guild id) | Function that should return a guild-specific prefix from a guild id |
| enableLogger | boolean | Enables logging of connection statuses, messages and errors |
| enableHandler | boolean/string | Command handler mode. See command handlers section |
| sendErrors | boolean | If set to true, the command handler will send command errors instead of only logging them |

## Command handlers

djs-shenanigans has 3 different ways of working depending on the command handler mode:

### Message Event Mode

options.enableHandler set to false or omitted.

In this mode, client will listen to messages that start with a valid prefix and emit them as a "message" event. Example:

```js
const client = require("djs-shenanigans")({
	defaultPrefix:"!"
});

client.on("message", message => {
	// only messages from non-bot users which start with a valid prefix are received, in this case messages starting with !
	// the message itself is not cached, but its channel and user/member are automatically cached.
});
```

### Route Mode

options.enableHandler set to true.

In this mode, client will listen to messages that start with a valid prefix and contain a command registered as an event. Registered command events are prefixed with a slash to avoid interfering with standard events. Example:

```js
const client = require("djs-shenanigans")({
	defaultPrefix:"!",
	enableHandler:true
});

client.on("/ping", message => {
	// only messages from non-bot users which start with a valid prefix followed by the command "ping" are received
	// the message, its channel and user/member are automatically cached.
});
```

### File Mode

options.enableHandler set to a string pointing to a folder.

In this mode, client will listen to messages that start with a valid prefix and contain a valid command file. The client will scan the supplied folder and register all files found as commands using their file names. This mode also enables a built-in command reloading function (see non-standard API). Example:

```js
// index.js
const client = require("djs-shenanigans")({
	defaultPrefix:"!",
	enableHandler:"commands"
});

// scans the "commands" folder for js files and registers them in client.commands
// client.commands is a Map object with the file name serving as the key, and its exported functions as the value.
```

```js
// commands/ping.js
module.exports.run = message => {
	// only messages from non-bot users which start with a valid prefix followed by the command "ping" are received
	// the message, its channel and user/member are automatically cached.
	// commands must contain a "run" function to whom the client passes the message
}
```

## Non-standard API

djs-shenanigans has come extra functions built in for convenience:

| Function | Returns | Description |
| ------------- | ------------- | ------------- |
| message.send(content,options) | promise->message | This function is the same as message.channel.send() but adds several improvements: automatically resolves promises and converts objects to text, truncates large strings if no split options are provided, detects and warns about errors and failures when sending, logs response time and errors if logging is enabled, adds request and response pairing if messages are cached. |
| message.commandResponse | message | The message object that was send as a response to this command. Only available if it was sent with message.send() and the message is cached |
| message.commandMessage | message | The message object that was received to trigger this response. Only available if this response was sent with message.send() and the triggering message is cached. |
| message.commandResponseTime | number | Message response time in milliseconds. Only available in response messages if they were sent with message.send() and are cached; |
| message.isOwner() | boolean | Quickly check if the user who sent the message is a bot owner. Uses the array of owners from options.owners |
| channel.createCollector() | messageCollector | The same as channel.createMessageCollector() but adds a channel bypass to receive all messages instead of only messages starting with a valid prefix |
| channel.whitelisted | boolean | If set to true, this channel will fire "message" events for all messages, instead of only messages starting with a valid prefix. |
| client.shutdown() | boolean | Begins graceful shutdown in this process, replaces all functions and commands with a temporary message and exits the process after a few seconds |
| client.asyncEval() | promise->anything | An eval function that accepts awaiting promises |
| client.pm2shutdown() | boolean | Sends a shutdown signal to all processes in the pm2 cluster. Only available when running in pm2 cluster mode |
| client.survey() | promise->array | Similar to broadcastEval() but for pm2 clusters. Sends a string to be evaluated by all processes in the cluster and returns an array of responses indexed by process number. Only available when running in pm2 cluster mode |
| client.broadcast() | promise->array | Same as client.survey() but it does not wait for a response. It returns an array of booleans representing whether the message was received by the target processes or not. Only available when running in pm2 cluster mode |

## PM2 Cluter Mode

djs-shenanigans is compatible with pm2 clusters, all you need to do is run it like this:

```
pm2 start yourFileName.js -i numberOfProcesses --name=yourProcessName
```

To scale your bot, all processes need to be restarted. This can also be done easily with pm2 clusters:

```
pm2 scale yourProcessName numberOfProcesses && pm2 restart yourProcessName
```

When running in pm2 cluster mode, you have access to cluster specific functions such as client.broadcast() client.survey() and client.pm2shutdown().
Cluster mode automatically negotiates shards and spreads them equally across processes, or you can set a specific amount of shards using options.shardsPerProcess.
Client logins are queued using a lockfile to avoid too many login attempts.

## Performance

This test case was done on a linux ubuntu 18 vps (1vcpu, 1gb ram) running around 1500 guilds. The following scripts were used:

```js
// discord.js default settings
const { Client } = require("discord.js");
const client = new Client();
client.login("TOKEN");
```

```js
// discord.js with most things disabled
const { Client } = require("discord.js");
const client = new Client({
    messageCacheMaxSize:0,
    messageCacheLifetime:30,
    messageSweepInterval:60,
    disableEveryone:true,
    disabledEvents:["GUILD_MEMBER_ADD","GUILD_MEMBER_REMOVE","GUILD_MEMBER_UPDATE","GUILD_MEMBERS_CHUNK","GUILD_INTEGRATIONS_UPDATE","GUILD_ROLE_CREATE","GUILD_ROLE_DELETE","GUILD_ROLE_UPDATE","GUILD_BAN_ADD","GUILD_BAN_REMOVE","GUILD_EMOJIS_UPDATE","CHANNEL_PINS_UPDATE","CHANNEL_CREATE","CHANNEL_DELETE","CHANNEL_UPDATE","MESSAGE_CREATE","MESSAGE_DELETE","MESSAGE_UPDATE","MESSAGE_DELETE_BULK","MESSAGE_REACTION_ADD","MESSAGE_REACTION_REMOVE","MESSAGE_REACTION_REMOVE_ALL","USER_UPDATE","USER_SETTINGS_UPDATE","PRESENCE_UPDATE","TYPING_START","VOICE_STATE_UPDATE","VOICE_SERVER_UPDATE","WEBHOOKS_UPDATE"]
});
client.login("TOKEN");
```

```js
// djs-shenanigans
const client = require("djs-shenanigans")({
	token:"TOKEN",
	defaultPrefix:"!",
	enableLogger: true,
	enableHandler: "commands",
	sendErrors:true
});
```

Results:

![CPU Usage](bench/cpu.jpg)
![Memory Usage](bench/mem.jpg)