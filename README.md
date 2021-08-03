# discord.js-light v4

Discord.js v13 introduces several major changes including a new caching system, therefore discord.js-light was heavily reworked to adapt to these changes. This version is still experimental and most of its old code was removed to be reassessed and reworked as needed. Feel free to test it and let me know of any bugs and issues.

With the discord.js's new caching system, most of discord.js-light's modifications are no longer needed. However, discord.js still suffers from some side effects when disabling certain caches, such as events not being emitted even with partials enabled.

Therefore, while those issues persist, discord.js-light will focus on making sure all events are properly delivered, supporting all caching configurations and assisting with non-cached usage in general.

However, discord.js-light might not be so useful anymore in the future, so it will likely enter maintenance mode soon, with discord.js v13 likely being the final version supported by discord.js-light. Lets see how it goes.

## Features

* Fully supports the new discord.js caching system
* Discord.js partials system removed and replaced with an internal solution
* Events always work, regardless of caching options (partial structures are given when missing)
* Managers have a `.forge()` method to create partial versions of uncached objects on demand (to make api requests without fetching)

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
    const guild = message.guild.partial ? message.guild.id : message.guild.name;
    const channel = message.channel.partial ? message.channel.id : message.channel.name;
    await message.channel.send(`hello from guild ${guild} and channel ${channel}`);
});

client.login("your token here");
```

## Cache Configuration

Discord.js's new caching configuration is very powerful, but a but it can be a bit complex to use. Check the examples below.

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

## Notes and Important Info

Partials from events should now properly have their `partial` properties set to true.

Fetching data does not automatically cache if cache limits are set to 0. Instead, all caches have an additional method `.cache.forceSet()`, which is the same as `.cache.set()` but works even if the cache is disabled. Use this to manually cache fetched items. Manually cached items can be accessed, updated, swept and removed normally.

The bot member is cached by default (unless removed by the user). GuildMemberManager auto-sweep will still remove it if not excluded in your sweepFilter.

The everyone role and the bot roles are cached by default (unless removed by the user). Roles cache is not required to check permissions for the bot itself, only to check permissions for other members. RoleManager auto-sweep still affects them and will remove them if they are not excluded in your sweepFilter.

ChannelManager and GuildChannelManager should be configured together, otherwise weird things can happen if they have different configurations, use at your own risk.

The `client.channels.fetch()` does not work if the channel's guild is not cached, it needs an additional `{ allowUnknownGuild: true }` parameter to work in that case. `guild.channels.fetch()` still works normally, even with a forged guild.

## Non-standard stuff

### GuildChannel#fetchOverwrites

Method added to improve accessibility to permission checking when caches are disabled.

* returns: collection of PermissionOverwrite objects

### shardConnect

Event fired when each individual internal shard connects.

* shardId: number
* guilds: array of unavailable guilds

### guildEmojisUpdate

Event fired instead of the standard emoji events when the emoji cache is disabled.

* emojis: collection of updated emojis

### guildStickersUpdate

Event fired instead of the standard sticker events when the sticker cache is disabled.

* stickers: collection of updated stickers

### rest

Event fired when the library makes a request to the discord API.

* path: string
* method: string
* responseHeaders: object
* responseBody: string

## Examples

Permission checking with channels disabled:

```js
// ChannelManager: 0
// GuildChannelManager: 0
// GuildManager: Infinity (if guilds are not cached, use client.channels.fetch(id, { allowUnknownGuild:true }) instead)
// PermissionOverwritesManager: Infinity (if enabled, fetched channels will always include permissionOverwrites)
// RoleManager: Infinity (can be set to 0 if you only check permissions for the bot itself)

client.on("messageCreate", async message => {
    if(!client.channels.cache.has(message.channel.id)) {
        const channel = await client.channels.fetch(message.channel.id);
        if(message.channel.permissionOverwrites?.cache.maxSize === 0) } {
            // if PermissionOverwriteManager is disabled we can manually fetch permissions
            const overwrites = await channel.fetchOverwrites();
            overwrites.forEach(o => channel.permissionOverwrites.cache.forceSet(o.id, o)); // force insert overwrites into channel
        }
        client.channels.cache.forceSet(channel.id, channel); // optionally force cache to avoid re-fetching
        message.guild?.channels.cache.forceSet(channel.id, channel); // optionally also add to guild if it exists
        message.channel = channel; // optionally replace the partial channel with the full channel in this message
    }
    console.log(message.channel.permissionsFor(message.member));
});
```

## Bots using discord.js-light (as of July 2021, before the slash command exodus)
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
