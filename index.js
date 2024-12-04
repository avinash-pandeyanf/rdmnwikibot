// Cache for frequently accessed articles
const articleCache = new Map();
const CACHE_EXPIRY = 3600000; // 1 hour in milliseconds

// User reading history storage
const userHistory = new Map();
const MAX_HISTORY_ITEMS = 50;

// Shared articles storage
const sharedArticles = new Map();

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
    '/today': 'Get featured article of the day',
    '/history': 'View your reading history',
    '/share': 'Share an article (usage: /share Article_Title)',
    '/shared': 'View articles shared with you',
    '/trending': 'View most read articles'
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

// Keyboard layouts
const mainKeyboard = {
    reply_markup: {
        keyboard: [
            ['🎲 Random Article', '🔍 Search'],
            ['📈 Trending', '📚 History'],
            ['🌍 Change Language', '❓ Help']
        ],
        resize_keyboard: true
    }
};

const languageKeyboard = {
    reply_markup: {
        inline_keyboard: [
            [
                { text: '🇬🇧 English', callback_data: 'lang_en' },
                { text: '🇪🇸 Spanish', callback_data: 'lang_es' }
            ],
            [
                { text: '🇫🇷 French', callback_data: 'lang_fr' },
                { text: '🇩🇪 German', callback_data: 'lang_de' }
            ],
            [
                { text: '🇮🇹 Italian', callback_data: 'lang_it' },
                { text: '🇷🇺 Russian', callback_data: 'lang_ru' }
            ]
        ]
    }
};

// Enhanced message formatting
const formatArticle = (title, summary, url) => {
    return `📖 *${title}*\n\n${summary}\n\n` +
           `🔗 [Read full article](${url})\n\n` +
           `Share this article: /share ${title}`;
};

const formatTrendingArticle = (article, index) => {
    const views = article.views.toLocaleString();
    const emoji = index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📊';
    return `${emoji} *${article.title}*\n└ ${views} views`;
};

// Message handler
async function handleMessage(msg) {
    try {
        const chatId = msg.chat.id;
        const message = msg.text;

        if (!message) return;

        console.log('Received message:', message);

        // Handle text button presses
        switch (message) {
            case '🎲 Random Article':
                message = '/randomwiki';
                break;
            case '🔍 Search':
                await bot.sendMessage(chatId, 
                    '🔎 *How to search:*\nUse `/search` followed by your search term.\n\nExample: `/search Albert Einstein`',
                    { parse_mode: 'Markdown' }
                );
                return;
            case '📈 Trending':
                message = '/trending';
                break;
            case '📚 History':
                message = '/history';
                break;
            case '🌍 Change Language':
                await bot.sendMessage(chatId, 
                    '🌍 *Select your preferred language:*',
                    { parse_mode: 'Markdown', ...languageKeyboard }
                );
                return;
            case '❓ Help':
                message = '/help';
                break;
        }

        if (message.startsWith('/start')) {
            const welcomeMessage = 
                '🎉 *Welcome to RandomWiki Bot!*\n\n' +
                'Explore Wikipedia articles with ease:\n\n' +
                '• Get random articles 🎲\n' +
                '• Search for specific topics 🔍\n' +
                '• View trending articles 📈\n' +
                '• Track your reading history 📚\n' +
                '• Share interesting finds 📤\n\n' +
                'Use the keyboard below to get started! 👇';

            await bot.sendMessage(chatId, welcomeMessage, {
                parse_mode: 'Markdown',
                ...mainKeyboard
            });
            return;
        }

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

        if (message.startsWith('/history')) {
            const history = userHistory.get(chatId) || [];
            if (history.length === 0) {
                await bot.sendMessage(chatId, 
                    '📚 Your reading history is empty.\n\nTry getting a random article with 🎲!',
                    { ...mainKeyboard }
                );
                return;
            }
            
            const historyText = history
                .slice(0, 10)
                .map((item, index) => {
                    const date = new Date(item.timestamp).toLocaleDateString();
                    return `${index + 1}. *${item.article}*\n└ Read on: ${date}`;
                })
                .join('\n\n');
                
            await bot.sendMessage(chatId, 
                `📚 *Your Recent Reading History*\n\n${historyText}\n\n_Showing last 10 articles_`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        if (message.startsWith('/share ')) {
            const title = message.slice(7).trim();
            if (title) {
                await shareArticle(chatId, title);
            } else {
                await bot.sendMessage(chatId, '❌ Please provide an article title. Example: /share Albert Einstein');
            }
            return;
        }

        if (message.startsWith('/trending')) {
            await bot.sendMessage(chatId, '🔄 *Fetching trending articles...*', {
                parse_mode: 'Markdown'
            });
            
            const response = await axios.get(
                `https://wikipedia.org/api/rest_v1/page/most-read/${defaultLang.toUpperCase()}`
            );
            
            const articles = response.data.articles
                .slice(0, 5)
                .map((article, index) => formatTrendingArticle(article, index))
                .join('\n\n');
                
            await bot.sendMessage(chatId,
                `📈 *Trending Articles Today*\n\n${articles}`,
                { 
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true
                }
            );
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
                        const summary = await getCachedArticle(randomArticleTitle);
                        if (summary) {
                            addToHistory(chatId, randomArticleTitle);
                            const articleUrl = `https://${defaultLang}.wikipedia.org/wiki/${encodeURIComponent(randomArticleTitle)}`;
                            await bot.sendMessage(chatId, 
                                formatArticle(randomArticleTitle, summary, articleUrl),
                                { 
                                    parse_mode: 'Markdown',
                                    disable_web_page_preview: false,
                                    reply_markup: {
                                        inline_keyboard: [
                                            [
                                                { text: '📤 Share Article', callback_data: `share_${randomArticleTitle}` },
                                                { text: '🎲 Another Random', callback_data: 'random' }
                                            ]
                                        ]
                                    }
                                }
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

// Add to reading history
function addToHistory(userId, article) {
    if (!userHistory.has(userId)) {
        userHistory.set(userId, []);
    }
    const history = userHistory.get(userId);
    history.unshift({ article, timestamp: Date.now() });
    if (history.length > MAX_HISTORY_ITEMS) {
        history.pop();
    }
}

// Get cached article or fetch new
async function getCachedArticle(title) {
    if (articleCache.has(title)) {
        const cached = articleCache.get(title);
        if (Date.now() - cached.timestamp < CACHE_EXPIRY) {
            return cached.data;
        }
        articleCache.delete(title);
    }
    const data = await getWikipediaSummary(title);
    if (data) {
        articleCache.set(title, { data, timestamp: Date.now() });
    }
    return data;
}

// Share article with other users
async function shareArticle(chatId, title) {
    try {
        const article = await getCachedArticle(title);
        if (!article) {
            throw new Error('Article not found');
        }
        
        const shareId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        sharedArticles.set(shareId, {
            title,
            sharedBy: chatId,
            timestamp: Date.now()
        });
        
        const shareLink = `https://t.me/your_bot_username?start=share_${shareId}`;
        await bot.sendMessage(chatId, 
            `📤 Share this article:\n${title}\n\nShare link: ${shareLink}\n\nOthers can access this article by clicking the link or starting the bot and entering the code: ${shareId}`
        );
    } catch (error) {
        await handleError(chatId, error, 'Failed to share article');
    }
}

// View reading history
async function viewHistory(chatId) {
    try {
        const history = userHistory.get(chatId) || [];
        if (history.length === 0) {
            await bot.sendMessage(chatId, '📚 Your reading history is empty');
            return;
        }
        
        const historyText = history
            .slice(0, 10)
            .map((item, index) => {
                const date = new Date(item.timestamp).toLocaleDateString();
                return `${index + 1}. ${item.article} (${date})`;
            })
            .join('\n');
            
        await bot.sendMessage(chatId, 
            `📚 Your Recent Reading History:\n\n${historyText}\n\nShowing last 10 articles.`
        );
    } catch (error) {
        await handleError(chatId, error, 'Failed to retrieve history');
    }
}

// Get trending articles
async function getTrendingArticles(chatId) {
    try {
        const response = await axios.get(
            `https://wikipedia.org/api/rest_v1/page/most-read/${defaultLang.toUpperCase()}`
        );
        
        const articles = response.data.articles
            .slice(0, 5)
            .map((article, index) => `${index + 1}. ${article.title} (${article.views.toLocaleString()} views)`)
            .join('\n');
            
        await bot.sendMessage(chatId,
            `📈 Trending Articles:\n\n${articles}`
        );
    } catch (error) {
        await handleError(chatId, error, 'Failed to fetch trending articles');
    }
}

// Handle callback queries from inline keyboards
bot.on('callback_query', async (query) => {
    try {
        const chatId = query.message.chat.id;
        const data = query.data;

        if (data.startsWith('lang_')) {
            const lang = data.split('_')[1];
            if (languageCodes[lang]) {
                defaultLang = lang;
                await bot.answerCallbackQuery(query.id, {
                    text: `✅ Language set to ${languageCodes[lang]}`
                });
                await bot.sendMessage(chatId, 
                    `🌍 Language changed to *${languageCodes[lang]}*\nTry getting a random article!`,
                    { parse_mode: 'Markdown', ...mainKeyboard }
                );
            }
        } else if (data === 'random') {
            await bot.answerCallbackQuery(query.id);
            const randomArticleTitle = await getRandomWikipediaArticle();
            if (randomArticleTitle) {
                const summary = await getCachedArticle(randomArticleTitle);
                if (summary) {
                    addToHistory(chatId, randomArticleTitle);
                    const articleUrl = `https://${defaultLang}.wikipedia.org/wiki/${encodeURIComponent(randomArticleTitle)}`;
                    await bot.sendMessage(chatId, 
                        formatArticle(randomArticleTitle, summary, articleUrl),
                        { 
                            parse_mode: 'Markdown',
                            disable_web_page_preview: false,
                            reply_markup: {
                                inline_keyboard: [
                                    [
                                        { text: '📤 Share Article', callback_data: `share_${randomArticleTitle}` },
                                        { text: '🎲 Another Random', callback_data: 'random' }
                                    ]
                                ]
                            }
                        }
                    );
                }
            }
        } else if (data.startsWith('share_')) {
            const title = data.substring(6);
            await shareArticle(chatId, title);
            await bot.answerCallbackQuery(query.id, {
                text: '📤 Article shared successfully!'
            });
        }
    } catch (error) {
        console.error('Callback query error:', error);
        await bot.answerCallbackQuery(query.id, {
            text: '❌ An error occurred'
        });
    }
});
