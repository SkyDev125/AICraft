const EventEmitter = require('events');
const runningCommands = new Set();
const commandEmitter = new EventEmitter();

const commands = {
    jump: {
        description: 'Makes the bot perform a single jump.',
        args: [],
        execute: (bot) => {
            if (bot) {
                runningCommands.add('jump');
                bot.setControlState('jump', true);
                setTimeout(() => {
                    bot.setControlState('jump', false);
                    runningCommands.delete('jump');
                    if (runningCommands.size === 0) {
                        commandEmitter.emit('empty');
                    }
                }, 100); // Single jump
            }
        }
    },
    move: {
        description: 'Makes the bot move forward for a specified distance in blocks.',
        args: [{ name: 'distance', type: 'number' }],
        execute: (bot, args) => {
            if (bot && args.length > 0) {
                const distance = parseFloat(args[0]);
                const speed = 4.317; // blocks per second (default walking speed)
                if (!isNaN(distance)) {
                    runningCommands.add('move');
                    const duration = (distance / speed) * 1000; // convert to milliseconds
                    bot.setControlState('forward', true);
                    setTimeout(() => {
                        bot.setControlState('forward', false);
                        runningCommands.delete('move');
                        if (runningCommands.size === 0) {
                            commandEmitter.emit('empty');
                        }
                    }, duration);
                }
            }
        }
    },
    wait: {
        description: 'Waits for the current command or commands to finish.',
        args: [],
        execute: (bot) => {
            if (bot) {
                return new Promise((resolve) => {
                    if (runningCommands.size === 0) {
                        resolve();
                    } else {
                        commandEmitter.once('empty', resolve);
                    }
                });
            }
        }
    }
};

module.exports = commands;