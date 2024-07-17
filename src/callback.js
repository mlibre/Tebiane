const quran = require( "../sources/quran.json" );
const {
	generateMessage,
	editMessageWithRetry,
	editMessageReplyMarkupWithRetry,
	generateTafsirNemunehMessage,
	genButtons, } = require( "./utils" );
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
				inline_keyboard: genButtons( verseRefIndex, refIndex, refIndexes )
			},
		})
	}
	else if ( actionCodes.nextVerse === action ) // next ayeh
	{
		if ( verseRefIndex + 1 < quran.length )
		{
			verseRefIndex += 1;
		}
		const message = generateMessage( verseRefIndex );
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: genButtons( verseRefIndex, refIndex, refIndexes )
			},
		});
	}
	else if ( actionCodes.prevVerse === action ) // previous ayeh
	{
		if ( verseRefIndex - 1 >= 0 )
		{
			verseRefIndex -= 1;
		}
		const message = generateMessage( verseRefIndex );
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: genButtons( verseRefIndex, refIndex, refIndexes )
			},
		});
	}
	else if ( actionCodes.nextResult === action ) // next result
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
				inline_keyboard: genButtons( refIndex, refIndex, refIndexes )
			},
		})
	}
	else if ( actionCodes.prevResult === action ) // previous result
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
				inline_keyboard: genButtons( refIndex, refIndex, refIndexes )
			},
		})
	}
	else if ( actionCodes.tafsirNemooneh.indexOf( action ) != -1 ) // tafsir nemuneh
	{
		const message = await generateTafsirNemunehMessage( verseRefIndex, actionCodes.tafsirNemooneh.indexOf( action ) );
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: genButtons( verseRefIndex, refIndex, refIndexes, action )
			},
		})
	}
	else if ( action === actionCodes.mainPage ) // main page
	{
		const replyMerkup = {
			inline_keyboard: genButtons( verseRefIndex, refIndex, refIndexes )
		}
		await editMessageReplyMarkupWithRetry( bot, replyMerkup, {
			...messageOptions
		})
	}
	else
	{
		throw new Error( "Invalid callback data" );
	}
}

function parseCallbackData ( input )
{
	const action = input[0];
	const [verseRefIndexStr, refIndexesStr] = input.slice( 1 ).split( "_" );
	let refIndex = -1;
	const refIndexes = refIndexesStr.split( "," ).map( ( num, index ) =>
	{
		const tmp = parseInt( num.replace( "@", "" ), 10 );
		if ( num.includes( "@" ) )
		{
			refIndex = tmp;
		}
		return tmp;
	});
	return { action, refIndexes, refIndex, verseRefIndex: parseInt( verseRefIndexStr ) };
}