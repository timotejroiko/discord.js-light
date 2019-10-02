const {Client,Structures,Message,Util,Collection} = require('discord.js');
const pm2 = require("pm2");
const lockfile = require("lockfile");
const util = require('util');

Structures.extend("Message", Message => {
	return class extends Message {
		async send(content,options) {
			try {
				if(typeof content === "object" && typeof content.then === "function") { content = {Promise:await content}; }
				if(typeof content === "object") {
					if(content.Promise) {
						content = "```js\n<Promise> " + util.inspect(content.Promise,{getters: true, depth: 1 }).replace(/  /g,"\t\t").replace(/`/g,"\\`") + "```";
					} else {
						content = "```js\n" + util.inspect(content,{getters: true, depth: 1 }).replace(/  /g,"\t\t").replace(/`/g,"\\`") + "```";
					}
				}
				if(typeof content !== "string") { content = content+""; }
				if(content.length > 1950 && (!options || !options.split)) {
					content = content.substring(0, 1950) + `\n\n ... and ${content.slice(1950).split("\n").length} more lines` + content.startsWith("```") ? "```" : "";
				} else if(!content && (!options || (!options.content && !options.embed && !options.files))) {
					content = "⠀";
				}
				let response;
				if(this.editedTimestamp && this.commandResponse) {
					response = await this.commandResponse.edit(content,options);
				} else {
					response = await this.channel.send(content,options);
				}
				if(!this.commandResponse) { this.commandResponse = response; }
				response.commandMessage = this;
				response.commandResponseTime = (response.editedTimestamp || response.createdTimestamp) - (this.editedTimestamp || this.createdTimestamp);
				if(this.client.options.enableLogger) {
					if(this.guild) {
						console.log(`[${new Date().toISOString()}][Process ${this.client.options.process}][Shard ${this.guild.shardID}][${this.guild.name}][${this.channel.name}] Responded to ${this.author.tag} in ${response.commandResponseTime} ms`);
					} else {
						console.log(`[${new Date().toISOString()}][Process ${this.client.options.process}][Shard 0][DM] Responded to ${this.author.tag} in ${response.commandResponseTime} ms`);
					}
				}
				return response;
			} catch(e) {
				if(this.client.options.enableLogger) {
					logger(e,this.client);
				}
				if(this.client.options.sendErrors) {
					this.send(e);
				}
			}
		}
		get isOwner() {
			return this.client.options.owners.includes(this.author.id);
		}
		async asyncEval(f) {
			let client = this.client;
			try { let _TEST_ = eval(`(()=>{return ${f}})()`); return typeof _TEST_ === "object" && typeof _TEST_.then === "function" ? {Promise:await _TEST_} : _TEST_ } catch(e) {
				try { return await eval(`(async()=>{return ${f}})()`); } catch(e) {
					try { let _TEST_ = eval(`(()=>{${f}})()`); return typeof _TEST_ === "object" && typeof _TEST_.then === "function" ? {Promise:await _TEST_} : _TEST_ } catch(e) {
						try { return await eval(`(async() => {${f}})()`); } catch(e) {
							return e;
			}}}}
		}
	}
});

Structures.extend("TextChannel", TextChannel => {
	return class extends TextChannel {
		awaitMessages(filter, options = {}) {
			return new Promise((resolve, reject) => {
				const collector = this.createCollector(filter, options);
				collector.once('end', (collection, reason) => {
					if (options.errors && options.errors.includes(reason)) {
						reject(collection);
					} else {
						resolve(collection);
					}
				});
			});
		}
		createCollector(filter, options = {}) {
			let c = this.createMessageCollector(filter, options);
			if(isNaN(this.whitelisted)) { this.whitelisted = 0; }
			this.whitelisted++;
			c.once("end", () => { this.whitelisted--; });
			return c;
		}
	}
});

Structures.extend("GuildMember", GuildMember => {
	return class extends GuildMember {
		equals(member) {
			let equal = member && this.deleted === member.deleted && this.nickname === member.nickname && this._roles.length === member._roles.length;
			return equal;
		}
	}
});

module.exports = function(options) {
	if(!options.defaultPrefix) { options.defaultPrefix = ""; }
	if(!options.customPrefix) { options.customPrefix = () => ""; }
	const client = new Client({
		messageCacheMaxSize:-1,
		messageCacheLifetime:86400,
		messageSweepInterval:86400,
		disableEveryone:true,
		ws:{compress:true,large_threshold:50},
		disabledEvents:[
			"GUILD_MEMBER_ADD",
			"GUILD_MEMBER_REMOVE",
			"GUILD_MEMBER_UPDATE",
			"GUILD_MEMBERS_CHUNK",
			"GUILD_INTEGRATIONS_UPDATE",
			"GUILD_ROLE_CREATE",
			"GUILD_ROLE_DELETE",
			"GUILD_ROLE_UPDATE",
			"GUILD_BAN_ADD",
			"GUILD_BAN_REMOVE",
			"GUILD_EMOJIS_UPDATE",
			"CHANNEL_PINS_UPDATE",
			"CHANNEL_CREATE",
			"CHANNEL_DELETE",
			"CHANNEL_UPDATE",
			"MESSAGE_CREATE",
			"MESSAGE_DELETE",
			"MESSAGE_UPDATE",
			"MESSAGE_DELETE_BULK",
			"MESSAGE_REACTION_ADD",
			"MESSAGE_REACTION_REMOVE",
			"MESSAGE_REACTION_REMOVE_ALL",
			"USER_UPDATE",
			"USER_SETTINGS_UPDATE",
			"PRESENCE_UPDATE",
			"TYPING_START",
			"VOICE_STATE_UPDATE",
			"VOICE_SERVER_UPDATE",
			"WEBHOOKS_UPDATE"
		]
	});
	client.options.processes = options.processes;
	client.options.process = options.process;
	client.options.shardsPerProcess = options.shardsPerProcess;
	client.options.owners = options.owners;
	client.options.defaultPrefix = options.defaultPrefix;
	client.options.customPrefix = options.customPrefix;
	client.options.enableLogger = options.enableLogger;
	client.options.enableHandler = options.enableHandler;
	client.options.enableRoles = options.enableRoles;
	client.options.sendErrors = options.sendErrors;
	client.options.dblTest = options.dblTest;
	client.options.guildPrefixes = {};
	client.options.surveys = {};
	client.options.ws.guild_subscriptions = false;
	client.on("raw", async r => {
		if(r.t) {
			if((r.t === "MESSAGE_CREATE" || (r.t === "MESSAGE_UPDATE" && r.d.edited_timestamp)) && r.d.type === 0 && !r.d.webhook_id) {
				if(!client.options.enableRoles) { if(r.d.member) { r.d.member.roles = []; } }
				if(client.users.has(r.d.author.id)) {
					let user = client.users.get(r.d.author.id);
    				let olduser = user._update(r.d.author);
    				if(!user.equals(olduser)) {
    					client.emit("userUpdate",olduser,user);
    				}
				}
				if(r.d.guild_id && client.guilds.get(r.d.guild_id).members.has(r.d.author.id)) {
					r.d.member.user = r.d.author;
					let member = client.guilds.get(r.d.guild_id).members.get(r.d.author.id);
					let oldmember = member._update(r.d.member);
					if(!member.equals(oldmember)) {
						client.emit("memberUpdate",oldmember,member);
					}
				}
				if((client.channels.get(r.d.channel_id) || {}).whitelisted) {
					client.emit(r.t === "MESSAGE_CREATE" ? "message" : "messageUpdate",client.channels.get(r.d.channel_id).messages.add(r.d,false));
				}
				if(r.d.author.id === client.user.id) {
					let channel = client.channels.get(r.d.channel_id);
					if(!channel) {
						channel = await client.channels.fetch(r.d.channel_id);
						if(!client.options.enableRoles && channel.permissionOverwrites) { channel.permissionOverwrites.clear(); }
					}
					if(channel.messages.has(r.d.id)) { channel.messages.get(r.d.id).patch(r.d); } else { channel.messages.add(r.d); }
					return;
				}
				if(r.d.content && !r.d.author.bot) {
					let prefix = r.d.guild_id ? client.options.guildPrefixes[r.d.guild_id] || (client.options.guildPrefixes[r.d.guild_id] = await client.options.customPrefix(r.d.guild_id) || client.options.defaultPrefix) : client.options.defaultPrefix;
					if(r.d.content.startsWith(prefix)) {
						let cmd = (r.d.content.slice(prefix.length).split(" ")[0] || "").toLowerCase();
						if(!cmd) { cmd = "nocommand"; }
						handler(client,r,cmd);
					} else if(r.d.content.startsWith(`<!@${client.user.id}>`) || r.d.content.startsWith(`<@${client.user.id}>`)) {
						let cmd = (r.d.content.split(" ")[1] || "").toLowerCase();
						if(!cmd) { cmd = "nocommand"; }
						handler(client,r,cmd);
					}
				}
			} else if(r.t === "MESSAGE_DELETE" || r.t === "MESSAGE_DELETE_BULK") {
				if((client.channels.get(r.d.channel_id) || {}).whitelisted) {
					if(r.t === "MESSAGE_DELETE") {
						let channel = client.channels.get(r.d.channel_id);
						let deleted = channel.messages.get(r.d.id) || channel.messages.add({id:r.d.id},false);
						client.emit("messageDelete",deleted);
					} else {
						let channel = client.channels.get(r.d.channel_id);
						let deleted = new Collection();
						for(let i = 0; i < r.d.id.length; i++) {
							deleted.set(r.d.id[i],channel.messages.get(r.d.id[i]) || channel.messages.add({id:r.d.id[i]},false));
						}
						client.emit("messageDeleteBulk",deleted);
					}
					
				}
			} else if(r.t.indexOf("MESSAGE_REACTION") > -1) {
				let reaction = {};
				reaction.channel = client.channels.get(r.d.channel_id) || {id:r.d.channel_id};
				reaction.message = reaction.channel.messages && reaction.channel.messages.has(r.d.message_id) ? reaction.channel.messages.get(r.d.message_id) : {id:r.d.message_id};
				reaction.guild = r.d.guild_id ? client.guilds.get(r.d.guild_id) : null;
				reaction.user = client.users.get(r.d.user_id) || {id:r.d.user_id};
				reaction.emoji = r.d.emoji;
				client.emit(r.t.split("_").map((t,i) => i ? t[0]+t.slice(1).toLowerCase() : t.toLowerCase()).join(""),reaction,reaction.user);
			} else if(r.t === "GUILD_CREATE" || r.t === "GUILD_UPDATE") {
				r.d.voice_states = [];
				r.d.presences = [];
				if(!client.guilds.has(r.d.id)) {
					r.d.members = [];
					r.d.channels = [];
					r.d.emojis = [];
					if(!client.options.enableRoles) { r.d.roles = []; }
				} else {
					if(r.d.channels) { r.d.channels = r.d.channels.filter(t => client.guilds.get(r.d.id).channels.has(t.id)); }
					if(r.d.members) { r.d.members = r.d.members.filter(t => client.guilds.get(r.d.id).members.has(t.user.id)); }
					if(!(client.guilds.get(r.d.id).roles || {size:0}).size) { r.d.roles = []; }
					if(!(client.guilds.get(r.d.id).emojis || {size:0}).size) { r.d.emojis = []; }
				}
			} else if(r.t.indexOf("GUILD_ROLE") > -1) {
				if(client.options.enableRoles || (client.guilds.get(r.d.guild_id).roles || {size:0}).size) {
					let guild = client.guilds.get(r.d.guild_id);
					if(r.t === "GUILD_ROLE_CREATE") {
						let role = guild.roles.add(r.d.role);
						client.emit("roleCreate",role);
					} else if(r.t === "GUILD_ROLE_UPDATE") {
						let role = guild.roles.get(r.d.role.id);
						let oldrole = role._update(r.d.role);
						client.emit("roleUpdate",oldrole,role);
					} else if(r.t === "GUILD_ROLE_DELETE") {
						let role = guild.roles.get(r.d.role.id);
						guild.roles.remove(r.d.role.id);
						role.deleted = true;
						client.emit("roleDelete",role);
					}
				}
			} else if(client.channels.has(r.d.id) && (r.t === "CHANNEL_UPDATE" || r.t === "CHANNEL_DELETE")) {
				if(r.t === "CHANNEL_DELETE") {
					let channel = client.channels.get(r.d.id);
					client.channels.remove(channel.id);
					channel.deleted = true;
					client.emit("channelDelete",channel);
				} else {
					if(!client.options.enableRoles && !(client.channels.get(r.d.id).permissionOverwrites || {}).size) { r.d.permission_overwrites = []; }
					let oldchannel = client.channels.get(r.d.id)._update(r.d);
					let channel = client.channels.get(r.d.id);
					client.emit("channelUpdate",oldchannel,channel);
				}
			} else if(r.t === "READY") {
				if(client.options.enableLogger) {console.log(`[${new Date().toISOString()}][Process ${client.options.process}][Shard ${r.d.shard[0]}] Connected. Fetching ${r.d.guilds.length} guilds`)}
				if(process.env.exec_mode === "cluster_mode" && (r.d.shard[0]+1) % client.options.shardsPerProcess === 0) {
					setTimeout(() => {
						lockfile.unlockSync("login.lock");
					},5500);
				}
			}
		}
	});
	if(client.options.enableLogger) {
		client.on("ready", () => {
			console.log(`[${new Date().toISOString()}][Process ${client.options.process}] Client Ready`);
		});
		client.on("rateLimit", e => {
			console.log(`[${new Date().toISOString()}][Process ${client.options.process}] Rate Limited`,e);
		});
		client.on("warn", e => {
			console.log(`[${new Date().toISOString()}][Process ${client.options.process}] Warning: ${e}`);
		});
		client.on("error", e => {
			logger(e,client);
		});
		client.on("shardDisconnect", (e,id) => {
			console.log(`[${new Date().toISOString()}][Process ${client.options.process}][Shard ${id}] Died`,e);
		});
		client.on("shardError", (e,id) => {
			console.log(`[${new Date().toISOString()}][Process ${client.options.process}][Shard ${id}] Error`,e);
		});
		client.on("shardReconnecting", e => {
			console.log(`[${new Date().toISOString()}][Process ${client.options.process}][Shard ${e}] Reconnecting`);
		});
		client.on("shardResume", (e,evts) => {
			console.log(`[${new Date().toISOString()}][Process ${client.options.process}][Shard ${e}] Resumed`);
		});
	}
	if(client.options.enableHandler) {
		if(typeof client.options.enableHandler === "string") {
			const fs = require("fs");
			client.commands = new Map();
			client.options.enableHandler = process.cwd()+"/"+client.options.enableHandler;
			fs.readdirSync(client.options.enableHandler).forEach(t => {
				let cmd = t.split(".")[0].toLowerCase();
				client.commands.set(cmd,require(`${client.options.enableHandler}/${cmd}`));
			});
			client.commands.reload = cmd => {
				try {
					if(client.commands.get(cmd) || fs.existsSync(`${client.options.enableHandler}/${cmd}.js`)) {
						delete require.cache[require.resolve(`${client.options.enableHandler}/${cmd}`)];
						client.commands.set(cmd,require(`${client.options.enableHandler}/${cmd}`));
						return true;
					} else {
						return false;
					}
				} catch(e) {
					if(client.options.enableLogger) {
						logger(e,client);
					}
				}
			}
		}
	}
	client.shutdown = s => {
		console.log(`[${new Date().toISOString()}][Process ${client.options.process}] Signal recived, gracefully shutting down shortly`);
		client.options.shardsPerProcess = "shutdown";
		lockfile.unlockSync("login.lock");
		for(event in client._events) {
			if(event !== "raw") {
				client._events[event] = m => {
					if(m instanceof Message) {
						m.send("Temporarily unavailable. Try again shortly.");
					}
				}
			}
		}
		client.commands.forEach((v,k) => {
			client.commands.set(k,{run:m => {
				if(m instanceof Message) {
					m.send("Temporarily unavailable. Try again shortly.");
				}
			}});
		});
		setTimeout(() => { process.exit(s); },4000);
		return true;
	}
	if(process.env.exec_mode === "cluster_mode") {
		client.pm2shutdown = () => {
			for(let i = 0; i < client.options.neighbors.length; i++) {
				require("child_process").exec(`pm2 sendSignal SIGINT ${client.options.neighbors[i]}`);
			}
			return true;
		}
		client.survey = async script => {
			if(!client.options.neighbors) { client.options.neighbors = await pm2Info(true); }
			let requestID = Date.now().toString(36) + Math.random().toString(36).slice(2);
			let survey = client.options.surveys[requestID] = {result:[],resolvers:[]};
			for(let i = 0; i < client.options.neighbors.length; i++) {
				survey.result[i] = new Promise(r => {
					survey.resolvers[i] = r;
					setImmediate(() => {
						pm2.sendDataToProcessId(client.options.neighbors[i],{data:true,d:script,topic:"request",survey:requestID,from:process.env.pm_id,process:client.options.process},(err) => {
							if(err) {
								r(null);
							} else {
								setTimeout(() => { r(null); },4000);
							}
						});
					});
				});
			}
			let r = await Promise.all(survey.result);
			setTimeout(() => { delete client.options.surveys[requestID]; },5000);
			return r;
		}
		client.broadcast = async script => {
			if(!client.options.neighbors) { client.options.neighbors = await pm2Info(true); }
			let messages = [];
			for(let i = 0; i < client.options.neighbors.length; i++) {
				messages[i] = new Promise(r => {
					pm2.sendDataToProcessId(client.options.neighbors[i],{data:true,d:script,topic:"broadcast",from:process.env.pm_id,process:client.options.process},(err) => {
						if(err) { r(false) } else { r(true) }
					});
				});
			}
			return await Promise.all(messages);
		}
		process.on("message", async packet => {
			if(packet.topic === "request") {
				let reply;
				try { reply = eval(packet.d); } catch(e) { reply = e.toString(); }
				await pm2Info();
				pm2.sendDataToProcessId(packet.from,{data:true,d:reply,topic:"response",survey:packet.survey,from:process.env.pm_id,process:client.options.process},() => {});
			} else if(packet.topic === "response") {
				client.options.surveys[packet.survey].resolvers[packet.process](packet.d);
			} else if(packet.topic === "broadcast") {
				try { eval(packet.d); } catch(e) { logger(e,client); }
			}
		});
	}
	client.getInfo = async (bypass) => {
		const statuses = ["READY","CONNECTING","RECONNECTING","IDLE","NEARLY","DISCONNECTED"];
		if(process.env.exec_mode === "cluster_mode" && !bypass) {
			let data = await client.survey("client.getInfo(true)");
			let total = {
				activeProcesses:data.length,
				totalProcesses:client.options.processes,
				totalMemory:Number(Math.round(data.reduce((a,t) => t.memory ? a += t.memory : a,0)+'e2')+'e-2'),
				totalCpu:Number(Math.round(data.reduce((a,t) => t.cpu ? a += t.cpu : a,0)+'e2')+'e-2'),
				totalShards:data.reduce((a,t) => t.shards ? a += t.shards : a,0),
				totalGuilds:data.reduce((a,t) => t.guild ? a += t.guilds : a,0),
				totalUsersAtLogin:data.reduce((a,t) => t.usersAtLogin ? a += t.usersAtLogin : a,0),
				totalActiveUsers:data.reduce((a,t) => t.activeUsers ? a += t.activeUsers : a,0),
				totalActiveChannels:data.reduce((a,t) => t.activeChannels ? a += t.activeChannels : a,0),
				processDetails:data
			}
			return total;
		} else {
			if(client.readyTimestamp) {
				let shards = new Array(client.options.shardsPerProcess).fill(0).map((t,i) => { return {
					shardID:client.options.process*client.options.shardsPerProcess+i,
					status:statuses[client.ws.shards.get(i).status],
					ping:Math.round(client.ws.shards.get(i).ping),
					guilds:client.guilds.filter(t => t.shardID === i).size,
					usersAtLogin:client.guilds.reduce((a,t) => t.shardID === i ? a += t.memberCount : a,0),
					activeUsers:client.guilds.reduce((a,t) => t.shardID === i ? a += t.members.filter(a => a.id !== client.user.id).size : a,0),
					activeGuildChannels:client.guilds.reduce((a,t) => t.shardID === i ? a += t.channels.size : a,0)
				}});
				if(client.options.process === 0) {
					shards[0].activeUsers += client.users.filter(t => t.id !== client.user.id).filter(t => !client.guilds.some(a => a.members.has(t.id))).size;
					shards[0].activeDMChannels = client.channels.filter(t => t.type === "dm").size;
				}
				let proc = {
					processID:client.options.process,
					shards:shards.length,
					status:statuses[client.ws.status],
					upTime:client.uptime,
					ping:Math.round(client.ws.ping),
					memory:Number(Math.round((process.memoryUsage().rss/1048576)+'e2')+'e-2'),
					cpu:Number(Math.round((await new Promise(async r => {
						let start = [process.hrtime(),process.cpuUsage()];
						await new Promise(r => setTimeout(() => r(),100));
						let elap = [process.hrtime(start[0]),process.cpuUsage(start[1])];
						r(100.0 * ((elap[1].user / 1000) + (elap[1].system / 1000)) / (elap[0][0] * 1000 + elap[0][1] / 1000000));
					}))+'e2')+'e-2'),
					guilds:client.guilds.size,
					usersAtLogin:shards.reduce((a,t) => a += t.usersAtLogin,0),
					activeUsers:client.users.filter(t => t.id !== client.user.id).size,
					activeChannels:client.channels.size,
					shardDetails:shards
				}
				return proc;
			} else {
				return {status:statuses[client.ws.status]}
			}
		}
	}
	process.on('SIGHUP', () => client.shutdown(128 + 1));
	process.on('SIGINT', () => client.shutdown(128 + 2));
	process.on('SIGTERM', () => client.shutdown(128 + 15));
	if(typeof options.token === "string") {
		login(client,options.token,options.dblToken).catch(console.log);
	}
	return client;
}

async function handler(client,r,cmd) {
	if(client.options.enableHandler) {
		if(typeof client.options.enableHandler === "string") {
			if(client.commands.has(cmd)) {
				let channel = client.channels.get(r.d.channel_id);
				if(!channel) {
					channel = await client.channels.fetch(r.d.channel_id);
					if(!client.options.enableRoles && channel.permissionOverwrites) { channel.permissionOverwrites.clear(); }
				}
				let message;
				if(channel.messages.has(r.d.id)) {
					message = channel.messages.get(r.d.id);
					message.patch(r.d);
				} else {
					message = channel.messages.add(r.d);
				}
				message.command = cmd;
				message.argument = message.content.split(" ").slice(1).join(" ");
				if(client.options.enableLogger) {
					if(message.guild) {
						console.log(`[${new Date().toISOString()}][Process ${client.options.process}][Shard ${message.guild.shardID}][${message.guild.name}][${channel.name}] ${message.author.tag} -> ${message.command}`);
					} else {
						console.log(`[${new Date().toISOString()}][Process ${client.options.process}][Shard 0][DM] ${message.author.tag} -> ${message.cmd}`);
					}
				}
				try {
					await Promise.resolve(client.commands.get(cmd).run(message));
				} catch(e) {
					logger(e,client);
					if(client.options.sendErrors) {
						message.send(e).catch(e => {
							if(client.options.enableLogger) {
								logger(e,client);
							}
						});
					}
				}
			}
		} else {
			if(typeof client._events[`/${cmd}`] === "function") {
				let channel = client.channels.get(r.d.channel_id);
				if(!channel) {
					channel = await client.channels.fetch(r.d.channel_id);
					if(!client.options.enableRoles && channel.permissionOverwrites) { channel.permissionOverwrites.clear(); }
				}
				let message;
				if(channel.messages.has(r.d.id)) {
					message = channel.messages.get(r.d.id);
					message.patch(r.d);
				} else {
					message = channel.messages.add(r.d);
				}
				message.command = cmd;
				message.argument = message.content.split(" ").slice(1).join(" ");
				if(client.options.enableLogger) {
					if(message.guild) {
						console.log(`[${new Date().toISOString()}][Process ${client.options.process}][Shard ${message.guild.shardID}][${message.guild.name}][${channel.name}] ${message.author.tag} -> ${message.command}`);
					} else {
						console.log(`[${new Date().toISOString()}][Process ${client.options.process}][Shard 0][DM] ${message.author.tag} -> ${message.cmd}`);
					}
				}
				client.emit(`/${cmd}`,message);
			}
		}
	} else {
		let channel = client.channels.get(r.d.channel_id);
		if(!channel) {
			channel = await client.channels.fetch(r.d.channel_id);
			if(!client.options.enableRoles && channel.permissionOverwrites) { channel.permissionOverwrites.clear(); }
		}
		if(channel.whitelisted) { return; }
		let message = channel.messages.add(r.d,false);
		client.emit("message",message);
	}
}

async function login(client,token,dblToken) {
	if(process.env.exec_mode === "cluster_mode") {
		if(!client.options.neighbors) {	client.options.neighbors = await pm2Info(true);	}
		client.options.processes = client.options.neighbors.length;
		client.options.process = client.options.neighbors.findIndex(t => t == process.env.pm_id);
		if(client.options.enableLogger) {console.log(`[${new Date().toISOString()}][Process ${client.options.process}] Waiting for lock file`)}
		lockfile.lock("login.lock", {wait:120000*client.options.processes}, async err => {
			try {
				if(err) {
					console.log(`[${new Date().toISOString()}][Process ${client.options.process}] Unable to secure lock. Retrying...`,err);
					lockfile.unlockSync("login.lock");
					process.exit(0);
				}
				if(client.options.shardsPerProcess === "shutdown") {
					lockfile.unlockSync("login.lock");
					return;
				}
				if(client.options.shardsPerProcess === "auto") {
					let survey = (await client.survey(`if(client.options.processes && client.options.recommendedShards) { if(client.options.processes === ${client.options.processes}) { client.options.recommendedShards } else { client.shutdown(0); 0 } } else { 0 }`)).find(Boolean);
					if(survey) {
						client.options.shardsPerProcess = client.options.recommendedShards = survey;
					} else {
						client.options.shardsPerProcess = client.options.recommendedShards = Math.ceil(await Util.fetchRecommendedShards(token)/client.options.processes);
					}
				} else {
					client.options.shardsPerProcess = options.shardsPerProcess || 1;
				}
				client.options.shards = new Array(client.options.shardsPerProcess).fill().map((_,i) => client.options.process*client.options.shardsPerProcess+i);
				client.options.totalShardCount = client.options.processes*client.options.shardsPerProcess;
				if(client.options.enableLogger) {console.log(`[${new Date().toISOString()}][Process ${client.options.process}] Connecting ${client.options.shardsPerProcess} shard(s)`)}
				await client.login(token);
				if(dblToken) {
					if(client.options.dblTest) {
						dbl(client.user.id,dblToken,client.guilds.size,client.options.process,client.options.processes).then(status => {
							console.log(`[${new Date().toISOString()}][Process ${client.options.process}][DBL] ${status === 200 ? "Posted server count" : "Failed to post server count"}`);
							if(status.error) { console.log(status.error); }
						});
					}
					setInterval(() => {
						dbl(client.user.id,dblToken,client.guilds.size,client.options.process,client.options.processes).then(status => {
							console.log(`[${new Date().toISOString()}][Process ${client.options.process}][DBL] ${status === 200 ? "Posted server count" : "Failed to post server count"}`);
							if(status.error) { console.log(status.error); }
						});
					},86400000);
				}
			} catch(e) {
				lockfile.unlockSync("login.lock");
				if(client.options.enableLogger) {console.log(`[${new Date().toISOString()}][Process ${client.options.process}] Login failed`,e)}
			}
		});
	} else {
		try {
			if(!client.options.processes) { client.options.processes = 1; client.options.process = 0; }
			if(!client.options.process) { client.options.process = 0; }
			if(!client.options.shardsPerProcess) { client.shardsPerProcess = "auto"; }
			if(client.options.shardsPerProcess === "auto") {
				client.options.shardsPerProcess = Math.ceil(await Util.fetchRecommendedShards(token)/client.options.processes);
			}
			client.options.shards = new Array(client.options.shardsPerProcess).fill().map((_,i) => client.options.process*client.options.shardsPerProcess+i);
			client.options.totalShardCount = client.options.processes*client.options.shardsPerProcess;
			console.log(`[${new Date().toISOString()}][Process ${client.options.process}] Connecting ${client.options.shardsPerProcess} shard(s)`);
			await client.login(token);
			if(dblToken) {
				if(client.options.dblTest) {
					dbl(client.user.id,dblToken,client.guilds.size,client.options.process,client.options.processes).then(status => {
						console.log(`[${new Date().toISOString()}][Process ${client.options.process}][DBL] ${status === 200 ? "Posted server count" : "Failed to post server count"}`);
						if(status.error) { console.log(status.error); }
					});
				}
				setInterval(() => {
					dbl(client.user.id,dblToken,client.guilds.size,client.options.process,client.options.processes).then(status => {
						console.log(`[${new Date().toISOString()}][Process ${client.options.process}][DBL] ${status === 200 ? "Posted server count" : "Failed to post server count"}`);
						if(status.error) { console.log(status.error); }
					});
				},86400000);
			}
		} catch(e) {
			console.log(`[${new Date().toISOString()}][Process ${client.options.process}] Login failed`,e);
		}
	}
}

function dbl(id,token,guilds,current,total) {
	return new Promise(r => {
		let https = require("https");
		let req = https.request({
			hostname: 'discordbots.org',
			port: 443,
			path: `/api/bots/${id}/stats`,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': token
			}
		}, res => r(res.statusCode));
		req.on('error', e => r({error:e}));
		req.write(JSON.stringify({
			server_count:guilds,
			shard_id:current,
			shard_count:total
		}));
		req.end();
	});
}

async function logger(e,client) {
	let name = e.name || "?";
	let msg = e.message || "??";
	let channel = e.path ? client.channels.get((e.path).split("/")[2]) || await client.channels.fetch((e.path).split("/")[2],false) : null;
	let guild = channel && channel.guild ? channel.guild : null;
	console.log(`[${new Date().toISOString()}][Process ${client.options.process}]${guild ? `[Shard ${guild.shardID}][${guild.name}][${channel.name}]` : channel ? `[Shard 0][DM]` : ""} Error:`,name,msg,e);
}

async function pm2Info(ret) {
	if(!pm2.Client.client_sock) { await new Promise(r => { pm2.connect(() => r()); }); }
	if(ret) {
		return new Promise(r => {
			pm2.list((err, processes) => {
				r(processes.filter(t => t.pm2_env.pm_exec_path === process.env.pm_exec_path).map(t => t.pm2_env.pm_id));
			});
		});
	}
	return;
}