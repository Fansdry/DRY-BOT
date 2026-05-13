const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
  AudioPlayerStatus,
  NoSubscriberBehavior
} = require('@discordjs/voice');
const play = require('play-dl');

// Ambil token dari Environment Variable di cPanel:
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
    // Bot tetap berada di voice channel meskipun tidak ada lagu yang diputar
    noSubscriber: NoSubscriberBehavior.Pause
  }
});

// Saat bot berhasil login
client.once('ready', () => {
  console.log(`Bot aktif sebagai ${client.user.tag}`);
});

// Menampilkan error agar mudah dilihat di log
player.on('error', (error) => {
  console.error('Audio Player Error:', error.message);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();

  // ==================================================
  // !join -> Bot masuk ke voice channel dan tetap diam
  // ==================================================
  if (content === '!join') {
    const voiceChannel = message.member.voice.channel;

    if (!voiceChannel) {
      return message.reply('Masuk ke voice channel dulu.');
    }

    const existingConnection = getVoiceConnection(message.guild.id);
    if (existingConnection) {
      return message.reply('Bot sudah berada di voice channel.');
    }

    joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false
    });

    return message.reply('Bot berhasil masuk ke voice channel.');
  }

  // ==================================================
  // !play <url> -> Putar musik dari YouTube URL
  // ==================================================
  if (content.startsWith('!play ')) {
    try {
      const url = content.split(' ')[1];
      const voiceChannel = message.member.voice.channel;

      if (!voiceChannel) {
        return message.reply('Masuk ke voice channel dulu.');
      }

      // Jika bot belum ada di voice channel, hubungkan
      let connection = getVoiceConnection(message.guild.id);

      if (!connection) {
        connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: voiceChannel.guild.id,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator,
          selfDeaf: false
        });
      }

      // Ambil stream audio
      const stream = await play.stream(url);

      // Buat resource audio
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type
      });

      // Putar audio
      player.play(resource);
      connection.subscribe(player);

      return message.reply('Sedang memutar musik.');
    } catch (error) {
      console.error('Play Error:', error);
      return message.reply('Gagal memutar musik. Pastikan link YouTube valid.');
    }
  }

  // ==================================================
  // !stop -> Hentikan musik tapi bot tetap di voice
  // ==================================================
  if (content === '!stop') {
    player.stop();
    return message.reply('Musik dihentikan.');
  }

  // ==================================================
  // !leave -> Bot keluar dari voice channel
  // ==================================================
  if (content === '!leave') {
    const connection = getVoiceConnection(message.guild.id);

    if (!connection) {
      return message.reply('Bot tidak sedang berada di voice channel.');
    }

    player.stop();
    connection.destroy();

    return message.reply('Bot keluar dari voice channel.');
  }

  // ==================================================
  // !ping -> Tes apakah bot aktif
  // ==================================================
  if (content === '!ping') {
    return message.reply('Pong! Bot aktif.');
  }
});

// Login ke Discord
client.login(TOKEN);
