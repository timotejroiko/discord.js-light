const Discord = require("./discord.js");
const Events = require("./events.js");

Discord.Client = class Client extends Discord.Client {
	constructor(options = {}) {
		options = Object.assign(
			{
				messageCacheMaxSize: 10,
				messageCacheLifetime: 86400,
				messageSweepInterval: 86400,
				clientSweepInterval: 86400,
				userCacheLifetime: 86400,
				channelCacheLifetime: 86400,
				shardCheckInterval: 1800,
				queueLimit: 5
			},
			options
		);
		options.ws = Object.assign(
			{
				large_threshold:50,
				intents:1+4+8+16+512+1024+4096+8192
			},
			options.ws
		);
		if(options.ws.intents === null || options.ws.intents === false) { delete options.ws.intents; }
		if(!options.shards && !process.env.SHARDING_MANAGER) { options.shards = "auto"; }
		super(options);
		this.on("ready", () => {
			console.log(`[${new Date().toISOString()}] Client Ready`);
		});
		this.on("rateLimit", e => {
			console.log(`[${new Date().toISOString()}] Rate Limited`,e);
		});
		this.on("warn", e => {
			console.log(`[${new Date().toISOString()}] Warning`,e);
		});
		this.on("error", e => {
			console.log(`[${new Date().toISOString()}] Error`,e);
		});
		this.on("shardDisconnect", (e,id) => {
			console.log(`[${new Date().toISOString()}][Shard ${id}] Died and will not reconnect. Reason:`,e);
		});
		this.on("shardError", (e,id) => {
			console.log(`[${new Date().toISOString()}][Shard ${id}] Error`,e);
		});
		this.on("shardReconnecting", id => {
			console.log(`[${new Date().toISOString()}][Shard ${id}] Reconnecting`);
		});
		this.on("shardResume", (id,evts) => {
			console.log(`[${new Date().toISOString()}][Shard ${id}] Resumed`); // evts are useless
		});
		this.on("raw", Events.bind(this));
		if(parseInt(this.options.clientSweepInterval)) {
			let time = Math.max(this.options.clientSweepInterval, 60);
			this.setInterval(() => {
				this.sweepInactive();
			}, time * 1000);
		}
		if(parseInt(this.options.shardCheckInterval)) {
			let time = Math.max(this.options.shardCheckInterval, 60);
			this.setInterval(() => {
				this.checkShards();
			}, time * 1000);
		}
		if(this.options.token) {
			console.log(`[${new Date().toISOString()}] Connecting...`);
			this.login(this.options.token).catch(e => { throw e; });
		}
	}
	sweepInactive() {
		let users = parseInt(this.options.userCacheLifetime);
		let channels = parseInt(this.options.channelCacheLifetime);
		if(users) {
			this.users.cache.sweep(t => (!t.lastActive || t.lastActive < Date.now() - users * 1000) && !t.noSweep && t.id !== this.user.id);
		}
		if(channels && !this.options.enableChannels) {
			this.channels.cache.sweep(t => (!t.lastActive || t.lastActive < Date.now() - channels * 1000) && !t.noSweep);
		}
		this.guilds.cache.forEach(t => {
			t.members.cache.sweep(m => !this.users.cache.has(m.id));
			t.channels.cache.sweep(m => !this.channels.cache.has(m.id));
			t.presences.cache.sweep(m => !this.users.cache.has(m.id) && !this.options.trackPresences);
		});
	}
	checkShards() {
		let timer = Math.max(parseInt(this.options.shardCheckInterval) || 0, 60);
		this.ws.shards.forEach(shard => {
			if(shard.lastActive < Date.now() - timer * 1000) {
				console.log(`[${new Date().toISOString()}][Shard ${shard.id}] Possibly dead. Attempting to reconnect`);
				shard.destroy();
			}
		})
	}
	async getInfo() {
		const statuses = Object.keys(Discord.Constants.Status);
		if(!this.readyTimestamp) { return {status:statuses[this.ws.status]}; }
		let shards = new Array(this.options.shardCount).fill(0).map((t,i) => { return {
			shardID:i,
			status:statuses[this.ws.shards.get(i).status],
			ping:Math.round(this.ws.shards.get(i).ping),
			guilds:this.guilds.cache.filter(t => t.shardID === i).size,
			memberCount:this.guilds.cache.reduce((a,t) => t.memberCount && t.shardID === i ? a + t.memberCount : a,0),
			cachedChannels:this.channels.cache.filter(t => t.guild && t.guild.shardID === i).size,
			cachedMessages:this.channels.cache.filter(t => t.guild && t.guild.shardID === i && t.messages).reduce((a,t) => a + t.messages.cache.size, 0),
			cachedGuildMembers:this.guilds.cache.reduce((a,t) => t.shardID === i ? a + t.members.cache.filter(a => a.id !== this.user.id).size : a,0),
			cachedGuildChannels:this.guilds.cache.reduce((a,t) => t.shardID === i ? a + t.channels.cache.size : a,0),
			cachedPermissionOverwrites:this.guilds.cache.reduce((a,t) => t.shardID === i ? a + t.channels.cache.reduce((x,y) => x + y.permissionOverwrites.size,0) : a,0),
			cachedGuildRoles:this.guilds.cache.reduce((a,t) => t.shardID === i ? a + t.roles.cache.size : a,0),
			cachedGuildPresences:this.guilds.cache.reduce((a,t) => t.shardID === i ? a + t.presences.cache.size : a,0),
			cachedGuildVoiceStates:this.guilds.cache.reduce((a,t) => t.shardID === i ? a + t.voiceStates.cache.size : a,0),
			cachedGuildEmojis:this.guilds.cache.reduce((a,t) => t.shardID === i ? a + t.emojis.cache.size : a,0)
		}});
		shards[0].cachedDMUsers = this.users.cache.filter(t => t.id !== this.user.id && !this.guilds.cache.some(a => a.members.cache.has(t.id))).size;
		shards[0].cachedDMChannels = this.channels.cache.filter(t => t.type === "dm").size;
		shards[0].cachedDMMessages = this.channels.cache.filter(t => t.type === "dm").reduce((a,t) => a + t.messages.cache.size, 0);
		return {
			shards:shards.length,
			status:statuses[this.ws.status],
			upTime:this.uptime,
			ping:Math.round(this.ws.ping),
			memory:Number(Math.round((process.memoryUsage().rss/1048576)+'e2')+'e-2'),
			cpu:Number(Math.round((await new Promise(async r => {
				let start = [process.hrtime(),process.cpuUsage()];
				await new Promise(r => setTimeout(() => r(),100));
				let elap = [process.hrtime(start[0]),process.cpuUsage(start[1])];
				r(100.0 * ((elap[1].user / 1000) + (elap[1].system / 1000)) / (elap[0][0] * 1000 + elap[0][1] / 1000000));
			}))+'e2')+'e-2'),
			guilds:this.guilds.cache.size,
			memberCount:shards.reduce((a,t) => a + t.memberCount,0),
			cachedUsers:this.users.cache.filter(t => t.id !== this.user.id).size,
			cachedChannels:this.channels.cache.size,
			cachedMessages:this.channels.cache.filter(t => t.messages).reduce((a,t) => a + t.messages.cache.size, 0),
			cachedGuildMembers:shards.reduce((a,t) => a + t.cachedGuildMembers,0),
			cachedGuildChannels:shards.reduce((a,t) => a + t.cachedGuildChannels,0),
			cachedPermissionOverwrites:shards.reduce((a,t) => a + t.cachedPermissionOverwrites,0),
			cachedGuildRoles:shards.reduce((a,t) => a + t.cachedGuildRoles,0),
			cachedGuildPresences:shards.reduce((a,t) => a + t.cachedGuildPresences,0),
			cachedGuildVoiceStates:shards.reduce((a,t) => a + t.cachedGuildVoiceStates,0),
			cachedGuildEmojis:shards.reduce((a,t) => a + t.cachedGuildEmojis,0),
			shardDetails:shards
		}
	}
	incrementMaxListeners() {
		const maxListeners = this.getMaxListeners();
		if(maxListeners !== 0) {
			this.setMaxListeners(maxListeners + 1);
		}
	}
	decrementMaxListeners() {
		const maxListeners = this.getMaxListeners();
		if(maxListeners !== 0) {
			this.setMaxListeners(maxListeners - 1);
		}
	}
}

module.exports = Discord;