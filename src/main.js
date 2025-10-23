const Fuse = require( "fuse.js" );
const TelegramBot = require( "node-telegram-bot-api" );
const quran = require( "../sources/quran.json" );
const errorHandler = require( "./errorHandler" );
const resources = require( "./resources" );
const search = require( "./search" );
const callback = require( "./callback" );

const { botOptions, token } = require( "./configs" );
const bot = new TelegramBot( token, botOptions );

const fuseKeys = [
	{ name: "surah.number", weight: 1 }, // 1
	{ name: "surah.persian_number", weight: 1 }, // ۱
	{ name: "surah.arabic", weight: 1.4 }, // ٱلْفَاتِحَة
	{ name: "surah.farsi", weight: 1.2 }, // فاتحه
	{ name: "ayah", weight: 1.2 }, // 1
	{ name: "ayah_persian", weight: 1.2 }, // ۱
	{ name: "verse.farsi_makarem", weight: 1 },
	{ name: "verse.arabic_clean", weight: 1 }, // بسم الله الرحمن الرحيم
	{ name: "verse.arabic_enhanced", weight: 1 }, // بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
	{ name: "id", weight: 0.05 }, // 1
	{ name: "id_persian", weight: 0.05 }, // ۱
];

const fuseIndex = Fuse.createIndex( fuseKeys, quran )

const fuse = new Fuse( quran, {
	isCaseSensitive: false,
	includeScore: false,
	includeMatches: false,
	useExtendedSearch: false,
	ignoreLocation: true,
	threshold: 0.8,
	keys: fuseKeys
}, fuseIndex );

errorHandler( bot );

bot.on( "message", async ( msg ) =>
{
	if ( msg.text.includes( "/resources" ) || msg.text.includes( "/search" ) ||
		msg.text.includes( "/start" ) )
	{
		return;
	}
	return await search( bot, fuse, msg.text, msg.chat.id, msg.message_id );
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
	const { data, id: callbackQueryId } = callbackQuery; // 'k1475_@1463,6155,106,1053,2000,6149,392,592'
	const chatId = callbackQuery.message.chat.id
	const messageId = callbackQuery.message.message_id
	try
	{
		return await callback( bot, data, chatId, messageId );
	}
	catch ( error )
	{
		console.error( "Error processing callback query:", error );
	}
	finally
	{
		await bot.answerCallbackQuery( callbackQueryId );
	}
});



// quran
// [
// 	{
//     "id": 1,
//     "id_persian": "۱",
//     "surah": {
//       "number": 1,
//       "persian_number": "۱",
//       "arabic": "ٱلْفَاتِحَة",
//       "english": "Al-Fatihah",
//       "farsi": "فاتحه"
//     },
//     "ayah": 1,
//     "ayah_persian": "۱",
//     "verse": {
//       "farsi_makarem": "به نام خداوند بخشنده بخشایشگر",
//       "english_arberry": "In the Name of God, the Merciful, the Compassionate",
//       "arabic_clean": "بسم الله الرحمن الرحيم",
//       "arabic_enhanced": "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ"
//     }
//   },
//   ...