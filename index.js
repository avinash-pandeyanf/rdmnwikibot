const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios'); // Import Axios for making HTTP requests


// Replace 'YOUR_TELEGRAM_BOT_TOKEN' with the token you obtained from BotFather.
const token = '6657021322:AAG2bPiGvQ3_Ivu_zBWqLnv44o5-pklDbOg';

// Create a new Telegram bot instance
const bot = new TelegramBot(token, { polling: true });



// Listen for incoming messages
bot.on('message', async (msg) => {
    console.log('Received message:', msg.text); // Add this line

  const chatId = msg.chat.id;
  const message = msg.text;

  // Handle incoming messages here
  // You can add your custom logic and reply to users.
  if (message === '/randomwiki') {
    // Fetch a random Wikipedia article title
    try {
        const randomArticleTitle = await getRandomWikipediaArticle();
        if (randomArticleTitle) {
            // Now proceed to fetch the summary for this article
            const summary = await getWikipediaSummary(randomArticleTitle);
            if (summary) {
                // Post the summary to the Telegram group
                bot.sendMessage(chatId, `Random Wikipedia article:\n\n${summary}`);
            } else {
                bot.sendMessage(chatId, 'Error fetching article summary.');
            }
        } else {
            bot.sendMessage(chatId, 'Error fetching random article title.');
        }
    } catch (error) {
        console.error('Error:', error.message);
        bot.sendMessage(chatId, 'An error occurred. Please try again later.');
    }
}
});
// Fetch a random Wikipedia article title
async function getRandomWikipediaArticle() {
    try {
        const response = await axios.get('https://en.wikipedia.org/w/api.php', {
            params: {
                action: 'query',
                format: 'json',
                list: 'random',
                rnnamespace: 0,
                rnlimit: 1,
            },
        });

        const randomArticleTitle = response.data.query.random[0].title;
        return randomArticleTitle;
    } catch (error) {
        console.error('Error fetching random article:', error.message);
        return null;
    }
}

// Fetch the summary for a given article title
async function getWikipediaSummary(articleTitle) {
    try {
        const response = await axios.get('https://en.wikipedia.org/w/api.php', {
            params: {
                action: 'query',
                format: 'json',
                prop: 'extracts',
                exintro: true,
                explaintext: true,
                titles: articleTitle,
            },
        });

        const pageId = Object.keys(response.data.query.pages)[0];
        const summary = response.data.query.pages[pageId].extract;
        return summary;
    } catch (error) {
        console.error('Error fetching article summary:', error.message);
        return null;
    }
}