const { REST } = require("@discordjs/rest");
const { Routes } = require('discord-api-types/v9');
const fs = require('fs');

const clientId = process.env.DISCORD_CLIENT_ID;

module.exports = (client) => {
    client.handleCommands = async (commandFolders, path) => {
        if (!clientId) {
            console.error('DISCORD_CLIENT_ID is not configured; slash commands were not registered.');
            return;
        }

        client.commandArray = [];
        for (folder of commandFolders) {
            const commandFiles = fs.readdirSync(`${path}/${folder}`).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const command = require(`../commands/${folder}/${file}`);
                client.commands.set(command.data.name, command);
                client.commandArray.push(command.data.toJSON());
            }
        }

        const rest = new REST({
            version: '9'
        }).setToken(process.env.token);

        (async () => {
            try {
                console.log('Started refreshing application (/) commands.');

                const existingCommands = await rest.get(Routes.applicationCommands(clientId));
                const entryPointCommand = existingCommands.find(command => command.type === 4);
                const commands = entryPointCommand
                    ? [...client.commandArray, entryPointCommand]
                    : client.commandArray;

                await rest.put(
                    Routes.applicationCommands(clientId), {
                        body: commands
                    },
                );

                console.log('Successfully reloaded application (/) commands.');
            } catch (error) {
                console.error(error);
            }
        })();
    };
};