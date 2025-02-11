const { GoogleGenerativeAI } = require("@google/generative-ai");
const mineflayer = require('mineflayer');
const fs = require('fs');
const commands = require('./commands');
const { pathfinder } = require('mineflayer-pathfinder');

const maxRetries = 5;
const initialRetryTime = 1000;

let bot;
let connected = false;

// Load Google API credentials and available commands
const credentials = JSON.parse(fs.readFileSync('credentials.json'));
const availableCommandsText = Object.keys(commands)
  .map(cmd => {
    const argsText = commands[cmd].args.map(arg => `<${arg.name}>`).join(' ');
    return `• !${cmd} ${argsText} – ${commands[cmd].description}`;
  })
  .join('\n');

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(credentials.api_key);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-thinking-exp',
  systemInstruction: `
You are a Minecraft AI agent. Respond ONLY using a strict JSON format with exactly two keys: "conversation" and "commands". Follow these guidelines:

1. **Output Structure**  
   Your response MUST be a valid JSON object formatted as:
   {
     "conversation": "<short, clear message for the player (max 256 chars per line)>",
     "commands": [
         { "name": "<commandName>", "args": [arg1, arg2, ...] }
     ]
   }
   • If no commands are needed, "commands" should be an empty array.

2. **Available Commands**  
   You can only use the following commands (and no others):
${availableCommandsText}

3. **Gameplay & Safety Rules**  
   • Ensure block placement and breaking is safe: stay within 5 blocks but no closer than 1 block to any target.
   • Keep conversation messages concise, realistic, and helpful.
   • If uncertain or if an error occurs, explain briefly in "conversation" and output an empty "commands" array.
   • If parameters might lead to unsafe actions, output a "wait" command instead.

4. **Contextual Awareness**  
   • Use dynamic context (e.g., current position, obstacles, inventory) when making decisions.

5. **Examples**  
   Example response when moving:
   {
     "conversation": "Heading to the quarry.",
     "commands": [
         { "name": "move", "args": [100, 64, 100] }
     ]
   }
   Example response when no immediate action is needed:
   {
     "conversation": "All clear for now.",
     "commands": []
   }

Follow these rules exactly. Do not include any extra keys or formatting. Think carefully before deciding which command(s) to execute and ensure that every action is safe and efficient.
`
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
      return result.response.text().replace(/^```json\s*/, '').replace(/\s*```$/, '');
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

  bot = mineflayer.createBot({
    host: '192.168.1.77', // Minecraft server IP
    port: 25565,      // Minecraft server port
    username: "Jim",  // Minecraft bot username
    version: '1.21.4'
  });
  console.log(`Bot version: ${bot.version}`);

  bot.loadPlugin(pathfinder);

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
    if (username === bot.username) return;

    const response = await getGeminiResponse(`${username}: ${message}`);
    const parsedResponse = JSON.parse(response);
    bot.chat(parsedResponse.conversation);

    for (const command of parsedResponse.commands) {
      if (commands[command.name]) {
        await commands[command.name].execute(bot, command.args);
        console.log(`${bot.username}: !${command.name} ${command.args.join(' ') || ''}`);
      }
    }
  });
}

createBot();