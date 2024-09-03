require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const ytdl = require('ytdl-core');
const fs = require('fs');
const axios = require('axios');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg'); // For converting video to mp3

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

    if (ytdl.validateURL(url)) {
        try {
            const videoInfo = await ytdl.getInfo(url);
            const title = videoInfo.videoDetails.title.replace(/[\/\\?%*:|"<>]/g, '-');

            // Prompt user to select video quality or download as MP3
            const keyboard = {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: "Low Quality", callback_data: "low" },
                            { text: "Medium Quality", callback_data: "medium" },
                            { text: "High Quality", callback_data: "high" },
                        ],
                        [{ text: "Download as MP3", callback_data: "mp3" }]
                    ]
                }
            };

            bot.sendMessage(chatId, `Select download quality for: ${title}`, keyboard);

            bot.once('callback_query', (callbackQuery) => {
                const quality = callbackQuery.data;
                const options = { quality: 'highestvideo' };

                if (quality === 'low') {
                    options.quality = 'lowestvideo';
                } else if (quality === 'medium') {
                    options.quality = 'highestaudio';
                } else if (quality === 'high') {
                    options.quality = 'highestvideo';
                }

                const filePath = path.join(downloadsDir, `${title}.${quality === 'mp3' ? 'mp3' : 'mp4'}`);

                if (quality === 'mp3') {
                    downloadAndConvertToMp3(url, filePath, chatId);
                } else {
                    downloadVideo(url, options, filePath, chatId);
                }
            });
        } catch (error) {
            bot.sendMessage(chatId, `Failed to process the video: ${error.message}`);
        }
    } else {
        bot.sendMessage(chatId, "Please send a valid YouTube link.");
    }
});

function downloadVideo(url, options, filePath, chatId) {
    bot.sendMessage(chatId, "Downloading video...");
    const stream = ytdl(url, options);

    stream.on('progress', (chunkLength, downloaded, total) => {
        const percent = (downloaded / total * 100).toFixed(2);
        bot.sendMessage(chatId, `Download progress: ${percent}%`);
    });

    stream.pipe(fs.createWriteStream(filePath))
        .on('finish', () => {
            bot.sendVideo(chatId, filePath).then(() => {
                fs.unlinkSync(filePath); // Clean up the file after sending
            });
        })
        .on('error', (error) => {
            bot.sendMessage(chatId, `Error during download: ${error.message}`);
        });
}

function downloadAndConvertToMp3(url, filePath, chatId) {
    bot.sendMessage(chatId, "Downloading and converting to MP3...");
    const stream = ytdl(url, { quality: 'highestaudio' });

    ffmpeg(stream)
        .audioBitrate(128)
        .save(filePath)
        .on('end', () => {
            bot.sendAudio(chatId, filePath).then(() => {
                fs.unlinkSync(filePath); // Clean up the file after sending
            });
        })
        .on('error', (error) => {
            bot.sendMessage(chatId, `Error during conversion: ${error.message}`);
        });
}
