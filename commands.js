const commands = {
    jump: {
        description: 'Makes the bot jump for 1 second.',
        args: [],
        execute: (bot) => {
            if (bot) {
                bot.setControlState('jump', true);
                setTimeout(() => bot.setControlState('jump', false), 1000); // Jump for 1 second
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
                    const duration = (distance / speed) * 1000; // convert to milliseconds
                    bot.setControlState('forward', true);
                    setTimeout(() => bot.setControlState('forward', false), duration);
                }
            }
        }
    }
};

module.exports = commands;