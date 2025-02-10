const { GoogleGenerativeAI } = require("@google/generative-ai");
const mineflayer = require('mineflayer');
const fs = require('fs');
const commands = require('./commands');

let bot;

// Load Google API credentials
const credentials = JSON.parse(fs.readFileSync('credentials.json'));

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(credentials.api_key);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-thinking-exp',
  systemInstruction: `You are a Minecraft player. Act like a real player and keep your messages short and to the point. If you don't know something, look it up. Remember, Minecraft chat messages are limited to 256 characters.\n\nAvailable commands:\n${Object.keys(commands).map(cmd => `!${cmd} ${commands[cmd].args.map(arg => `<${arg.name}>`).join(' ')} - ${commands[cmd].description}`).join('\n')}`
});

console.log(model.systemInstruction);

let chatSession;

async function startChatSession() {
  chatSession = await model.startChat();
}

async function getGeminiResponse(message) {
  const result = await chatSession.sendMessage(message);
  return result.response.text();
}

async function createBot() {
  await startChatSession();

  // Get bot name
  const reply = await getGeminiResponse("SYSTEM: What's your name? reply using the following format !name <name>");
  const name = reply.match(/!name (.*)/)[1];

  bot = mineflayer.createBot({
    host: '192.168.1.77', // Minecraft server IP
    port: 25565,      // Minecraft server port
    username: name,  // Minecraft bot username
  });

  bot.on('login', async () => {
    console.log('Bot has logged in');
  });

  bot.on('error', (err) => {
    console.error('Error:', err);
  });

  bot.on('end', () => {
    console.log('Bot has disconnected');
  });

  bot.on('kicked', (reason) => {
    console.log('Bot was kicked:', reason);
  });

  bot.on('death', () => {
    console.log('Bot has died');
  });

  bot.on('spawn', async () => {
    console.log('Bot has spawned');
  });

  bot.on('chat', async (username, message) => {
    console.log(`${username}: ${message}`);
    if (username === bot.username) {
      return;
    }

    const response = await getGeminiResponse(message);

    if (response.startsWith('!')) {
      const args = response.slice(1).split(' ');
      const command = args.shift();
      if (commands[command]) {
        commands[command].execute(bot, args);
      }
    }

    console.log(`${name}: ${response}`);
    bot.chat(response);
  });
}

createBot();