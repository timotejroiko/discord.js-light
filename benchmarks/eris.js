let Eris = require(process.cwd()+"/node_modules/eris");
let client = new Eris(process.argv[2],{
	maxShards:"auto",
	messageLimit:0,
	intents:Number(process.argv[3]) || undefined
});

client.once("ready", () => {
	setInterval(() => {
		process.send(process.memoryUsage());
	},10000);
});

client.connect().catch(console.log);
client.on("error",()=>{})