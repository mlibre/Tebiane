const quran = require( "../sources/quran.json" );
const {
	generateMessage,
	buttons,
	parseCallbackData,
	editMessageWithRetry,
	generateTafsirNemunehMessage } = require( "./utils" );
const { all_translations, actionCodes } = require( "./configs" )

module.exports = async function callback_query ( bot, input, chatId, messageId )
{
	const messageOptions = {
		chat_id: chatId,
		message_id: messageId,
		parse_mode: "MarkdownV2"
	}
	let { action, refIndexes, refIndex, verseRefIndex } = parseCallbackData( input );

	if ( all_translations[action] ) // translation
	{
		const message = generateMessage( verseRefIndex, action );
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: buttons( verseRefIndex, refIndex, refIndexes )
			},
		})
	}
	else if ( action === "i" ) // next ayeh
	{
		if ( verseRefIndex + 3 < quran.length )
		{
			verseRefIndex += 3;
		}
		const message = generateMessage( verseRefIndex );
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: buttons( verseRefIndex, refIndex, refIndexes )
			},
		});
	}
	else if ( action === "j" ) // previous ayeh
	{
		if ( verseRefIndex - 3 >= 0 )
		{
			verseRefIndex -= 3;
		}
		const message = generateMessage( verseRefIndex );
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: buttons( verseRefIndex, refIndex, refIndexes )
			},
		});
	}
	else if ( action === "a" ) // next result
	{
		const refIndexPosition = refIndexes.indexOf( refIndex );
		if ( refIndexPosition + 1 < refIndexes.length )
		{
			refIndex = refIndexes[refIndexPosition + 1];
		}
		const message = generateMessage( refIndex );
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: buttons( refIndex, refIndex, refIndexes )
			},
		})
	}
	else if ( action === "b" ) // previous result
	{
		const refIndexPosition = refIndexes.indexOf( refIndex );
		if ( refIndexPosition - 1 >= 0 )
		{
			refIndex = refIndexes[refIndexPosition - 1];
		}
		const message = generateMessage( refIndex );
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: buttons( refIndex, refIndex, refIndexes )
			},
		})
	}
	else if ( action === "k" ) // tafsir nemuneh
	{
		const message = await generateTafsirNemunehMessage( verseRefIndex );
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: buttons( verseRefIndex, refIndex, refIndexes )
			},
		})
	}
	else
	{
		throw new Error( "Invalid callback data" );
	}
}