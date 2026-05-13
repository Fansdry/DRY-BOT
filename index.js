const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
  NoSubscriberBehavior
} = require('@discordjs/voice');
const play = require('play-dl');

// Ambil token dari Environment Variable Railway:
// Name  : TOKEN
// Value : token bot Discord kamu
const TOKEN = process.env.TOKEN;

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

// Audio player global
const player = createAudioPlayer({
  behaviors: {
    // Saat tidak ada subscriber, cukup pause. Bot tetap berada di voice channel.
    noSubscriber: NoSubscriberBehavior.Pause
  }
});

// =========================
// Global Error Handlers
// =========================
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

// =========================
// Bot Ready
// =========================
client.once('clientReady', () => {
  console.log(`Bot aktif sebagai ${client.user.tag}`);
});

// =========================
// Message Commands
// =========================
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const content = message.content.trim();

  // ==========================================
  // !ping -> Tes apakah bot aktif
  // ==========================================
  if (content === '!ping') {
    return message.reply('Pong! Bot aktif.');
  }

  // ==========================================
  // !join -> Bot masuk ke voice channel
  // ==========================================
  if (content === '!join') {
    const voiceChannel = message.member.voice.channel;

    if (!voiceChannel) {
      return message.reply('Masuk ke voice channel dulu.');
    }

    const existingConnection = getVoiceConnection(message.guild.id);
    if (existingConnection) {
      return message.reply('Bot sudah berada di voice channel.');
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false
    });

    connection.on('error', (error) => {
      console.error('Voice Connection Error:', error.message);
    });

    return message.reply('Bot berhasil masuk ke voice channel.');
  }

  // ==========================================
  // !play <url> -> Putar musik dari YouTube URL
  // ==========================================
  if (content.startsWith('!play ')) {
    try {
      const url = content.split(' ')[1];
      const voiceChannel = message.member.voice.channel;

      if (!voiceChannel) {
        return message.reply('Masuk ke voice channel dulu.');
      }

      // Jika bot belum terhubung, hubungkan
      let connection = getVoiceConnection(message.guild.id);

      if (!connection) {
        connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: voiceChannel.guild.id,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator,
          selfDeaf: false
        });

        connection.on('error', (error) => {
          console.error('Voice Connection Error:', error.message);
        });
      }

      // Ambil stream dari YouTube
      const stream = await play.stream(url);

      // Buat resource audio
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type
      });

      // Putar dan subscribe
      player.play(resource);
      connection.subscribe(player);

      return message.reply('Sedang memutar musik.');
    } catch (error) {
      console.error('Play Error:', error);
      return message.reply(
        'Gagal memutar musik. Pastikan link YouTube valid dan coba lagi.'
      );
    }
  }

  // ==========================================
  // !stop -> Hentikan musik, bot tetap di voice
  // ==========================================
  if (content === '!stop') {
    player.stop();
    return message.reply('Musik dihentikan.');
  }

  // ==========================================
  // !leave -> Bot keluar dari voice channel
  // ==========================================
  if (content === '!leave') {
    const connection = getVoiceConnection(message.guild.id);

    if (!connection) {
      return message.reply('Bot tidak sedang berada di voice channel.');
    }

    player.stop();
    connection.destroy();

    return message.reply('Bot keluar dari voice channel.');
  }
});

// Login ke Discord
client.login(TOKEN);
