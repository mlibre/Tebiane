const quran = require( "../sources/quran.json" );
const {
	generateMessage,
	genButtons,
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
				inline_keyboard: genButtons( verseRefIndex, refIndex, refIndexes )
			},
		})
	}
	else if ( actionCodes.nextVerse === action ) // next ayeh
	{
		if ( verseRefIndex + 3 < quran.length )
		{
			verseRefIndex += 3;
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
		if ( verseRefIndex - 3 >= 0 )
		{
			verseRefIndex -= 3;
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
	else if ( actionCodes.tafsirNemooneh1 === action || actionCodes.tafsirNemooneh2 == action ) // tafsir nemuneh
	{
		let part;
		if ( actionCodes.tafsirNemooneh1 === action )
		{
			part = 0;
		}
		else if ( actionCodes.tafsirNemooneh2 === action )
		{
			part = 1;
		}
		const message = await generateTafsirNemunehMessage( verseRefIndex, part );
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: genButtons( verseRefIndex, refIndex, refIndexes )
			},
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