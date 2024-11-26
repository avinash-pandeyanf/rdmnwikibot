# Random Wikipedia Bot

A Telegram bot that helps users discover and search Wikipedia articles. Features interactive buttons, inline search, and multi-language support.

## Features

- 🔄 Get random Wikipedia articles with interactive refresh button
- 🔍 Search Wikipedia articles with inline mode
- 📌 Get today's featured article with images
- 🌍 Multi-language support (EN, ES, FR, DE, IT, PT, RU, JA)
- 📱 Interactive buttons for better navigation
- 💬 Inline mode for sharing articles in chats

## Commands

- `/start` - Get started with the bot
- `/help` - Show available commands
- `/randomwiki` - Get a random Wikipedia article
- `/search <term>` - Search Wikipedia articles
- `/setlang <code>` - Set Wikipedia language (e.g., /setlang es for Spanish)
- `/today` - Get featured article of the day (English only)

## Inline Mode

You can use the bot in any chat by typing:
```
@your_bot_name search term
```
This will show a list of articles that you can share directly.

## Language Support

Change language using `/setlang` with these codes:
- 🇺🇸 en - English
- 🇪🇸 es - Spanish
- 🇫🇷 fr - French
- 🇩🇪 de - German
- 🇮🇹 it - Italian
- 🇵🇹 pt - Portuguese
- 🇷🇺 ru - Russian
- 🇯🇵 ja - Japanese

## Getting Started

### Telegram Bot Token
1. Talk to [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow instructions
3. Copy the API token he gives you
4. Enable inline mode by sending `/setinline` to BotFather

### Wikipedia API
- No authentication needed
- Free to use
- Has rate limits (make sure to not spam requests)

## Setup

1. Create a `.env` file with your bot token:
```
TELEGRAM_BOT_TOKEN=your_token_here
```

2. Install dependencies:
```
npm install
```

3. Deploy to Vercel:
   - Connect your GitHub repository
   - Add `TELEGRAM_BOT_TOKEN` to environment variables
   - Deploy the project

4. Set webhook:
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_VERCEL_URL>/api/webhook
```

## Features Coming Soon

- 📊 Article statistics and trends
- 🔖 Bookmark favorite articles
- 📖 Article summaries with AI
- 📱 Rich media previews
- 🎯 Personalized recommendations
