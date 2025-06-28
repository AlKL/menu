const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');

// Load environment variables in development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

class MenuBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });

        // Your local API server URL
        this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001';

        // Command prefix
        this.prefix = '!';

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        this.client.once('ready', () => {
            console.log(`✅ Bot logged in as ${this.client.user.tag}`);
            this.client.user.setActivity('Managing bubble tea menus 🧋');
        });

        this.client.on('messageCreate', async (message) => {
            // Log ALL messages for debugging
            console.log(`📨 Message received: "${message.content}" from ${message.author.username} in #${message.channel.name} (${message.channel.id})`);
            
            // Ignore bot messages
            if (message.author.bot) {
                console.log(`🤖 Ignoring bot message from ${message.author.username}`);
                return;
            }

            // Check if message starts with prefix
            if (!message.content.startsWith(this.prefix)) {
                console.log(`❌ Message doesn't start with prefix "${this.prefix}"`);
                return;
            }

            // Check allowed channels
            const allowedChannels = process.env.ALLOWED_CHANNELS?.split(',') || [];
            console.log(`🔍 Allowed channels: ${allowedChannels.length > 0 ? allowedChannels.join(', ') : 'ALL CHANNELS'}`);
            
            if (allowedChannels.length > 0 && !allowedChannels.includes(message.channel.id)) {
                console.log(`🚫 Channel ${message.channel.id} not in allowed channels list`);
                return;
            }

            console.log(`✅ Processing command: ${message.content}`);
            await this.handleCommand(message);
        });

        this.client.on('error', console.error);
    }

    async handleCommand(message) {
        const args = message.content.slice(this.prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        try {
            switch (command) {
                case '86':
                    await this.handle86Command(message, args);
                    break;
                case 'restore':
                    await this.handleRestoreCommand(message, args);
                    break;
                case 'status':
                    await this.handleStatusCommand(message, args);
                    break;
                case 'menu':
                    await this.handleMenuCommand(message);
                    break;
                case 'help':
                    await this.handleHelpCommand(message);
                    break;
                default:
                    await this.sendErrorEmbed(message, 'Unknown command. Use `!help` to see available commands.');
            }
        } catch (error) {
            console.error('Command error:', error);
            await this.sendErrorEmbed(message, 'Something went wrong processing your command.');
        }
    }

    async handle86Command(message, args) {
        if (args.length === 0) {
            await this.sendErrorEmbed(message, 'Please specify an ingredient to 86.\nExample: `!86 tapioca`');
            return;
        }

        const ingredient = args.join(' ').toLowerCase();

        try {
            // Call your local API to 86 the ingredient
            const response = await axios.post(`${this.apiBaseUrl}/api/86`, {
                ingredient: ingredient,
                user: message.author.username
            });

            const { affectedItems } = response.data;

            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('🚫 Items Removed from Menu')
                .setDescription(`Successfully removed **${ingredient}** from UberEats menu`)
                .setTimestamp();

            // Add drinks field if any drinks were affected
            if (affectedItems.drinks && affectedItems.drinks.length > 0) {
                embed.addFields({
                    name: '🥤 Affected Drinks',
                    value: affectedItems.drinks.join('\n'),
                    inline: false
                });
            }

            // Add toppings field if any toppings were affected
            if (affectedItems.toppings && affectedItems.toppings.length > 0) {
                embed.addFields({
                    name: '🧋 Affected Toppings',
                    value: affectedItems.toppings.join('\n'),
                    inline: false
                });
            }

            // Add metadata
            embed.addFields(
                { name: 'Removed by', value: message.author.username, inline: true },
                { name: 'Time', value: new Date().toLocaleTimeString(), inline: true }
            );

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('86 command error:', error);
            await this.sendErrorEmbed(message, `Failed to remove ${ingredient}: ${error.response?.data?.details || error.message}`);
        }
    }

    async handleRestoreCommand(message, args) {
        if (args.length === 0) {
            await this.sendErrorEmbed(message, 'Please specify an ingredient to restore.\nExample: `!restore tapioca`');
            return;
        }

        const ingredient = args.join(' ').toLowerCase();

        try {
            const response = await axios.post(`${this.apiBaseUrl}/api/restore`, {
                ingredient: ingredient,
                user: message.author.username
            });

            const { restoredItems } = response.data;

            const embed = new EmbedBuilder()
                .setColor('#4ecdc4')
                .setTitle('✅ Items Restored to Menu')
                .setDescription(`Successfully restored **${ingredient}** to UberEats menu`)
                .setTimestamp();

            // Add drinks field if any drinks were restored
            if (restoredItems.drinks && restoredItems.drinks.length > 0) {
                embed.addFields({
                    name: '🥤 Restored Drinks',
                    value: restoredItems.drinks.join('\n'),
                    inline: false
                });
            }

            // Add toppings field if any toppings were restored
            if (restoredItems.toppings && restoredItems.toppings.length > 0) {
                embed.addFields({
                    name: '🧋 Restored Toppings',
                    value: restoredItems.toppings.join('\n'),
                    inline: false
                });
            }

            // Add metadata
            embed.addFields(
                { name: 'Restored by', value: message.author.username, inline: true },
                { name: 'Time', value: new Date().toLocaleTimeString(), inline: true }
            );

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('Restore command error:', error);
            await this.sendErrorEmbed(message, `Failed to restore ${ingredient}: ${error.response?.data?.details || error.message}`);
        }
    }

    async handleStatusCommand(message, args) {
        try {
            if (args.length > 0) {
                // Status for specific ingredient
                const ingredient = args.join(' ').toLowerCase();
                const response = await axios.get(`${this.apiBaseUrl}/api/status?ingredient=${encodeURIComponent(ingredient)}`);
                const { available, outOfStock } = response.data;

                const embed = new EmbedBuilder()
                    .setColor('#f9ca24')
                    .setTitle(`📊 Status for ${ingredient}`)
                    .setTimestamp();

                // Available drinks and toppings
                if (available.drinks.length > 0 || available.toppings.length > 0) {
                    let availableText = '';
                    if (available.drinks.length > 0) {
                        availableText += `**Drinks:**\n${available.drinks.join('\n')}\n\n`;
                    }
                    if (available.toppings.length > 0) {
                        availableText += `**Toppings:**\n${available.toppings.join('\n')}`;
                    }
                    embed.addFields({ name: '✅ Available', value: availableText.trim() || 'None', inline: false });
                }

                // Out of stock drinks and toppings
                if (outOfStock.drinks.length > 0 || outOfStock.toppings.length > 0) {
                    let outOfStockText = '';
                    if (outOfStock.drinks.length > 0) {
                        outOfStockText += `**Drinks:**\n${outOfStock.drinks.join('\n')}\n\n`;
                    }
                    if (outOfStock.toppings.length > 0) {
                        outOfStockText += `**Toppings:**\n${outOfStock.toppings.join('\n')}`;
                    }
                    embed.addFields({ name: '❌ Out of Stock', value: outOfStockText.trim() || 'None', inline: false });
                }

                await message.channel.send({ embeds: [embed] });

            } else {
                // Overall menu status
                const response = await axios.get(`${this.apiBaseUrl}/api/status`);
                const status = response.data;

                const embed = new EmbedBuilder()
                    .setColor('#f9ca24')
                    .setTitle('📊 Overall Menu Status')
                    .addFields(
                        {
                            name: '🥤 Drinks',
                            value: `Total: ${status.drinks.total}\nAvailable: ${status.drinks.available}\nOut of Stock: ${status.drinks.outOfStock}`,
                            inline: true
                        },
                        {
                            name: '🧋 Toppings',
                            value: `Total: ${status.toppings.total}\nAvailable: ${status.toppings.available}\nOut of Stock: ${status.toppings.outOfStock}`,
                            inline: true
                        }
                    )
                    .setTimestamp();

                await message.channel.send({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Status command error:', error);
            await this.sendErrorEmbed(message, 'Failed to get menu status.');
        }
    }

    async handleMenuCommand(message) {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/api/ingredients`);
            const ingredients = response.data.ingredients;

            const embed = new EmbedBuilder()
                .setColor('#6c5ce7')
                .setTitle('🧋 Available Ingredients')
                .setDescription('These are all the ingredients you can 86 or restore:')
                .addFields(
                    { name: 'Ingredients', value: ingredients.join(', ') || 'No ingredients found', inline: false }
                )
                .setFooter({ text: 'Use !86 <ingredient> to remove items containing an ingredient' })
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('Menu command error:', error);
            await this.sendErrorEmbed(message, 'Failed to get menu ingredients.');
        }
    }

    async handleHelpCommand(message) {
        const embed = new EmbedBuilder()
            .setColor('#0984e3')
            .setTitle('🤖 Menu Bot Commands')
            .setDescription('Here are all available commands:')
            .addFields(
                { name: '!86 <ingredient>', value: 'Remove all items containing an ingredient from the menu', inline: false },
                { name: '!restore <ingredient>', value: 'Restore all items containing an ingredient to the menu', inline: false },
                { name: '!status', value: 'View overall menu status (drinks and toppings)', inline: false },
                { name: '!status <ingredient>', value: 'View status of items containing a specific ingredient', inline: false },
                { name: '!menu', value: 'List all available ingredients', inline: false },
                { name: '!help', value: 'Show this help message', inline: false }
            )
            .setFooter({ text: 'Example: !86 pearls - This will remove Pearl Milk Tea drink AND the Pearls topping' })
            .setTimestamp();

        await message.channel.send({ embeds: [embed] });
    }

    async sendErrorEmbed(message, errorText) {
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('❌ Error')
            .setDescription(errorText)
            .setTimestamp();

        await message.channel.send({ embeds: [embed] });
    }

    async start() {
        const token = process.env.DISCORD_BOT_TOKEN;

        if (!token) {
            console.error('❌ No Discord bot token provided. Set DISCORD_BOT_TOKEN environment variable.');
            process.exit(1);
        }

        try {
            await this.client.login(token);
        } catch (error) {
            console.error('❌ Failed to log in to Discord:', error);
            process.exit(1);
        }
    }
}

// Start the bot
const bot = new MenuBot();
bot.start();

module.exports = MenuBot;