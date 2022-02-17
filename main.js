// const config = require("./config.json");
const fs = require('fs');
const Discord = require("discord.js");
const { LolApi, Constants } = require('twisted')
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

const { MessageEmbed } = require('discord.js');
require('dotenv').config();
const axios = require('axios');

const intents = new Discord.Intents(32767);
const client = new Discord.Client({ intents });

const prefix = "!!";

const api = new LolApi({
	key:process.env.lol_token,
	debug:{
		logTime:true,
		logUrls:true,
		logRatelimits:true
	}
});

var commands = {};

// for (const file of commandFiles){
// 	const command = require(`./commands/${file}`);
// 	commands[file.replace('.js','')] = command;
// }

// console.log(commands);

var channelId;
var servers;


var accounts = JSON.parse(fs.readFileSync('data.json'));
// console.log(accounts);
//var accounts = [];

if (process.env.run_mode == "prod"){
	channelId = "942428213861306461";
	serverId = "690605742599831563";
	console.log("⚠️ Starting in production mode ⚠️");
}
else {
	channelId = "942368049296736266";
	serverId = "919984229176201266";
	if (process.env.run_mode !== "dev"){
		console.log("Incorrect value for 'run_mode' in the config file : defaulting to development mode");
	}
	console.log("🚧 Starting in development mode 🚧");
}

const getAccountByName = async (name) =>{
	const url = `https://euw1.api.riotgames.com/lol/summoner/v4/summoners/by-name/${name}`+'?api_key='+process.env.lol_token;
	const data = await axios.get(url)
	.then(resp => {
		console.log(resp.status);
		if (resp.status==429){
			
		}
		else if (resp.status!=200){
			console.log("Unable to fetch account with name :" + name + "  " + resp.status);
			return null;
		}
		else{
			// console.log(resp.data);
			return resp.data;
		}
	})
	.catch(error =>{
		console.log("Unable to fetch account with name (request failed): " + name);
		return null;
	})

	return data;
};

// const getRecentMatches = async (account) => {
// 	const url = `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids?api_key=${process.env.lol_token}&startTime=${Math.floor(Date.now()/1000)-24*3600}&count=100`;
// 	const data = await axios.get(url)
// 	.then(resp => {
// 		if (resp.status!=200){
// 			console.log("Unable to fetch match history of " + account.name + "  " + resp.status);
// 			return null;
// 		}
// 		else{
// 			// console.log(resp.data);
// 			return resp.data;
// 		}
// 	})
// 	.catch(error =>{
// 		console.log("Unable to fetch match history (request failed) of : " + account.name + "  " + error);
// 		return null;
// 	})
// 	return data;
// };

const getRecentMatches = async (account) => {
	try {
		const matchlist = await api.MatchV5.list(account.puuid, Constants.RegionGroups.EUROPE, {startTime: Math.floor(Date.now()/1000)-24*3600, count: 100});
		console.log(matchlist.response);
		return matchlist.response;
	} catch (error) {
		console.log("Unable to fetch matchlist for :" + account.name);
		return null;
	}
}

const getWinLose = async (matches, account) =>{
	try {
		var win = 0;
		var lose = 0;
		for(const match of matches){
			const res = await api.MatchV5.get(match, Constants.RegionGroups.EUROPE);
			res.response.info.participants;
		}
	} catch (error) {
		
	}
}

const displayRecentMatchesLeaderbord = async (message) => {
	const channel = await client.channels.cache.get(channelId);
	var scores = [];
	for(const account of accounts){
		const matches = await getRecentMatches(account);
		if(matches === null) return;
		if(matches.length>0){
			scores.push({username: account.name, score: matches.length});
		}
	}
	scores.sort((a,b) => b.score - a.score);
	console.log(scores);

	var Leaderboard = new MessageEmbed()
		.setColor('#c89c38')
		.setTitle('Nombre de parties jouées dans les dernières 24h (allez vous doucher)')
		.setDescription(`Actualisé toutes les 4h. Tappez "${prefix}leaderboard" pour le rafraîchir maintenant. Tappez votre pseudo in-game pour être ajouté a la liste des comptes trackés`)
		.setTimestamp();
	for(var i = 0; i<scores.length; i++){
		Leaderboard.addField(`${i+1}${i==0 ? "er" : "ième"}`, `${scores[i].username}  --  \`${scores[i].score}\` parties jouées`, false);
	}

	channel.send({ embeds: [Leaderboard] });
};

const checkIfAlreadyTracked = (author) => {
	const find = accounts.find((el) => el.id == author.id);
	if (find===undefined){
		return false;
	}
	else{
		return true;
	}
}

const addTracking = async (message) => {
	try{
		const res= await api.Summoner.getByName(message,Constants.Regions.EU_WEST);
		const user = res.response;
		console.log(user);
		if (checkIfAlreadyTracked(user)){
			message.reply(`Already tracking ${user.name}`);
			return;
		}
		user.discord_id = message.author.id;
		accounts.push(user);
		fs.writeFileSync('data.json',JSON.stringify(accounts));
		console.log(user);
		message.reply(`Added ${user.name} (currently level ${user.summonerLevel}) to the tracked list `);
	}
	catch (error){
		if (error.status == 404){
			message.reply("Invalid username on EUW");
		}
	}
};

const removeTracking = async (message) => {
	try{
		const res= await api.Summoner.getByName(message,Constants.Regions.EU_WEST);
		const user = res.response;
		if (!checkIfAlreadyTracked(user)){
			message.reply(`${user.name} is already untracked.`);
			return;
		}
		accounts = accounts.filter((el) => !(el.id == user.id));
		fs.writeFileSync('data.json',JSON.stringify(accounts));
		console.log(user);
		message.reply(`Removed ${user.name} (currently level ${user.summonerLevel}) from the tracked list `);
	}
	catch (error){
		if (error.status == 404){
			message.reply("Invalid username on EUW");
		}
	}
}

const listTrackedPlayer = async (message) => {
	message.reply(`Tracking : ${accounts.map(player => player.name).join()}`);
}

client.once("ready",async () => {
	console.log("5v5 bot online");
	// const channel = await client.channels.cache.get(channelId);
	// await channel.send("Bonjour à tous");
	// await channel.send(`Currently tracking : ${accounts.map((account)=>account.name)}`);
	// for(const account of accounts){
	// 	const matches = await getRecentMatches(account);
	// 	await channel.send(`${account.name} played ${matches.length} ranked games in the last 24 hours`);
	// }
	// await displayRecentMatchesLeaderbord();
	// try{
	// 	const res = await api.Summoner.getByName('remisdfsdffdsfdUP',Constants.Regions.EU_WEST);
	// 	console.log(res.response);
	// }
	// catch (error){
	// 	console.log(error.status);
	// };
	// console.log(res)
});

const showHelp = async (message) => {
	message.reply(`Available commands: ${Object.keys(commands).join(', ')}`);
}

commands = {
	'track' : addTracking,
	'untrack' : removeTracking,
	'list' : listTrackedPlayer,
	'leaderboard' : displayRecentMatchesLeaderbord,
	'help' : showHelp,
}


client.on('messageCreate', async (message) => {
	if (message.author.bot || message.channelId !== channelId) return;
	if (!message.content.startsWith(prefix)) return;
	const command = message.content.slice(prefix.length).split(' ');
	const func = commands[command[0]];
	message.content = command[1];
	if (func===undefined){
		message.reply(`La commande "${command[0]}" n'existe pas. "${prefix}help" pour avoir la liste des commandes.`);
	}
	await func(message);
	// if (message.content == "leaderboard"){
	// 	await displayRecentMatchesLeaderbord();
	// 	return;
	// }
	// await addTracking(message);
});

setInterval(async ()=>{
	await displayRecentMatchesLeaderbord();
}, 4*3600*1000);


client.login(process.env.discord_token);
