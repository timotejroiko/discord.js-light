const Discord = require("./classes.js");
const Handlers = require("./actions.js");

Discord.Client = class Client extends Discord.Client {
	constructor(options = {}) {
		options = Object.assign(
			{
				cacheChannels:false,
				cacheGuilds:true,
				cachePresences:false,
				cacheRoles:false,
				cacheOverwrites:false,
				cacheEmojis:false,
				cacheMessages:false
			},
			options
		);
		super(options);
		Handlers(this);
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