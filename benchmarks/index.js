const { fork } = require("child_process");
let token = process.argv[2];
let wait = process.argv[3];
let intents = process.argv[4];

let results = {};

function parse(lib,message) {
	results[lib] = message;
	if(Object.keys(results).length === 5) {
		let string = (results.djslight.heapUsed/1024/1024).toFixed(3).padEnd(15);
		string += (results.djslightng.heapUsed/1024/1024).toFixed(3).padEnd(15);
		string += (results.djslightcr.heapUsed/1024/1024).toFixed(3).padEnd(15);
		string += (results.eris.heapUsed/1024/1024).toFixed(3).padEnd(15);
		string += (results.djs.heapUsed/1024/1024).toFixed(3);
		console.log(string);
		results = {};
	}
}

if(!token) { console.log("missing token. pass it as the first cli parameter"); process.exit(); }
if(!wait) { console.log("missing waiting time between processes in ms, pass it as the second cli parameter"); process.exit(); }

(async () => {
	let djslight = fork(__dirname + "/djslight.js", [token,intents]);
	djslight.on("exit", process.exit);
	console.log("spawned djslight")
	await new Promise(r => setTimeout(r,wait));
	let djslightng = fork(__dirname + "/djslightng.js", [token,intents]);
	djslightng.on("exit", process.exit);
	console.log("spawned djslight no guilds")
	await new Promise(r => setTimeout(r,wait));
	let djslightcr = fork(__dirname + "/djslightcr.js", [token,intents]);
	djslightcr.on("exit", process.exit);
	console.log("spawned djslight with channels and roles")
	await new Promise(r => setTimeout(r,wait));
	let eris = fork(__dirname + "/eris.js", [token,intents]);
	eris.on("exit", process.exit);
	console.log("spawned eris")
	await new Promise(r => setTimeout(r,wait));
	let djs = fork(__dirname + "/djs.js", [token,intents]);
	djs.on("exit", process.exit);
	console.log("spawned djs");
	await new Promise(r => setTimeout(r,wait));
	djslight.on("message",parse.bind(null,"djslight"));
	djslightng.on("message",parse.bind(null,"djslightng"));
	djslightcr.on("message",parse.bind(null,"djslightcr"));
	eris.on("message",parse.bind(null,"eris"));
	djs.on("message",parse.bind(null,"djs"));
	console.log("all clients ready")
	console.log("djslight       djslight(ng)   djslight(cr)   eris           djs");
})();