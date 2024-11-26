const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    console.error('ERROR: TELEGRAM_BOT_TOKEN is not set in .env file');
    process.exit(1);
}

// Create bot instance
const url = process.env.VERCEL_URL || 'https://your-domain.vercel.app';
const bot = new TelegramBot(token);

// Set webhook on first request
let webhookSet = false;

// Export the serverless function
module.exports = async (req, res) => {
    try {
        // Set webhook only once
        if (!webhookSet) {
            try {
                const webhookUrl = `${url}/api/webhook`;
                await bot.setWebHook(`${webhookUrl}`);
                webhookSet = true;
                console.log('Webhook set to:', webhookUrl);
            } catch (error) {
                console.error('Error setting webhook:', error);
            }
        }

        // Handle incoming updates
        if (req.method === 'POST') {
            const { body } = req;
            if (body.message) {
                await handleMessage(body.message);
            }
            return res.status(200).json({ ok: true });
        }

        // Response for GET requests
        return res.status(200).json({ status: 'Bot is running' });
    } catch (error) {
        console.error('Error in webhook handler:', error);
        return res.status(500).json({ error: 'Failed to process update' });
    }
};
