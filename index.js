const { promisify } = require('util');
const { Client, Collection } = require('discord.js');
const process = require('process');
const glob = require('glob');
const client = new Client({ intents: 14335, partials: [ 'CHANNEL', 'USER', 'MESSAGE' ] });
const config = require('./config.json');
// Não é recomendado usar config.json na replit, use Secrets 🔒 ao invés disso
require('colors');

const { connect } = require('mongoose');

connect(config.mongo_key)
    .then(() => console.log('Conectado com sucesso ao banco de dados'))
    .catch(err => console.log('Erro ao conectar ao banco de dados: ', err));


client.commands = new Collection();
client.prefixoPadrao = config.prefix;

const globPromise = promisify(glob);

const pastaComandos = './commands';
const pastaEventos = './events';



client.once('ready', async () => {

    const comandos = await globPromise(`${pastaComandos}/**/*.js`);
    const eventos = await globPromise(`${pastaEventos}/**/*.js`);

    for (const cmd of comandos) {
        const command = require(cmd);
        // console.log(cmd);
        client.commands.set(command.name, command);
        console.log(`${command.name.green} carregado`);
    }
    
    for (const evento of eventos) {
        const evt = require(evento);
        client.on(evt.name, (...args) => evt.execute(...args));
        console.log(`${evt.name.yellow} carregado`);
    }

    console.log('*'.repeat(15));
    console.log(`${client.user.tag.cyan} online`);



});

// client.on('debug', console.log);
    
client.login(config.token);

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (!message.content.toLowerCase().startsWith(message.client.prefixoPadrao.toLowerCase())) return;

    const args = message.content.slice(message.client.prefixoPadrao.length).trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    const cmd = message.client.commands.get(command);
        
    if (!cmd) return;
    try {
        await cmd.run(message.client, message, args);
    }
    catch (error) {
        console.log('Error: ', error);
    }
});

process.on('unhandledRejection', reason => {
    console.log('\n');
    console.log(reason);
});

process.on('uncaughtException', (err, origin) => {
    console.log('Erro: ');
    console.log(err);
    console.log('Origem do erro: ');
    console.log(origin);
});
