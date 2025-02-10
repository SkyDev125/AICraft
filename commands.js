const EventEmitter = require('events');
const Vec3 = require('vec3');
const runningCommands = new Set();
const commandEmitter = new EventEmitter();
const Item = require('prismarine-item')('1.21.4')
const { pathfinder, Movements, goals: { GoalNear } } = require('mineflayer-pathfinder')

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
        description: 'Makes the bot move to specified coordinates (x, y, z).',
        args: [{ name: 'x', type: 'number' }, { name: 'y', type: 'number' }, { name: 'z', type: 'number' }],
        execute: (bot, args) => {
            if (bot && args.length === 3) {
                const [x, y, z] = args.map(parseFloat);
                if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                    runningCommands.add('move');
                    const defaultMove = new Movements(bot);
                    bot.pathfinder.setMovements(defaultMove);
                    bot.pathfinder.setGoal(new GoalNear(x, y, z, 1));
                    bot.once('goal_reached', () => {
                        runningCommands.delete('move');
                        if (runningCommands.size === 0) {
                            commandEmitter.emit('empty');
                        }
                    });
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
    },
    place: {
        description: 'Places a block at the specified coordinates.',
        args: [{ name: 'x', type: 'number' }, { name: 'y', type: 'number' }, { name: 'z', type: 'number' }, { name: 'block', type: 'string' }],
        execute: async (bot, args) => {
            if (bot && args.length === 4) {
                const [x, y, z, blockName] = args;
                const block = bot.registry.itemsByName[blockName];
                if (block) {
                    const position = new Vec3(parseFloat(x), parseFloat(y), parseFloat(z));
                    const referenceBlock = bot.blockAt(position);
                    const faceVectorTop = new Vec3(0, 1, 0);
                    const item = new Item(block.id, 1);
                    await bot.creative.setInventorySlot(36, item);
                    await bot.placeBlock(referenceBlock, faceVectorTop, { timeout: 100 }).catch((error) => {
                        console.log(`Error placing block: ${error.message}`);
                    });
                } else {
                    console.log(`Block ${blockName} not found`);
                }
            }
        }
    },
    break: {
        description: 'Breaks a block at the specified coordinates.',
        args: [{ name: 'x', type: 'number' }, { name: 'y', type: 'number' }, { name: 'z', type: 'number' }],
        execute: async (bot, args) => {
            if (bot && args.length === 3) {
                const [x, y, z] = args;
                const position = new Vec3(parseFloat(x), parseFloat(y), parseFloat(z));
                const targetBlock = bot.blockAt(position);
                if (targetBlock) {
                    runningCommands.add('break');
                    try {
                        await bot.dig(targetBlock);
                    } catch (error) { }
                    runningCommands.delete('break');
                    if (runningCommands.size === 0) {
                        commandEmitter.emit('empty');
                    }
                } else {
                    console.log(`No block found at (${x}, ${y}, ${z})`);
                }
            }
        }
    }
};

module.exports = commands;