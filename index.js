const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
  NoSubscriberBehavior
} = require('@discordjs/voice');
const play = require('play-dl');
const fs = require('fs');
const os = require('os');

const TOKEN = process.env.TOKEN;
const STATE_FILE = 'voice-state.json';
const START_TIME = Date.now();

if (!TOKEN) {
  console.error('TOKEN belum diatur pada Environment Variables.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const player = createAudioPlayer({
  behaviors: {
    noSubscriber: NoSubscriberBehavior.Pause
  }
});

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch (error) {
    console.error('Load state error:', error);
  }
  return {};
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Save state error:', error);
  }
}

function setVoiceState(guildId, channelId) {
  const state = loadState();
  state[guildId] = channelId;
  saveState(state);
}

function removeVoiceState(guildId) {
  const state = loadState();
  delete state[guildId];
  saveState(state);
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index++;
  }

  return `${value.toFixed(2)} ${units[index]}`;
}

function formatUptime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
}

function connectToVoice(voiceChannel) {
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false
  });

  connection.on('error', (error) => {
    console.error('Voice Connection Error:', error.message);
  });

  return connection;
}

async function restoreVoiceConnections() {
  const state = loadState();

  for (const guildId of Object.keys(state)) {
    try {
      const channelId = state[guildId];
      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;

      const channel = guild.channels.cache.get(channelId);
      if (!channel || !channel.isVoiceBased()) continue;

      connectToVoice(channel);
      console.log(`Rejoined voice channel: ${channel.name}`);
    } catch (error) {
      console.error('Restore voice error:', error);
    }
  }
}

function getStatusText() {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();
  const uptime = formatUptime(Date.now() - START_TIME);

  const rssMB = mem.rss / 1024 / 1024;
  let risk = 'LOW';
  let warning = 'Bot berjalan stabil. Risiko crash rendah.';

  if (rssMB > 500) {
    risk = 'HIGH';
    warning = 'Penggunaan memory sangat tinggi. Potensi crash atau restart meningkat.';
  } else if (rssMB > 250) {
    risk = 'MEDIUM';
    warning = 'Penggunaan memory cukup tinggi. Pantau bot jika uptime terus bertambah.';
  }

  return [
    'Status Bot',
    `Uptime: ${uptime}`,
    `Memory RSS: ${formatBytes(mem.rss)}`,
    `Heap Used: ${formatBytes(mem.heapUsed)} / ${formatBytes(mem.heapTotal)}`,
    `External: ${formatBytes(mem.external)}`,
    `CPU User: ${(cpu.user / 1000).toFixed(2)} ms`,
    `CPU System: ${(cpu.system / 1000).toFixed(2)} ms`,
    `Platform: ${os.platform()} ${os.release()}`,
    `Node.js: ${process.version}`,
    `Hostname: ${os.hostname()}`,
    `Network Interfaces: ${Object.keys(os.networkInterfaces()).length}`,
    '',
    'Risk Assessment',
    `Level: ${risk}`,
    `Warning: ${warning}`
  ].join('\n');
}

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

client.on('error', (error) => {
  console.error('Discord Client Error:', error);
});

player.on('error', (error) => {
  console.error('Audio Player Error:', error.message);
});

client.once('clientReady', async () => {
  console.log(`Bot aktif sebagai ${client.user.tag}`);
  await restoreVoiceConnections();
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const content = message.content.trim();

  if (content === '!ping') {
    return message.reply('Pong! Bot aktif.');
  }

  if (content === '!status') {
    return message.reply('```' + getStatusText() + '```');
  }

  if (content === '!restart') {
    await message.reply('Bot sedang direstart...');
    process.exit(0);
  }

  if (content === '!join') {
    const voiceChannel = message.member.voice.channel;

    if (!voiceChannel) {
      return message.reply('Masuk ke voice channel dulu.');
    }

    if (!getVoiceConnection(message.guild.id)) {
      connectToVoice(voiceChannel);
    }

    setVoiceState(message.guild.id, voiceChannel.id);

    return message.reply('Bot berhasil masuk ke voice channel.');
  }

  if (content.startsWith('!play ')) {
    try {
      const url = content.split(' ')[1];
      const voiceChannel = message.member.voice.channel;

      if (!voiceChannel) {
        return message.reply('Masuk ke voice channel dulu.');
      }

      let connection = getVoiceConnection(message.guild.id);

      if (!connection) {
        connection = connectToVoice(voiceChannel);
      }

      setVoiceState(message.guild.id, voiceChannel.id);

      const stream = await play.stream(url);

      const resource = createAudioResource(stream.stream, {
        inputType: stream.type
      });

      player.play(resource);
      connection.subscribe(player);

      return message.reply('Sedang memutar musik.');
    } catch (error) {
      console.error('Play Error:', error);
      return message.reply('Gagal memutar musik. Pastikan link YouTube valid.');
    }
  }

  if (content === '!stop') {
    player.stop();
    return message.reply('Musik dihentikan.');
  }

  if (content === '!leave') {
    const connection = getVoiceConnection(message.guild.id);

    if (!connection) {
      return message.reply('Bot tidak sedang berada di voice channel.');
    }

    player.stop();
    connection.destroy();
    removeVoiceState(message.guild.id);

    return message.reply('Bot keluar dari voice channel.');
  }
});

client.login(TOKEN);
