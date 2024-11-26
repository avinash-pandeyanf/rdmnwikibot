const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    console.error('ERROR: TELEGRAM_BOT_TOKEN is not set');
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
const bot = new TelegramBot(token);

// Handler for incoming messages
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
                            const keyboard = {
                                inline_keyboard: [
                                    [
                                        { text: '🔄 New Article', callback_data: 'random' },
                                        { text: '🔍 Read More', url: articleUrl }
                                    ]
                                ]
                            };

                            await bot.sendMessage(
                                chatId,
                                `📖 *${randomArticleTitle}*\n\n${summary}\n\n[Read full article](${articleUrl})`,
                                {
                                    parse_mode: 'Markdown',
                                    reply_markup: keyboard,
                                    disable_web_page_preview: false
                                }
                            );
                        } else {
                            throw new Error('Could not fetch article summary');
                        }
                    } else {
                        throw new Error('Could not fetch random article');
                    }
                } catch (error) {
                    await handleError(chatId, error, '❌ Error fetching random article. Please try again.');
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
                        await handleError(chatId, error, '❌ Featured articles are only available in English. Please use /setlang en to switch to English.');
                    } else {
                        await handleError(chatId, error, '❌ Error fetching today\'s featured article. Please try again later.');
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
        await handleError(msg.chat.id, error);
    }
}

// Error handler function
async function handleError(chatId, error, customMessage = null) {
    console.error('Error:', error);
    const message = customMessage || '❌ An error occurred. Please try again later.';
    await bot.sendMessage(chatId, message).catch(console.error);
}

// Wikipedia API functions
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
        await handleError(chatId, error, '❌ Error searching Wikipedia. Please try again later.');
    }
}

// Handle inline queries
async function handleInlineQuery(inlineQuery) {
    const query = inlineQuery.query;
    const id = inlineQuery.id;

    if (!query) {
        return await bot.answerInlineQuery(id, [{
            type: 'article',
            id: 'help',
            title: 'Search Wikipedia',
            description: 'Type something to search Wikipedia',
            input_message_content: {
                message_text: 'Please type something after @your_bot_name to search Wikipedia'
            }
        }]);
    }

    try {
        const response = await axios.get(`https://${defaultLang}.wikipedia.org/w/api.php`, {
            params: {
                action: 'query',
                format: 'json',
                list: 'search',
                srsearch: query,
                srlimit: 5,
                srprop: 'snippet'
            }
        });

        const results = response.data.query.search.map((result, index) => ({
            type: 'article',
            id: String(index),
            title: result.title,
            description: result.snippet.replace(/<\/?[^>]+(>|$)/g, ''),
            input_message_content: {
                message_text: `📚 *${result.title}*\n\n${result.snippet.replace(/<\/?[^>]+(>|$)/g, '')}\n\n🔗 https://${defaultLang}.wikipedia.org/wiki/${encodeURIComponent(result.title)}`,
                parse_mode: 'Markdown'
            },
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: '🔍 Read More',
                        url: `https://${defaultLang}.wikipedia.org/wiki/${encodeURIComponent(result.title)}`
                    }
                ]]
            }
        }));

        await bot.answerInlineQuery(id, results);
    } catch (error) {
        console.error('Inline query error:', error);
        await bot.answerInlineQuery(id, [{
            type: 'article',
            id: 'error',
            title: 'Error',
            description: 'Could not perform search. Please try again.',
            input_message_content: {
                message_text: '❌ Search failed. Please try again.'
            }
        }]);
    }
}

// Handle callback queries
async function handleCallbackQuery(callbackQuery) {
    try {
        const data = callbackQuery.data;
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;

        if (data.startsWith('random')) {
            await bot.answerCallbackQuery(callbackQuery.id, { text: 'Fetching new article...' });
            const randomArticleTitle = await getRandomWikipediaArticle();
            if (randomArticleTitle) {
                const summary = await getWikipediaSummary(randomArticleTitle);
                const articleUrl = `https://${defaultLang}.wikipedia.org/wiki/${encodeURIComponent(randomArticleTitle)}`;
                
                const keyboard = {
                    inline_keyboard: [
                        [
                            { text: '🔄 New Article', callback_data: 'random' },
                            { text: '🔍 Read More', url: articleUrl }
                        ]
                    ]
                };

                await bot.editMessageText(
                    `📖 *${randomArticleTitle}*\n\n${summary}\n\n[Read full article](${articleUrl})`,
                    {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown',
                        reply_markup: keyboard,
                        disable_web_page_preview: false
                    }
                );
            }
        }
    } catch (error) {
        console.error('Callback query error:', error);
        await bot.answerCallbackQuery(callbackQuery.id, {
            text: '❌ An error occurred. Please try again.',
            show_alert: true
        });
    }
}

// Export the serverless function
module.exports = async (req, res) => {
    try {
        if (req.method === 'POST') {
            const { body } = req;
            
            // Handle inline queries
            if (body.inline_query) {
                await handleInlineQuery(body.inline_query);
                return res.status(200).json({ ok: true });
            }
            
            // Handle regular messages
            if (body.message) {
                await handleMessage(body.message);
                return res.status(200).json({ ok: true });
            }

            // Handle callback queries (for buttons)
            if (body.callback_query) {
                await handleCallbackQuery(body.callback_query);
                return res.status(200).json({ ok: true });
            }
        }
        
        return res.status(200).json({ status: 'Bot is running' });
    } catch (error) {
        console.error('Error in webhook handler:', error);
        return res.status(500).json({ error: 'Failed to process update' });
    }
};
