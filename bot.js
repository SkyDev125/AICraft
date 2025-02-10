const { GoogleGenerativeAI } = require("@google/generative-ai");
const mineflayer = require('mineflayer');
const fs = require('fs');

const bot = mineflayer.createBot({
  host: '192.168.1.77', // Minecraft server IP
  port: 25565,      // Minecraft server port
  username: 'Bot',  // Minecraft bot username
});

// Load Google API credentials
const credentials = JSON.parse(fs.readFileSync('credentials.json'));

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(credentials.api_key);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-thinking-exp' });

let chatSession;

async function startChatSession() {
  chatSession = await model.startChat();
}

async function getGeminiResponse(message) {
  const result = await chatSession.sendMessage(message);
  return result.response.text();
}

bot.on('login', async () => {
  console.log('Bot has logged in');
  await startChatSession();
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

bot.on('spawn', () => {
  console.log('Bot has spawned');
});

bot.on('chat', async (username, message) => {
  console.log(`${username}: ${message}`);
  if (username !== bot.username) {
    const response = await getGeminiResponse(message);
    console.log(`Gemini: ${response}`);
    bot.chat(response);
  }
});