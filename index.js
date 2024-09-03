require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const ytdl = require('ytdl-core');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

// Access the bot token from environment variables
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(botToken, { polling: true });

// Ensure the downloads directory exists
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
}

// Start command
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Welcome! Send me a video link from YouTube, Instagram, TikTok, or Facebook.");
});

// Function to download videos
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const url = msg.text;

    // Download YouTube videos
    if (ytdl.validateURL(url)) {
        try {
            const videoInfo = await ytdl.getInfo(url);
            const title = videoInfo.videoDetails.title.replace(/[\/\\?%*:|"<>]/g, '-');
            const filePath = path.join(downloadsDir, `${title}.mp4`);

            bot.sendMessage(chatId, `Downloading: ${title}`);

            ytdl(url, { format: 'mp4' })
                .pipe(fs.createWriteStream(filePath))
                .on('finish', () => {
                    bot.sendVideo(chatId, filePath).then(() => {
                        fs.unlinkSync(filePath); // Clean up the file after sending
                    });
                });
        } catch (error) {
            bot.sendMessage(chatId, `Failed to download the video: ${error.message}`);
        }
    } else {
        bot.sendMessage(chatId, "Please send a valid YouTube link.");
    }
});
