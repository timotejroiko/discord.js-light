let Discord = require(process.cwd()+"/node_modules/discord.js-light");
let client = new Discord.Client({
	shards:"auto",
	cacheGuilds:false,
	ws:{
		intents:Number(process.argv[3]) || undefined
	}
});

client.once("ready", () => {
	setInterval(() => {
		process.send(process.memoryUsage());
	},10000);
});

client.login(process.argv[2]).catch(console.log);
client.on("error",()=>{})