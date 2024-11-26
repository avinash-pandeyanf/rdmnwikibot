# Random Wikipedia Bot

A Telegram bot for discovering and searching Wikipedia articles.

## Features Added
- Random Wikipedia articles with refresh button
- Wikipedia search with inline mode
- Today's featured article
- Multi-language support
- Interactive buttons

## Setup
1. Get bot token from [@BotFather](https://t.me/botfather)
2. Enable inline mode with `/setinline`
3. Create `.env` with `TELEGRAM_BOT_TOKEN=your_token`
4. Deploy to Vercel
5. Set webhook: `https://api.telegram.org/bot<token>/setWebhook?url=<vercel_url>/api/webhook`
