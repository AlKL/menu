const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const axios = require('axios');

// Load environment variables in development
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}

class MenuBot {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds
            ]
        });

        // Your local API server URL
        this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3001';

        this.commands = [
            new SlashCommandBuilder()
                .setName('86')
                .setDescription('Remove items containing an ingredient from the menu')
                .addStringOption(option =>
                    option.setName('ingredient')
                        .setDescription('The ingredient to remove')
                        .setRequired(true)),
            new SlashCommandBuilder()
                .setName('restore')
                .setDescription('Restore items containing an ingredient to the menu')
                .addStringOption(option =>
                    option.setName('ingredient')
                        .setDescription('The ingredient to restore')
                        .setRequired(true)),
            new SlashCommandBuilder()
                .setName('status')
                .setDescription('View menu status')
                .addStringOption(option =>
                    option.setName('ingredient')
                        .setDescription('Specific ingredient to check (optional)')
                        .setRequired(false)),
            new SlashCommandBuilder()
                .setName('menu')
                .setDescription('List all available ingredients'),
            new SlashCommandBuilder()
                .setName('help')
                .setDescription('Show help information')
        ];

        this.setupEventHandlers();
    }

    async registerCommands() {
        try {
            console.log('Started refreshing application (/) commands.');

            const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
            
            await rest.put(
                Routes.applicationCommands(this.client.user.id),
                { body: this.commands },
            );

            console.log('Successfully reloaded application (/) commands.');
        } catch (error) {
            console.error('Error registering commands:', error);
        }
    }

    setupEventHandlers() {
        this.client.once('ready', async () => {
            console.log(`✅ Bot logged in as ${this.client.user.tag}`);
            this.client.user.setActivity('Managing bubble tea menus 🧋');
            
            // Register slash commands
            await this.registerCommands();
        });

        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isCommand()) return;

            // Only respond in designated channels (optional)
            const allowedChannels = process.env.ALLOWED_CHANNELS?.split(',') || [];
            if (allowedChannels.length > 0 && !allowedChannels.includes(interaction.channel.id)) {
                await interaction.reply({ content: 'This command can only be used in designated channels.', ephemeral: true });
                return;
            }

            await this.handleCommand(interaction);
        });

        this.client.on('error', console.error);
    }

    async handleCommand(interaction) {
        try {
            switch (interaction.commandName) {
                case '86':
                    await this.handle86Command(interaction);
                    break;
                case 'restore':
                    await this.handleRestoreCommand(interaction);
                    break;
                case 'status':
                    await this.handleStatusCommand(interaction);
                    break;
                case 'menu':
                    await this.handleMenuCommand(interaction);
                    break;
                case 'help':
                    await this.handleHelpCommand(interaction);
                    break;
            }
        } catch (error) {
            console.error('Command error:', error);
            const errorMessage = 'Something went wrong processing your command.';
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(errorMessage);
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    }

    async handle86Command(interaction) {
        await interaction.deferReply();
        
        const ingredient = interaction.options.getString('ingredient').toLowerCase();

        try {
            const response = await axios.post(`${this.apiBaseUrl}/api/86`, {
                ingredient: ingredient,
                user: interaction.user.username
            });

            const { affectedItems } = response.data;
            
            const embed = new EmbedBuilder()
                .setColor('#ff6b6b')
                .setTitle('🚫 Items Removed from Menu')
                .setDescription(`Successfully removed **${ingredient}** from UberEats menu`)
                .setTimestamp();

            if (affectedItems.drinks && affectedItems.drinks.length > 0) {
                embed.addFields({
                    name: '🥤 Affected Drinks',
                    value: affectedItems.drinks.join('\n'),
                    inline: false
                });
            }

            if (affectedItems.toppings && affectedItems.toppings.length > 0) {
                embed.addFields({
                    name: '🧋 Affected Toppings',
                    value: affectedItems.toppings.join('\n'),
                    inline: false
                });
            }

            embed.addFields(
                { name: 'Removed by', value: interaction.user.username, inline: true },
                { name: 'Time', value: new Date().toLocaleTimeString(), inline: true }
            );

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('86 command error:', error);
            await interaction.editReply(`Failed to remove ${ingredient}: ${error.response?.data?.details || error.message}`);
        }
    }

    async handleRestoreCommand(interaction) {
        await interaction.deferReply();
        
        const ingredient = interaction.options.getString('ingredient').toLowerCase();

        try {
            const response = await axios.post(`${this.apiBaseUrl}/api/restore`, {
                ingredient: ingredient,
                user: interaction.user.username
            });

            const { restoredItems } = response.data;

            const embed = new EmbedBuilder()
                .setColor('#4ecdc4')
                .setTitle('✅ Items Restored to Menu')
                .setDescription(`Successfully restored **${ingredient}** to UberEats menu`)
                .setTimestamp();

            if (restoredItems.drinks && restoredItems.drinks.length > 0) {
                embed.addFields({
                    name: '🥤 Restored Drinks',
                    value: restoredItems.drinks.join('\n'),
                    inline: false
                });
            }

            if (restoredItems.toppings && restoredItems.toppings.length > 0) {
                embed.addFields({
                    name: '🧋 Restored Toppings',
                    value: restoredItems.toppings.join('\n'),
                    inline: false
                });
            }

            embed.addFields(
                { name: 'Restored by', value: interaction.user.username, inline: true },
                { name: 'Time', value: new Date().toLocaleTimeString(), inline: true }
            );

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Restore command error:', error);
            await interaction.editReply(`Failed to restore ${ingredient}: ${error.response?.data?.details || error.message}`);
        }
    }

    async handleStatusCommand(interaction) {
        await interaction.deferReply();
        
        const ingredient = interaction.options.getString('ingredient');

        try {
            if (ingredient) {
                const response = await axios.get(`${this.apiBaseUrl}/api/status?ingredient=${encodeURIComponent(ingredient)}`);
                const { available, outOfStock } = response.data;

                const embed = new EmbedBuilder()
                    .setColor('#f9ca24')
                    .setTitle(`📊 Status for ${ingredient}`)
                    .setTimestamp();

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

                await interaction.editReply({ embeds: [embed] });

            } else {
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

                await interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Status command error:', error);
            await interaction.editReply('Failed to get menu status.');
        }
    }

    async handleMenuCommand(interaction) {
        await interaction.deferReply();

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
                .setFooter({ text: 'Use /86 <ingredient> to remove items containing an ingredient' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Menu command error:', error);
            await interaction.editReply('Failed to get menu ingredients.');
        }
    }

    async handleHelpCommand(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#0984e3')
            .setTitle('🤖 Menu Bot Commands')
            .setDescription('Here are all available commands:')
            .addFields(
                { name: '/86 <ingredient>', value: 'Remove all items containing an ingredient from the menu', inline: false },
                { name: '/restore <ingredient>', value: 'Restore all items containing an ingredient to the menu', inline: false },
                { name: '/status', value: 'View overall menu status (drinks and toppings)', inline: false },
                { name: '/status <ingredient>', value: 'View status of items containing a specific ingredient', inline: false },
                { name: '/menu', value: 'List all available ingredients', inline: false },
                { name: '/help', value: 'Show this help message', inline: false }
            )
            .setFooter({ text: 'Example: /86 pearls - This will remove Pearl Milk Tea drink AND the Pearls topping' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
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