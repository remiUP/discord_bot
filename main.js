// const config = require("./config.json");
const Discord = require("discord.js");
const { MessageEmbed } = require('discord.js');
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const intents = new Discord.Intents(32767);
const client = new Discord.Client({ intents });


var channelId;
var servers;


var accounts = JSON.parse(fs.readFileSync('data.json'));
console.log(accounts);
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
		if (resp.status!=200){
			console.log("Unable to fetch" + name + "  " + resp.status);
			return null;
		}
		else{
			// console.log(resp.data);
			return resp.data;
		}
	})
	.catch(error =>{
		console.log("Unable to fetch : " + name);
		return null;
	})

	return data;
};

const getRecentMatches = async (account) => {
	const url = `https://europe.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids?api_key=${process.env.lol_token}&startTime=${Math.floor(Date.now()/1000)-24*3600}&queue=420&count=100`;
	const data = await axios.get(url)
	.then(resp => {
		if (resp.status!=200){
			console.log("Unable to fetch" + account.name + "  " + resp.status);
			return null;
		}
		else{
			// console.log(resp.data);
			return resp.data;
		}
	})
	.catch(error =>{
		console.log("Unable to fetch : " + account.name + "  " + error);
		return null;
	})
	return data;
};

const displayRecentMatchesLeaderbord = async () => {
	const channel = await client.channels.cache.get(channelId);
	var scores = [];
	for(const account of accounts){
		const matches = await getRecentMatches(account);
		if(matches.length>0){
			scores.push({username: account.name, score: matches.length});
		} 
	}
	scores.sort((a,b) => b.score - a.score);
	console.log(scores);

	var Leaderboard = new MessageEmbed()
		.setColor('#c89c38')
		.setTitle('Nombre de ranked jouées dans les dernières 24h (allez vous doucher)')
	for(var i = 0; i<scores.length; i++){
		Leaderboard.addField(`${i+1}${i==0 ? "er" : "ième"}`, `${scores[i].username}  --  \`${scores[i].score}\` Ranked jouées`, false);
	}

	channel.send({ embeds: [Leaderboard] });
};

const addTracking = async (message) => {
	const user = await getAccountByName(message.content);
	if (user===null){
		message.reply("Invalid username on EUW");
		return;
	}
	user.discord_id = message.author.id;
	accounts.push(user);
	fs.writeFileSync('data.json',JSON.stringify(accounts));
	console.log(user);
	message.reply(`Added ${user.name} (currently level ${user.summonerLevel}) to the tracked list `);
	return;
};

client.once("ready",async () => {
	console.log("5v5 bot online");
	const channel = await client.channels.cache.get(channelId);
	await channel.send("Bonjour à tous");
	await channel.send(`Currently tracking : ${accounts.map((account)=>account.name)}`);
	// for(const account of accounts){
	// 	const matches = await getRecentMatches(account);
	// 	await channel.send(`${account.name} played ${matches.length} ranked games in the last 24 hours`);
	// }
	await displayRecentMatchesLeaderbord();
});

client.on('messageCreate', async (message) => {
	if (message.author.bot || message.channelId !== channelId) return;
	if (message.content == "leaderboard"){
		await displayRecentMatchesLeaderbord();
		return;
	}
	await addTracking(message);
});

client.login(process.env.token);
