# discord.js-light v4

Discord.js v13 introduces several major changes including a completely new caching system which enables users to fully customize the library to match their caching preferences, however not all caching configurations are officially supported and some may introduce several side effects.

This library aims to improve support and usability when using discord.js with limited or disabled caches.

## Branches

* **master** - latest updates, based on the discord.js master branch (not actively maintained)
* **v4** - current npm version, based on discord.js v13
* **v3** - old npm version, based on discord.js v12
* **v2** - deprecated
* **v1** - deprecated

## v4 Features

* Fully supports the new discord.js caching system, including unsupported configurations, with little to no side effects
* Discord.js partials system removed and replaced with an internal "always on" solution
* Events always work, regardless of caching options (partial structures are given when missing), see [djs-cache-test](https://github.com/Vicente015/djs-cache-test)
* Partials can be created on demand to interact with the Discord API without fetching first
* Additional utilities to improve usability with caches disabled

## Usage

```js
const Discord = require("discord.js-light");
const client = new Discord.Client({
    // default caching options, feel free to copy and modify. more info on caching options below.
    makeCache: Discord.Options.cacheWithLimits({
        ApplicationCommandManager: 0, // guild.commands
        BaseGuildEmojiManager: 0, // guild.emojis
        ChannelManager: 0, // client.channels
        GuildChannelManager: 0, // guild.channels
        GuildBanManager: 0, // guild.bans
        GuildInviteManager: 0, // guild.invites
        GuildManager: Infinity, // client.guilds
        GuildMemberManager: 0, // guild.members
        GuildStickerManager: 0, // guild.stickers
        MessageManager: 0, // channel.messages
        PermissionOverwriteManager: 0, // channel.permissionOverwrites
        PresenceManager: 0, // guild.presences
        ReactionManager: 0, // message.reactions
        ReactionUserManager: 0, // reaction.users
        RoleManager: 0, // guild.roles
        StageInstanceManager: 0, // guild.stageInstances
        ThreadManager: 0, // channel.threads
        ThreadMemberManager: 0, // threadchannel.members
        UserManager: 0, // client.users
        VoiceStateManager: 0 // guild.voiceStates
    }),
    intents: [ /* your intents here */ ],
});

client.on("messageCreate", async message => {
    if(!message.guild) return;
    // if .partial is true, only .id is guaranteed to exist, all other properties will be either null or undefined, if you need them, you must fetch them from the api
    const guildNameOrId = message.guild.partial ? message.guild.id : message.guild.name;
    const channelNameOrId = message.channel.partial ? message.channel.id : message.channel.name;
    await message.channel.send(`hello from guild ${guildNameOrId} and channel ${channelNameOrId}`);
});

client.login("your token here");
```

## Cache Configuration

Discord.js's new caching configuration is very powerful, here are a few examples:

```js
{
    ChannelManager: 0, // cache disabled. nothing will ever be added, except when using .cache.forceSet(). items added with forceSet can be updated and deleted normally.
    GuildChannelManager: { maxSize: 0 }, // same as above
    RoleManager: 5, // only 5 items will be allowed, any new item will first remove the oldest by insertion order before being added.
    UserManager: {
        maxSize: 10,
        /**
         * if set, this function is called when a new item is added and the collection is already at the limit.
         * the collection starts looking for the oldest item to remove and tests each item with this function.
         * if the function returns true, the item is not removed, and the next is tested. The first item that returns false is removed, then the new item is inserted.
         * If maxSize is 0 or if updating an existing item, this function is not called.
         * This example will prevent the bot user from ever being removed due to the cache being full and some other user will be removed instead.
        */
        keepOverLimit: (value, key, collection) => value.id === client.user.id
    },
    GuildMemberManager: {
        maxSize: Infinity,
        /**
         * if set, automatic sweeping is enabled, and this function is called every sweepInterval seconds.
         * this function provides the collection being swept, and expects another function as a return value.
         * the returned function will be given to collection.sweep() internally, and will delete all items for which the function returns true.
         * this example will remove all members except the bot member, every 600 seconds.
        */
        sweepFilter: collection => (value, key, collection) => value.id !== client.user.id,
        sweepInterval: 600 // autosweep interval in seconds
    }
}
```

## Non-standard stuff

### ...Manager#forge

All managers implement this method to create partial versions of uncached objects on demand. This enables making API requests without fetching uncached objects first. This is only used to send requests to the API, if you need to access the object's properties, you need to fetch it. Some forge methods require additional parameters, check your intelisense.

```js
await client.users.forge(id).send("hello");
```

### Collection#forceSet

All caches implement this method, which is the same as `.cache.set()` but works even if the caches are completely disabled (set to 0). Use this to manually cache fetched items.

```js
const user = await client.users.fetch(id);
client.users.cache.forceSet(id, user);
```

### GuildChannel#fetchOverwrites

Method added to improve accessibility to permission checking when caches are disabled. This can be used to work with permissions directly but to use regular permission checking methods, they need to be manually added to the cache.

```js
const overwrites = await channel.fetchOverwrites();
console.log(overwrites) // Collection<PermissionOverwrites>

// to enable permission checking in this channel if permissionOverwrites are not cached
overwrites.forEach(overwrite => {
    channel.permissionOverwrites.cache.forceSet(overwrite.id, overwrite);
})
```

### shardConnect

Event fired when each individual internal shard connects.

```js
client.on("shardConnect", (shardId, guilds) => {
    console.log(shardId) // shard ID
    console.log(guilds) // array of unavailable guilds as per the Discord API
});
```

### guildEmojisUpdate

Event fired instead of the standard emoji events when the emoji cache is disabled. If the emojis cache is disabled, emojiCreate, emojiUpdate and emojiDelete will never be fired.

```js
client.on("guildEmojisUpdate", emojis => {
    console.log(emojis) // Collection<GuildEmoji>
})
```

### guildStickersUpdate

Event fired instead of the standard sticker events when the sticker cache is disabled. If the stickers cache is disabled, stickerCreate, stickerUpdate and stickerDelete will never be fired.

```js
client.on("guildStickersUpdate", stickers => {
    console.log(stickers) // Collection<Sticker>
})
```

### rest

Event fired when the library makes a request to the discord API. Use this to debug rate limit issues.

```js
client.on("rest", request => {
    console.log(request); /*
    {
        path: string,
        method: string,
        responseHeaders: object,
        responseBody: string
    } */
});
```

## Notes and Important Info

Fetching data does not automatically cache if cache limits are set to 0. Use the non-standard `Collection#forceSet` method instead to manually cache fetched items. Manually cached items can be accessed, updated, swept and removed normally.

The bot member is cached by default (unless removed by the user). GuildMemberManager auto-sweep will still remove it if not excluded in your sweepFilter.

The everyone role is cached by default (unless removed by the user). RoleManager auto-sweep will still remove it if not excluded in your sweepFilter.

ChannelManager and GuildChannelManager should be configured together, otherwise weird things can happen if they have different configurations, use at your own risk. If anything prioritize enabling ChannelManager over GuildChannelManager.

The `client.channels.fetch()` method needs an additional `{ allowUnknownGuild: true }` parameter if the channel's guild is not cached. `guild.channels.fetch()` still works normally, even with a forged guild.

Note about continued development: v4 will likely be the last discord.js-light version. As of v13, discord.js is now much better than what it used to be in terms of configurability and resource management, and v14 will likely be even better, to the point where discord.js-light probably wont be useful anymore. For now v4 will still be maintained and will still keep up with discord.js's v13 development as needed, but this adventure might reach a conclusion soon. So long and thanks for all the fish!

## Examples

An example for maximizing cache efficiency while keeping full support for permission checking. Using the new autosweep functionality and the non-standard forceSet methods to keep only active text channels cached.

```js
const Discord = require("discord.js-light");

// remove non-text channels and remove text channels whose last message is older than 1 hour
function channelFilter(channel) {
    return !channel.messages || Discord.SnowflakeUtil.deconstruct(channel.lastMessageId).timestamp < Date.now() - 3600000;
}

const makeCache = Discord.Options.cacheWithLimits({
    GuildManager: Infinity, // roles require guilds
    RoleManager: Infinity, // cache all roles
    PermissionOverwrites: Infinity, // cache all PermissionOverwrites. It only costs memory if the channel it belongs to is cached
    ChannelManager: {
        maxSize: 0, // prevent automatic caching
        sweepFilter: () => channelFilter, // remove manually cached channels according to the filter
        sweepInterval: 3600
    },
    GuildChannelManager: {
        maxSize: 0, // prevent automatic caching
        sweepFilter: () => channelFilter, // remove manually cached channels according to the filter
        sweepInterval: 3600
    },
    /* other caches */
});

const client = new Discord.Client({ makeCache, intents: [ /* your intents */ ] });

client.on("messageCreate", async message => {
    // if the channel is not cached, manually cache it while its active
    if(!client.channels.cache.has(message.channel.id)) {
        const channel = await client.channels.fetch(message.channel.id);
        client.channels.cache.forceSet(channel.id, channel); // manually cache it in client.channels
        message.guild?.channels.cache.forceSet(channel.id, channel); // manually cache it in guild.channels
    }
    console.log(message.channel.permissionsFor(message.member));
});
```

An example for caching roles only for the bot itself and ignoring all other roles. Use in combination with the previous example if you want to check permissions in channels as well.

```js
const Discord = require("discord.js-light");

const makeCache = Discord.Options.cacheWithLimits({
    GuildManager: Infinity, // roles require guilds
    RoleManager: {
        maxSize: Infinity, // start with cache enabled to get initial roles, then disable it in the ready event
        sweepFilter: () => role => !role.guild.me.roles.has(role.id), // remove roles the bot doesnt have
        sweepInterval: 3600
    },
    /* other caches */
});

const client = new Discord.Client({ makeCache, intents: [ /* your intents */ ] });

client.on("ready", () => {
    client.guilds.forEach(guild => {
        // disable cache and remove roles we dont have
        guild.roles.cache.maxSize = 0;
        guild.roles.cache.sweep(role => !guild.me.roles.has(role.id))
    });
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
    if(newMember.id === client.user.id) {
        // check for new roles and fetch them as needed
        // removed roles will be uncached later by the autosweeper
        for(const role of newMember.roles.cache.values()) {
            if(role.partial) {
                const fetched = await newMember.guild.roles.fetch(role.id);
                newMember.guild.roles.cache.forceSet(role.id, fetched);
            }
        }
    }
});
```

## Bots using discord.js-light
<!-- markdownlint-disable MD045 -->
| Bot | Servers |
|-|-|
| [Birthday Bot](https://top.gg/bot/656621136808902656) | ![](https://top.gg/api/widget/servers/656621136808902656.svg) |
| [Dio](https://top.gg/bot/565050363313389588) | ![](https://top.gg/api/widget/servers/565050363313389588.svg) |
| [Truth or Dare](https://top.gg/bot/692045914436796436) | ![](https://top.gg/api/widget/servers/692045914436796436.svg) |
| [Nagito 2](https://top.gg/bot/741061042343510147) | ![](https://top.gg/api/widget/servers/741061042343510147.svg) |
| [Friend Time](https://top.gg/bot/471091072546766849) | ![](https://top.gg/api/widget/servers/471091072546766849.svg) |
| [Bump Reminder](https://top.gg/bot/735147814878969968) | ![](https://top.gg/api/widget/servers/735147814878969968.svg) |
| [D-Safe](https://discordsafe.com) | ![](https://top.gg/api/widget/servers/461171501715161108.svg) |
| [QOTD Bot](https://top.gg/bot/713586207119900693) | ![](https://top.gg/api/widget/servers/713586207119900693.svg) |
| [Suggestions](https://top.gg/bot/474051954998509571) | ![](https://top.gg/api/widget/servers/474051954998509571.svg) |
| [Filo](https://filobot.xyz) | ![](https://top.gg/api/widget/servers/568083171455795200.svg) |
| [Alita](https://top.gg/bot/590047618479030272) | ![](https://top.gg/api/widget/servers/590047618479030272.svg)
| [Kable](https://kable.bot) | ![](https://top.gg/api/widget/servers/699844962057060393.svg) |
| [Astrobot](https://top.gg/bot/astrobot) | ![](https://top.gg/api/widget/servers/344272098488877057.svg) |
| [Piña Bot](https://top.gg/bot/744386070552117278) | ![](https://top.gg/api/widget/servers/744386070552117278.svg) |
| [Monika](https://top.gg/bot/340476335279570945) | ![](https://top.gg/api/widget/servers/340476335279570945.svg) |
| [Hydra bot](https://hydrabot.xyz) | ![](https://top.gg/api/widget/servers/716708153143590952.svg) |
| [CalcBot](https://top.gg/bot/674457690646249472) | ![](https://top.gg/api/widget/servers/674457690646249472.svg) |
| [Helper](https://top.gg/bot/409538753997307915) | ![](https://top.gg/api/widget/servers/409538753997307915.svg) |
| [Utix](https://top.gg/bot/541969002734419989) | ![](https://top.gg/api/widget/servers/541969002734419989.svg) |
| [Custom Command](https://ccommandbot.ga) | ![](https://top.gg/api/widget/servers/725721249652670555.svg) |
| [Scathach](https://discord.bots.gg/bots/724047481561809007) | ![](https://top.gg/api/widget/servers/724047481561809007.svg) |
| [Melody](https://melodybot.tk) | ![](https://top.gg/api/widget/servers/739725994344316968.svg) |
| [Foxy 🦊](https://top.gg/bot/731144016686612510) | ![](https://top.gg/api/widget/servers/731144016686612510.svg) |
| [FlaviBot](https://flavibot.xyz) | ![](https://top.gg/api/widget/servers/684773505157431347.svg) |
| [Game Tracker](https://game-tracker.js.org) | ![](https://top.gg/api/widget/servers/475421235950518292.svg) |
| [Anti NSFW](https://top.gg/bot/706054368318980138) | ![](https://top.gg/api/widget/servers/706054368318980138.svg) |
| [Denky](https://denkybot.ga) | ![](https://top.gg/api/widget/servers/704517722100465746.svg) |
| [Gerald](https://top.gg/bot/806383966969790494) | ![](https://top.gg/api/widget/servers/806383966969790494.svg) |
| [Animal Bot](https://top.gg/bot/716061781172158464) | ![](https://top.gg/api/widget/servers/716061781172158464.svg) |
| [Slash](https://discord4.fun) | ![](https://top.gg/api/widget/servers/779351928832393277.svg) |
| [T_Moderator_Bot](https://top.gg/bot/412003088732389396) | ![](https://top.gg/api/widget/servers/412003088732389396.svg) |
| [CleverChat](https://top.gg/bot/781834206325243954) | ![](https://top.gg/api/widget/servers/781834206325243954.svg) |
| [Tamaki](https://top.gg/bot/716322665283059754) | ![](https://top.gg/api/widget/servers/716322665283059754.svg) |
| [Music Boat](https://top.gg/bot/735963752259911752) | ![](https://top.gg/api/widget/servers/735963752259911752.svg) |
| [Message Viewer](https://top.gg/bot/642052166982303754) | ![](https://top.gg/api/widget/servers/642052166982303754.svg) |
| [Art Prompts](https://eledris.com/art-prompts/discord-bot) | ![](https://top.gg/api/widget/servers/676880644076339228.svg) |
| [T_Music_Bot](https://top.gg/bot/421978090823090186) | ![](https://top.gg/api/widget/servers/421978090823090186.svg) |
| [Kirby!](https://top.gg/bot/770308348766584883) | ![](https://top.gg/api/widget/servers/770308348766584883.svg) |
| [Droid](https://top.gg/bot/830378619822014485) | ![](https://top.gg/api/widget/servers/830378619822014485.svg) |
| [EcchiBot](https://ecchibot.privateger.me) |  |
| [Stalk.live](https://stalk.live) |  |
| [Multipurpose+](https://music.udit.gq) |  |
| [Corynth](https://github.com/cxllm/corynth) |  |
| [Stereo](https://github.com/NathanPenwill/Stereo) |  |
| [Coconut Mall'd](https://github.com/Million900o/coconut-malld) |  |
| [Discord.js Bot Template](https://github.com/Giuliopime/discordjs-bot-template) |  |
