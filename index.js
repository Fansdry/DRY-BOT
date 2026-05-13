const { Client, GatewayIntentBits } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection
} = require('@discordjs/voice');
const play = require('play-dl');

const TOKEN = 'MTUwMzk3NTQwNDk1MDc4MjA4Mw.GgmjXb.RkJb6T22_-wFY6R4bw91odpfDE_tduSKu_eidM';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const player = createAudioPlayer();

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // !play <url>
  if (message.content.startsWith('!play ')) {
    try {
      const url = message.content.split(' ')[1];
      const voiceChannel = message.member.voice.channel;

      if (!voiceChannel) {
        return message.reply('Masuk ke voice channel dulu dongok banget sih.');
      }

      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator
      });

      const stream = await play.stream(url);
      const resource = createAudioResource(stream.stream, {
        inputType: stream.type
      });

      player.play(resource);
      connection.subscribe(player);

      message.reply('Sedang memutar musik.');
    } catch (error) {
      console.error(error);
      message.reply('Gagal memutar musik.');
    }
  }

  // !stop
  if (message.content === '!stop') {
    player.stop();
    message.reply('Musik dihentikan.');
  }

  // !leave
  if (message.content === '!leave') {
    const connection = getVoiceConnection(message.guild.id);

    if (!connection) {
      return message.reply('Bot tidak sedang berada di voice channel.');
    }

    player.stop();
    connection.destroy();

    message.reply('Bot keluar dari voice channel.');
  }
});

client.login(TOKEN);