const fs = require( "fs" );
const path = require( "path" );
require( "dotenv" ).config()
const Fuse = require( "fuse.js" );
const TelegramBot = require( "node-telegram-bot-api" );
const quran = require( "../sources/quran.json" );
const errorHandler = require( "./errorHandler" );
const resources = require( "./resources" );
const search = require( "./search" );
const callback = require( "./callback" );

const token = process.env.TELEGRAM_BOT_TOKEN;
const proxy = process.env.PROXY;

const botOptions = {
	polling: true
};
if ( proxy )
{
	botOptions.request = {
		proxy
	};
}

const bot = new TelegramBot( token, botOptions );
const fuseKeys = ["id", "id_persian", "surah.number", "surah.persian_number",
	"surah.arabic", "surah.farsi", "ayah", "ayah_persian",
	"verse.farsi_makarem", "verse.farsi_ansarian", "verse.farsi_fooladvand",
	"verse.farsi_mojtabavi", "verse.arabic_clean", "verse.arabic_enhanced"]
const fuseIndex = Fuse.createIndex( fuseKeys, quran )

const fuse = new Fuse( quran, {
	isCaseSensitive: false,
	includeScore: true,
	includeMatches: true,
	threshold: 0.5,
	keys: fuseKeys
}, fuseIndex );

errorHandler( bot );

bot.on( "message", async ( msg ) =>
{
	if ( msg.text.includes( "/resources" ) || msg.text.includes( "/search" ) ||
		msg.text.includes( "/setlang" ) || msg.text.includes( "/start" ) )
	{
		return;
	}
	return await search( bot, fuse, msg.text, msg.chat.id );
});

bot.onText( /\/search (.+)/, async ( msg, match ) =>
{
	return await search( bot, fuse, msg.text, msg.chat.id );
});

bot.onText( /\/resources/, async ( msg, match ) =>
{
	return await resources( bot, msg, match );
});

bot.on( "callback_query", async ( callbackQuery ) =>
{
	const { data } = callbackQuery;
	const chatId = callbackQuery.message.chat.id
	const messageId = callbackQuery.message.message_id
	return await callback( bot, data, chatId, messageId );
});



// quran
// [
// 	{
// 		"id": 1,
// 		"surah": {
// 			"number": 1,
// 			"arabic": "ٱلْفَاتِحَة",
// 			"english": "Al-Fatihah",
// 			"farsi": "فاتحه"
// 		},
// 		"ayah": 1,
// 		"verse": {
// 			"farsi_makarem": "به نام خداوند بخشنده بخشایشگر",
// 			"farsi_ansarian": "به نام خدا که رحمتش بی‌اندازه است و مهربانی‌اش همیشگی.",
// 			"farsi_fooladvand": "به نام خداوند رحمتگر مهربان",
// 			"farsi_mojtabavi": "به نام خداى بخشاينده مهربان",
// 			"english_arberry": "In the Name of God, the Merciful, the Compassionate",
// 			"arabic_clean": "بسم الله الرحمن الرحيم",
// 			"arabic_enhanced": "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ"
// 		}
// 	},
// 	{
// 		"id": 2,
// 		"surah": {
// 			"number": 1,
// 			"arabic": "ٱلْفَاتِحَة",
// 			"english": "Al-Fatihah",
// 			"farsi": "فاتحه"
// 		},
// 		"ayah": 2,
// 		"verse": {
// 			"farsi_makarem": "ستایش مخصوص خداوندی است که پروردگار جهانیان است.",
// 			"farsi_ansarian": "همه ستایش ها، ویژه خدا، مالک و مربّی جهانیان است.",
// 			"farsi_fooladvand": "ستايش خدايى را كه پروردگار جهانيان،",
// 			"farsi_mojtabavi": "سپاس و ستايش خداى راست، پروردگار جهانيان",
// 			"english_arberry": "Praise belongs to God, the Lord of all Being,",
// 			"arabic_clean": "الحمد لله رب العالمين",
// 			"arabic_enhanced": "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ"
// 		}
// 	},
// 	AND SO ON ...
// ]