import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config();

import { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, AttachmentBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

const cleanEnv = (v) => (v ?? '')
  .toString()
  .trim()
  .replace(/^['"](.*)['"]$/, '$1')
  .replace(/^Bot\s+/i, '')
  .trim();

const firstEnv = (...names) => {
  for (const n of names) {
    const v = process.env[n];
    if (v && String(v).trim()) return cleanEnv(v);
  }
  return '';
};

const BOT_TOKEN = firstEnv('DISCORD_BOT_TOKEN', 'DISCORD_TOKEN', 'BOT_TOKEN', 'TOKEN');
const CLIENT_ID = firstEnv('DISCORD_CLIENT_ID', 'CLIENT_ID', 'APPLICATION_ID', 'APP_ID');
const SERVER_URL = firstEnv('SERVER_URL') || 'http://localhost:3000';

if (!BOT_TOKEN) {
  console.error('❌ Missing bot token. Set one of: DISCORD_BOT_TOKEN / DISCORD_TOKEN / BOT_TOKEN in your .env');
  process.exit(1);
}
if (!CLIENT_ID) {
  console.error('❌ Missing client id. Set one of: DISCORD_CLIENT_ID / CLIENT_ID / APPLICATION_ID in your .env');
  process.exit(1);
}

const ADMIN_ID = '348967279180120067';
const TOKENS_FILE = path.join(__dirname, 'tokens.json');
const SECRET_KEY = 'my_secure_key_12345';
const SAVEINSTANCE_COST = 1; // Cost in tokens per saveinstance

function loadTokens() {
  if (fs.existsSync(TOKENS_FILE)) {
    return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
  }
  return { [ADMIN_ID]: 1000000 };
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}

let tokens = loadTokens();

client.once('ready', () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
});

const command1 = new SlashCommandBuilder()
  .setName('tokens')
  .setDescription('check your token balance')
  .toJSON();

const command2 = new SlashCommandBuilder()
  .setName('ctoken')
  .setDescription('change user token value (ADMIN)')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('The user to give/remove tokens from')
      .setRequired(true)
  )
  .addNumberOption(option =>
    option
      .setName('amount')
      .setDescription('ex: 10 to give, -10 to remove')
      .setRequired(true)
  )
  .toJSON();

const command3 = new SlashCommandBuilder()
  .setName('saveinstance')
  .setDescription('teleport to a game and save the instance')
  .addStringOption(option =>
    option
      .setName('game_id')
      .setDescription('Target Roblox Game ID')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('filename')
      .setDescription('Custom filename for the save (optional)')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option
      .setName('noui')
      .setDescription('Disable UI during save (default: false)')
      .setRequired(false)
  )
  .addBooleanOption(option =>
    option
      .setName('silent')
      .setDescription('Silent mode - no notifications (default: false)')
      .setRequired(false)
  )
  .toJSON();

const commands = [command1, command2, command3];

console.log('📋 Registering commands:', commands.map(c => c.name).join(', '));

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

(async () => {
  try {
    console.log('📡 Registering slash commands...');
    const result = await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Slash commands registered:', result.map(c => c.name).join(', '));
  } catch (error) {
    console.error('❌ Failed to register commands:', error);
  }
})();

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;

  if (interaction.commandName === 'tokens') {
    const userTokens = tokens[userId] || 0;
    await interaction.reply({
      content: `you have \`${userTokens}\` tokens`,
      flags: 64
    });
    return;
  }

  if (interaction.commandName === 'ctoken') {
    if (userId !== ADMIN_ID) {
      await interaction.reply({
        content: 'perms not `located`',
        flags: 64
      });
      return;
    }

    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getNumber('amount');
    const targetId = targetUser.id;

    if (!tokens[targetId]) tokens[targetId] = 0;
    
    tokens[targetId] += amount;
    if (tokens[targetId] < 0) tokens[targetId] = 0;
    
    saveTokens(tokens);

    const action = amount > 0 ? 'gave' : 'removed';
    const absAmount = Math.abs(amount);
    
    await interaction.reply({
      content: `${action.charAt(0).toLowerCase() + action.slice(1)} \`${absAmount}\` tokens to <@${targetUser.id}>\n\nnew balance: \`${tokens[targetId]}\` tokens`,
      flags: 64
    });
    return;
  }

  if (interaction.commandName === 'saveinstance') {
    const userTokens = tokens[userId] || 0;

    if (userTokens < SAVEINSTANCE_COST) {
      await interaction.reply({
        content: `no tokens (Need ${SAVEINSTANCE_COST}, Have ${userTokens})`,
        flags: 64
      });
      return;
    }

    let gameId = interaction.options.getString('game_id');
    console.log('Raw game ID input:', gameId);
    
    // Clean up the input - remove spaces and extra characters
    gameId = gameId.trim().replace(/[^0-9]/g, '');
    
    console.log('Cleaned game ID:', gameId);

    if (!gameId || !/^\d+$/.test(gameId)) {
      await interaction.reply({
        content: '❌ Invalid game ID. Please provide a valid Roblox game ID (numbers only). Example: `/saveinstance game_id: 6470454889`',
        flags: 64
      });
      return;
    }

    const filename = interaction.options.getString('filename');
    const noUI = interaction.options.getBoolean('noui') || false;
    const silent = interaction.options.getBoolean('silent') || false;

    await interaction.deferReply({ flags: 64 });

    try {
      const commandId = `cmd_${Date.now()}`;
      
      const payload = {
        action: 'saveinstance',
        gameId: gameId,
        secretKey: SECRET_KEY,
        commandId: commandId,
        discordUser: interaction.user.tag,
        discordUserId: userId,
        options: {
          filename: filename || `instance_${gameId}_${Date.now()}`,
          noUI: noUI,
          silent: silent
        },
        timestamp: Date.now()
      };

      console.log('Broadcasting saveinstance command:', payload);

      const response = await fetch(`${SERVER_URL}/broadcast-saveinstance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      
      console.log('SaveInstance response:', result);

      if (result.success) {
        tokens[userId] -= SAVEINSTANCE_COST;
        saveTokens(tokens);

        // Store the interaction for later file sending
        const interactionData = {
          interaction,
          commandId,
          userId
        };

        // Wait for the file to be saved (with timeout)
        let fileReady = false;
        let attempts = 0;
        const maxAttempts = 120; // 4 minutes (120 * 2 seconds)

        const checkInterval = setInterval(async () => {
          attempts++;

          try {
            const checkResponse = await fetch(`${SERVER_URL}/get-saveinstance-result/${commandId}?key=${SECRET_KEY}`);
            const checkResult = await checkResponse.json();

            if (checkResult.success && checkResult.result) {
              clearInterval(checkInterval);
              fileReady = true;

              const fileResult = checkResult.result;
              const filePath = fileResult.filename;

              console.log('File ready:', filePath);

              try {
                // Read the file
                if (fs.existsSync(filePath)) {
                  const fileBuffer = fs.readFileSync(filePath);
                  const attachment = new AttachmentBuilder(fileBuffer, {
                    name: path.basename(filePath)
                  });

                  await interaction.followUp({
                    content: `✅ SaveInstance complete!\n🎮 Game: \`${gameId}\`\n📂 File: \`${path.basename(filePath)}\``,
                    files: [attachment],
                    flags: 64
                  });

                  console.log('File sent to Discord');
                } else {
                  await interaction.followUp({
                    content: `⚠️ File was saved but not found at: \`${filePath}\`\n\nPlease check your Volt workspace folder manually.`,
                    flags: 64
                  });
                }
              } catch (fileError) {
                console.error('Error reading/sending file:', fileError);
                await interaction.followUp({
                  content: `⚠️ SaveInstance completed but failed to send file: ${fileError.message}\n\nFile should be at: \`${filePath}\``,
                  flags: 64
                });
              }
            } else if (attempts >= maxAttempts) {
              clearInterval(checkInterval);
              await interaction.followUp({
                content: '⏱️ Timeout waiting for file. The save may still be in progress.',
                flags: 64
              });
            }
          } catch (error) {
            console.error('Error checking result:', error);
            if (attempts >= maxAttempts) {
              clearInterval(checkInterval);
            }
          }
        }, 2000); // Check every 2 seconds

        await interaction.editReply({
          content: `✅ SaveInstance command sent\n🎮 Teleporting to game \`${gameId}\`\n💾 Waiting for instance to save...\n💰 \`${tokens[userId]}\` tokens remaining (cost: ${SAVEINSTANCE_COST})\n\n**Make sure the auto-execute script is running!**`
        });
      } else {
        await interaction.editReply({
          content: `❌ ${result.message || 'Failed to send command'}`
        });
      }
    } catch (error) {
      console.error('SaveInstance command error:', error);
      await interaction.editReply({
        content: `❌ Error: ${error.message}`
      });
    }
  }
});

client.login(BOT_TOKEN);
