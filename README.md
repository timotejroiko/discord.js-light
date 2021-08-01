# discord.js-light v4

Discord.js v13 introduces several major changes including a new caching system, therefore discord.js-light v4 was heavily reworked to adapt to these changes.

This version is very experimental, most of its old features were removed and instead it focuses on making sure all events are properly delivered and all non-cached data is available as proper partials.

Feel free to test it and let me know of any bugs and issues.

## Discord Changes

Starting from April 2022, message content will become a priviledged intent. With this move, Discord is pushing for a major switch to stateless infrastructure and slash commands.

These changes combined with the recent caching improvements in discord.js make this library much less useful than it was before. Therefore discord.js-light will enter maintenance mode soon, with discord.js v13 being the final version supported.

Bugs will still be fixed whenever they are found and maintenance will still be done until the library becomes stable enough.

## Features

* Discord.js partials system removed and replaced with an internal solution
* Events always work, regardless of caching options (partial structures are given when missing)
* Managers have a `.forge()` method to create partial versions of uncached objects on demand (to make api requests without fetching)

## Usage

```js
const Discord = require("discord.js-light");
const client = new Discord.Client({
    intents: [ /* your intents here */ ],
    // default caching options. enable caches by commenting them out.
    makeCache: Discord.Options.cacheWithLimits({
        ApplicationCommandManager: 0,
        BaseGuildEmojiManager: 0,
        ChannelManager: 0,
        GuildBanManager: 0,
        GuildChannelManager: 0,
        GuildInviteManager: 0,
        // GuildManager: 0,
        GuildMemberManager: 0,
        GuildStickerManager: 0,
        MessageManager: 0,
        PermissionOverwriteManager: 0,
        PresenceManager: 0,
        ReactionManager: 0,
        ReactionUserManager: 0,
        RoleManager: 0,
        StageInstanceManager: 0,
        ThreadManager: 0,
        ThreadMemberManager: 0,
        UserManager: 0,
        VoiceStateManager: 0
    })
});

client.on("messageCreate", async message => {
    if(!message.guild) return;
    const guild = message.guild.partial ? message.guild.id : message.guild.name;
    const channel = message.channel.partial ? message.channel.id : message.channel.name;
    await message.channel.send(`hello from guild ${guild} and channel ${channel}`);
});

client.login("your token here");
```

## Notes

Partials from events should now properly have their `partial` properties set to true.

A few additional non-standard events are included: `shardConnect` (when an internal shard connects), `rest` (when the library makes an api request), `guildEmojisUpdate` (when the emoji cache is disabled) and `guildStickersUpdate` (when the stickers cache is disabled).

A non-standard GuildChannel#fetchOverwrites() was added to improve accessibility to permission checking.

Fetching data does not automatically cache anymore when cache limits are set to 0. Instead, all caches have an additional method `.cache.forceSet()`, which is the same as .cache.set() but works even if the cache is disabled. Use this to manually cache fetched items.

## Examples

```js
// manually fetching and caching a channel with permissionOverwrites, when all caches are set to 0
async function fetchAndCacheChannelWithPermissions(id) {
    if(client.channels.cache.has(id)) { return client.channels.cache.get(id); }
    const channel = await client.channels.fetch(id);
    client.channels.cache.forceSet(channel.id, channel);
    if(channel.guild) {
        const overwrites = await channel.fetchOverwrites();
        overwrites.forEach(o => channel.permissionOverwrites.cache.forceSet(o.id, o));
        channel.guild.channels.cache.forceSet(channel.id, channel);
    }
    return channel;
}
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
