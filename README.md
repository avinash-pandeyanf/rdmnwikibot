# Random Wikipedia Bot

A Telegram bot that helps users discover and search Wikipedia articles.

## Features

- Get random Wikipedia articles
- Search Wikipedia articles
- Get today's featured article
- Multi-language support (EN, ES, FR, DE, IT, PT, RU, JA)

## Commands

- `/start` - Get started with the bot
- `/help` - Show available commands
- `/randomwiki` - Get a random Wikipedia article
- `/search` - Search Wikipedia articles (usage: /search your search term)
- `/setlang` - Set Wikipedia language (usage: /setlang es for Spanish)
- `/today` - Get featured article of the day (English only)

## Getting Started

### Telegram Bot Token
1. Talk to [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow instructions
3. Copy the API token he gives you

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

3. Run the bot:
```
npm start
```
