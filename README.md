# discord.js-light

A minimalistic [discord.js](https://discord.js.org) framework that disables the original library's aggressive caching behavior and prevents excessive resource usage.

This library is a rewrite of the old "djs-shenanigans" found in the folders above, dropping most of its experimental features and focusing mostly on caching. it is powered by discord.js v12.0.0dev on a fixed commit basis so it wont be affected by updates until approved.

## Why?

Discord.js has been THE javascript discord library for a long time now, and successfully powers thousands of bots. But as your bot grows larger, you will start noticing a horrendous increase in resource usage, especially memory consumption.

This is due to the fact that discord.js caches EVERYTHING it can in order to avoid hitting the Discord API as much as possible. This behavior can however make the library feel bloated for most developers as many times the library is caching and processing data that your bot will never use.

This issue has been discussed a few times in the discord.js github but ultimately it has been decided that the library is too tightly coupled with its caching systems and seperating them would not be feasible. Thus the task of taming the monster falls back to us bot developers, and several solutions have been presented so far, such as regular cache sweeping.

I have felt however that the existing solutions were not good enough and decided to investigate it myself

## Getting Started

Installation:

```npm install timotejroiko/discord.js-light```

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
	// do stuff
});
```

Unlike its predecessor, discord.js-light does not include prefix managers or command handlers, it does however feature auto-login, auto sharding (via internal sharding) and default logging of connection events and errors. PM2 cluster support was also removed to be reworked as a separate feature in the future.

## Events

...