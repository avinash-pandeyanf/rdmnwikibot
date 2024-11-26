const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    console.error('ERROR: TELEGRAM_BOT_TOKEN is not set in .env file');
    process.exit(1);
}

// Default language for articles
let defaultLang = 'en';

// Language codes mapping
const languageCodes = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese'
};

// Command list for help message
const commands = {
    '/start': 'Get started with the bot',
    '/help': 'Show available commands',
    '/randomwiki': 'Get a random Wikipedia article',
    '/search': 'Search Wikipedia articles (usage: /search your search term)',
    '/setlang': 'Set Wikipedia language (usage: /setlang es for Spanish)',
    '/today': 'Get featured article of the day'
};

// Create bot instance
const url = process.env.VERCEL_URL || 'https://your-domain.vercel.app';
const bot = new TelegramBot(token, {
    webHook: {
        port: process.env.PORT
    }
});

// Webhook endpoint for Vercel
module.exports = async (req, res) => {
    try {
        if (req.method === 'POST') {
            const { body } = req;
            if (body.message) {
                await handleMessage(body.message);
            }
            res.status(200).json({ ok: true });
        } else {
            // Set webhook
            if (req.method === 'GET') {
                try {
                    const webhookUrl = `${url}/api/webhook`;
                    await bot.setWebHook(`${webhookUrl}`);
                    res.status(200).json({ message: 'Webhook set successfully' });
                } catch (error) {
                    console.error('Error setting webhook:', error);
                    res.status(500).json({ error: 'Failed to set webhook' });
                }
            }
        }
    } catch (error) {
        console.error('Error in webhook handler:', error);
        res.status(500).json({ error: 'Failed to process update' });
    }
};

// Message handler
async function handleMessage(msg) {
    try {
        const chatId = msg.chat.id;
        const message = msg.text;

        if (!message) return;

        console.log('Received message:', message);

        // Handle commands
        if (message.startsWith('/search ')) {
            const searchTerm = message.slice(8).trim();
            if (searchTerm) {
                await searchWikipedia(chatId, searchTerm);
            } else {
                await bot.sendMessage(chatId, '❌ Please provide a search term. Example: /search Albert Einstein');
            }
            return;
        }

        if (message.startsWith('/setlang ')) {
            const langCode = message.slice(9).toLowerCase().trim();
            if (languageCodes[langCode]) {
                defaultLang = langCode;
                await bot.sendMessage(chatId, `✅ Language set to ${languageCodes[langCode]}`);
            } else {
                const availableLangs = Object.entries(languageCodes)
                    .map(([code, name]) => `${code} - ${name}`)
                    .join('\n');
                await bot.sendMessage(chatId, `❌ Invalid language code. Available languages:\n${availableLangs}`);
            }
            return;
        }

        switch (message) {
            case '/start':
                const welcomeMessage = 'Welcome to RandomWiki Bot! 📚\n\n' +
                    'I can help you discover interesting Wikipedia articles and search for specific topics.\n\n' +
                    'Use /help to see all available commands.';
                await bot.sendMessage(chatId, welcomeMessage);
                break;

            case '/help':
                const helpMessage = Object.entries(commands)
                    .map(([cmd, desc]) => `${cmd} - ${desc}`)
                    .join('\n');
                await bot.sendMessage(chatId, `Available commands:\n${helpMessage}`);
                break;

            case '/randomwiki':
                try {
                    await bot.sendMessage(chatId, '🔄 Fetching random article...');
                    const randomArticleTitle = await getRandomWikipediaArticle();
                    if (randomArticleTitle) {
                        const summary = await getWikipediaSummary(randomArticleTitle);
                        const articleUrl = `https://${defaultLang}.wikipedia.org/wiki/${encodeURIComponent(randomArticleTitle)}`;
                        if (summary) {
                            await bot.sendMessage(chatId, 
                                `📖 Random Wikipedia Article:\n\nTitle: ${randomArticleTitle}\n\n${summary}\n\n` +
                                `🔗 Read more: ${articleUrl}\n\nWant another article? Just type /randomwiki again!`,
                                { disable_web_page_preview: false }
                            );
                        } else {
                            throw new Error('Could not fetch article summary');
                        }
                    } else {
                        throw new Error('Could not fetch random article');
                    }
                } catch (error) {
                    handleError(chatId, error, '❌ Error fetching random article. Please try again.');
                }
                break;

            case '/today':
                try {
                    await bot.sendMessage(chatId, '🔄 Fetching today\'s featured article...');
                    const date = new Date();
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    
                    const response = await axios.get(
                        `https://${defaultLang}.wikipedia.org/api/rest_v1/feed/featured/${year}/${month}/${day}`,
                        { timeout: 10000 }
                    );
                    
                    if (response.data && response.data.tfa) {
                        const article = response.data.tfa;
                        const title = article.title;
                        const extract = article.extract;
                        const thumbnail = article.thumbnail?.source;
                        const url = `https://${defaultLang}.wikipedia.org/wiki/${encodeURIComponent(title)}`;

                        let message = `📌 Today's Featured Article (${year}-${month}-${day}):\n\n`;
                        message += `<b>${title}</b>\n\n`;
                        message += `${extract}\n\n`;
                        message += `🔗 <a href="${url}">Read full article</a>`;

                        if (thumbnail) {
                            await bot.sendPhoto(chatId, thumbnail, {
                                caption: message,
                                parse_mode: 'HTML'
                            });
                        } else {
                            await bot.sendMessage(chatId, message, {
                                parse_mode: 'HTML',
                                disable_web_page_preview: false
                            });
                        }
                    } else {
                        throw new Error('No featured article available');
                    }
                } catch (error) {
                    if (defaultLang !== 'en') {
                        handleError(chatId, error, '❌ Featured articles are only available in English. Please use /setlang en to switch to English.');
                    } else {
                        handleError(chatId, error, '❌ Error fetching today\'s featured article. Please try again later.');
                    }
                }
                break;

            default:
                // Only respond to unknown commands that start with /
                if (message.startsWith('/')) {
                    await bot.sendMessage(chatId, '❌ Unknown command. Use /help to see available commands.');
                }
        }
    } catch (error) {
        handleError(msg.chat.id, error);
    }
}

// Error handler function
async function handleError(chatId, error, customMessage = null) {
    console.error('Error:', error);
    const message = customMessage || '❌ An error occurred. Please try again later.';
    await bot.sendMessage(chatId, message).catch(console.error);
}

/**
 * Fetches a random article title from Wikipedia
 * @returns {Promise<string|null>} The title of a random Wikipedia article
 */
async function getRandomWikipediaArticle() {
    try {
        const response = await axios.get(`https://${defaultLang}.wikipedia.org/w/api.php`, {
            params: {
                action: 'query',
                format: 'json',
                list: 'random',
                rnnamespace: 0,
                rnlimit: 1,
            },
            timeout: 10000
        });

        return response.data.query.random[0].title;
    } catch (error) {
        console.error('Error fetching random article:', error.message);
        return null;
    }
}

/**
 * Fetches the summary of a Wikipedia article
 * @param {string} articleTitle - The title of the Wikipedia article
 * @returns {Promise<string|null>} The article summary
 */
async function getWikipediaSummary(articleTitle) {
    try {
        const response = await axios.get(`https://${defaultLang}.wikipedia.org/w/api.php`, {
            params: {
                action: 'query',
                format: 'json',
                prop: 'extracts',
                exintro: true,
                explaintext: true,
                titles: articleTitle,
            },
            timeout: 10000
        });

        const pages = response.data.query.pages;
        const pageId = Object.keys(pages)[0];
        return pages[pageId].extract;
    } catch (error) {
        console.error('Error fetching article summary:', error.message);
        return null;
    }
}

/**
 * Search Wikipedia articles
 * @param {number} chatId - Telegram chat ID
 * @param {string} searchTerm - Search term
 */
async function searchWikipedia(chatId, searchTerm) {
    try {
        await bot.sendMessage(chatId, '🔍 Searching...');
        const response = await axios.get(`https://${defaultLang}.wikipedia.org/w/api.php`, {
            params: {
                action: 'query',
                format: 'json',
                list: 'search',
                srsearch: searchTerm,
                srlimit: 5,
                srprop: 'snippet',
            },
            timeout: 10000
        });

        const results = response.data.query.search;
        if (results.length === 0) {
            await bot.sendMessage(chatId, '❌ No results found. Try a different search term.');
            return;
        }

        let message = `🔍 Search results for "${searchTerm}":\n\n`;
        for (const result of results) {
            const title = result.title;
            const snippet = result.snippet.replace(/<\/?[^>]+(>|$)/g, '');
            const url = `https://${defaultLang}.wikipedia.org/wiki/${encodeURIComponent(title)}`;
            message += `📑 *${title}*\n${snippet}\n🔗 ${url}\n\n`;
        }

        await bot.sendMessage(chatId, message, { 
            parse_mode: 'Markdown',
            disable_web_page_preview: true 
        });
    } catch (error) {
        handleError(chatId, error, '❌ Error searching Wikipedia. Please try again later.');
    }
}
