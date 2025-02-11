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
                bot.setControlState('jump', true);
                bot.setControlState('jump', false);
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
                    bot.pathfinder.setGoal(new GoalNear(x, y, z, 2));
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
        description: 'Places a block, placeable or usable items at the specified coordinates.',
        args: [{ name: 'x', type: 'number' }, { name: 'y', type: 'number' }, { name: 'z', type: 'number' }, { name: 'block', type: 'string' }],
        execute: async (bot, args) => {
            if (bot && args.length === 4) {
                const [x, y, z, blockName] = args;
                const block = bot.registry.itemsByName[blockName];
                if (block) {
                    const position = new Vec3(parseInt(x), parseInt(y), parseInt(z));
                    const referenceBlock = bot.blockAt(position);
                    const faceVectorTop = new Vec3(0, 1, 0);
                    const item = new Item(block.id, 1);
                    await bot.creative.setInventorySlot(36, item);
                    await bot.placeBlock(referenceBlock, faceVectorTop).catch((error) => {
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
                const position = new Vec3(parseInt(x), parseInt(y), parseInt(z));
                const targetBlock = bot.blockAt(position);
                if (targetBlock) {
                    await bot.dig(targetBlock).catch((error) => {
                        console.log(`Error breaking block: ${error.message}`);
                    });
                } else {
                    console.log(`No block found at (${x}, ${y}, ${z})`);
                }
            }
        }
    },
    drop: {
        description: 'Drops an item from the bot\'s inventory.',
        args: [{ name: 'item', type: 'string' }, { name: 'quantity', type: 'number' }],
        execute: async (bot, args) => {
            if (bot && args.length === 2) {
                const [itemName, quantity] = args;
                const item = bot.inventory.items().find(i => i.name === itemName);
                if (item) {
                    try {
                        await bot.toss(item.type, null, quantity);
                    } catch (error) {
                        console.log(`Error dropping item: ${error.message}`);
                    }
                } else {
                    console.log(`Item ${itemName} not found in inventory`);
                }
            }
        }
    },
    follow: {
        description: 'Follows a player with the specified name.',
        args: [{ name: 'playerName', type: 'string' }],
        execute: (bot, args) => {
            if (bot && args.length === 1) {
                const [playerName] = args;
                let player = bot.players[playerName];
                if (player && player.entity) {
                    runningCommands.add('follow');
                    const defaultMove = new Movements(bot);
                    bot.pathfinder.setMovements(defaultMove);
                    const followPlayer = () => {
                        if (player && player.entity && runningCommands.has('follow')) {
                            bot.pathfinder.setGoal(new GoalNear(player.entity.position.x, player.entity.position.y, player.entity.position.z, 3));
                            setTimeout(followPlayer, 1000); // Update location every second
                        }
                    };
                    followPlayer();
                } else {
                    console.log(`Player ${playerName} not found`);
                }
            }
        }
    },
    unfollow: {
        description: 'Stops following the current player.',
        args: [],
        execute: (bot) => {
            if (bot) {
                runningCommands.delete('follow');
                bot.pathfinder.setGoal(null);
                console.log('Stopped following the player.');
            }
        }
    }
};

module.exports = commands;