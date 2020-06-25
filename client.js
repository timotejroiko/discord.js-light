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
				cacheEmojis:false
			},
			options
		);
		super(options);
		Handlers(this);
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