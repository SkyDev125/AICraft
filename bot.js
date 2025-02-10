const { GoogleGenerativeAI } = require("@google/generative-ai");
const mineflayer = require('mineflayer');
const fs = require('fs');
const commands = require('./commands');

const maxRetries = 5;
const initialRetryTime = 1000;

let bot;
let connected = false;

// Load Google API credentials
const credentials = JSON.parse(fs.readFileSync('credentials.json'));

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(credentials.api_key);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-thinking-exp',
  systemInstruction: `You are a Minecraft player. Act like a real player and keep your messages short and to the point. You have commands, Use them as much as you want, there's no limit to how many you can use. just be sure to be creative with them, no worries about command limits on responses. If you don't know something, look it up. Remember, Minecraft chat messages are limited to 256 characters.\n\nAvailable commands:\n${Object.keys(commands).map(cmd => `!${cmd} ${commands[cmd].args.map(arg => `<${arg.name}>`).join(' ')} - ${commands[cmd].description}`).join('\n')}`
});

console.log(model.systemInstruction);

let chatSession;

async function startChatSession() {
  chatSession = await model.startChat();
}

async function getGeminiResponse(message) {
  let prompt = `${message}`;
  if (connected) {
    const { x, y, z } = bot.entity.position;
    const positionMessage = `Current position: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`;
    prompt += `\n${positionMessage}`;
  }
  let attempts = 0;
  let waitTime = initialRetryTime;
  while (attempts < maxRetries) {
    try {
      const result = await chatSession.sendMessage(prompt);
      return result.response.text();
    } catch (error) {
      if (error.message.includes('Service Unavailable')) {
        console.log(`Service unavailable, retrying in ${waitTime / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        attempts++;
        waitTime *= 2;
      } else {
        throw error;
      }
    }
  }
  throw new Error('Service unavailable after 5 attempts');
}

async function createBot() {
  await startChatSession();

  // Get bot name
  const reply = await getGeminiResponse("SYSTEM: What's your name? be creative. reply using the following format !name <name>");
  const name = reply.match(/!name (.*)/)[1];

  bot = mineflayer.createBot({
    host: '192.168.1.77', // Minecraft server IP
    port: 25565,      // Minecraft server port
    username: name,  // Minecraft bot username
    version: '1.21.4'
  });
  console.log(`Bot version: ${bot.version}`);

  bot.on('login', async () => {
    console.log('Bot has logged in');
    connected = true;
  });

  bot.on('error', (err) => {
    console.error('Error:', err);
  });

  bot.on('end', () => {
    console.log('Bot has disconnected');
    connected = false;
  });

  bot.on('kicked', (reason) => {
    console.log('Bot was kicked:', reason);
    connected = false;
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

    // Split the response into multiple commands if they exist
    const commandsList = response.split('!');

    for (let i = 1; i < commandsList.length; i++) {
      const cmd = commandsList[i].trim();
      const args = cmd.split(' ');
      const command = args.shift();
      if (commands[command]) {
        const expectedArgs = commands[command].args.length;
        const commandArgs = args.slice(0, expectedArgs);
        await commands[command].execute(bot, commandArgs);
        console.log(`${name}: !${command} ${commandArgs.join(' ') || ''}`);
      }
    }

    bot.chat(response);
  });
}

createBot();