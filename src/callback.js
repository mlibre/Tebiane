const quran = require( "../sources/quran.json" );
const {
	generateMessage,
	editMessageWithRetry,
	editMessageReplyMarkupWithRetry,
	generateTafsirNemunehMessage,
	genButtons, } = require( "./utils" );
const { all_translations, actionCodes } = require( "./configs" )
const database = require( "./database" );

module.exports = async function callback_query ( bot, input, chatId, messageId )
{
	const messageOptions = {
		chat_id: chatId,
		message_id: messageId,
		parse_mode: "MarkdownV2"
	}
	let { actionCode, previousActionCode, lastTranslaction, readCode, refIndexes, refIndex, verseRefIndex } = parseCallbackData( input );

	const userOtions = {
		actionCode,
		previousActionCode,
		lastTranslaction,
		chatId,
		messageId
	}
	if ( all_translations[actionCode] ) // translation
	{
		userOtions.lastTranslaction = actionCode;
		const message = generateMessage( verseRefIndex, actionCode );
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: await genButtons( verseRefIndex, refIndex, refIndexes, userOtions )
			},
		})
	}
	else if ( actionCodes.nextVerse === actionCode ) // next ayeh
	{
		if ( verseRefIndex + 1 < quran.length )
		{
			verseRefIndex += 1;
		}
		const message = generateMessage( verseRefIndex, userOtions.lastTranslaction );
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: await genButtons( verseRefIndex, refIndex, refIndexes, userOtions )
			},
		});
	}
	else if ( actionCodes.prevVerse === actionCode ) // previous ayeh
	{
		if ( verseRefIndex - 1 >= 0 )
		{
			verseRefIndex -= 1;
		}
		const message = generateMessage( verseRefIndex, userOtions.lastTranslaction );
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: await genButtons( verseRefIndex, refIndex, refIndexes, userOtions )
			},
		});
	}
	else if ( actionCodes.nextResult === actionCode ) // next result
	{
		const refIndexPosition = refIndexes.indexOf( refIndex );
		if ( refIndexPosition + 1 < refIndexes.length )
		{
			refIndex = refIndexes[refIndexPosition + 1];
		}
		const message = generateMessage( refIndex, userOtions.lastTranslaction );
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: await genButtons( refIndex, refIndex, refIndexes, userOtions )
			},
		})
	}
	else if ( actionCodes.prevResult === actionCode ) // previous result
	{
		const refIndexPosition = refIndexes.indexOf( refIndex );
		if ( refIndexPosition - 1 >= 0 )
		{
			refIndex = refIndexes[refIndexPosition - 1];
		}
		const message = generateMessage( refIndex, userOtions.lastTranslaction );
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: await genButtons( refIndex, refIndex, refIndexes, userOtions )
			},
		})
	}
	else if ( actionCodes.tafsirNemooneh.indexOf( actionCode ) != -1 ) // tafsir nemuneh
	{
		if ( readCode === actionCodes.toggleRead )
		{
			if ( await database.getTafsir( `${chatId}${verseRefIndex}` ) )
			{
				await database.deleteTafsir( `${chatId}${verseRefIndex}` )
			}
			else
			{
				await database.putTafsir( `${chatId}${verseRefIndex}`, true )
			}
		}
		const message = await generateTafsirNemunehMessage( verseRefIndex, actionCodes.tafsirNemooneh.indexOf( actionCode ) );
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: await genButtons( verseRefIndex, refIndex, refIndexes, userOtions )
			},
		})
	}
	else if ( actionCode === actionCodes.mainPage ) // main page
	{
		const replyMerkup = {
			inline_keyboard: await genButtons( verseRefIndex, refIndex, refIndexes, userOtions )
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
	const actionCode = input[0];
	const previousActionCode = input[1];
	const lastTranslaction = input[2];
	const readCode = input[3];
	const [verseRefIndexStr, refIndexesStr] = input.slice( 4 ).split( "_" );
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
	return { actionCode, previousActionCode, lastTranslaction, readCode, refIndexes, refIndex, verseRefIndex: parseInt( verseRefIndexStr ) };
}