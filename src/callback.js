const quran = require( "../sources/quran.json" );
const { genButtons } = require( "./utils/button-generator" );
const { generateMessage } = require( "./utils/message-generator" );
const { editMessageWithRetry, editMessageReplyMarkupWithRetry } = require( "./utils/telegram-helpers" );
const { generateSaanNuzulMessage, generateKhameneiMessage, generateTafsirNemunehMessage } = require( "./utils/interpretations" );

const { all_translations, actionCodes } = require( "./configs" )
const database = require( "./database" );

module.exports = async function callback_query ( bot, input, chatId, messageId )
{
	const messageOptions = {
		chat_id: chatId,
		message_id: messageId,
		parse_mode: "MarkdownV2"
	}
	let { actionCode, previousActionCode, lastTranslaction, readStatusCode, searchResultIndexes, refIndex, verseRefIndex } = parseCallbackData( input );

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
				inline_keyboard: await genButtons( verseRefIndex, refIndex, searchResultIndexes, userOtions )
			},
		})
	}
	else if ( actionCodes.nextVerse === actionCode ) // next ayeh
	{
		if ( verseRefIndex + 1 < quran.length )
		{
			verseRefIndex += 1;
		}
		let message
		if ( previousActionCode == actionCodes.saanNuzul )
		{
			userOtions.actionCode = actionCodes.saanNuzul;
			message = await generateSaanNuzulMessage( verseRefIndex );
		}
		else
		{
			message = generateMessage( verseRefIndex, userOtions.lastTranslaction );
		}
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: await genButtons( verseRefIndex, refIndex, searchResultIndexes, userOtions )
			},
		});
	}
	else if ( actionCodes.prevVerse === actionCode ) // previous ayeh
	{
		if ( verseRefIndex - 1 >= 0 )
		{
			verseRefIndex -= 1;
		}
		let message
		if ( previousActionCode == actionCodes.saanNuzul )
		{
			userOtions.actionCode = actionCodes.saanNuzul;
			message = await generateSaanNuzulMessage( verseRefIndex );
		}
		else
		{
			message = generateMessage( verseRefIndex, userOtions.lastTranslaction );
		}
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: await genButtons( verseRefIndex, refIndex, searchResultIndexes, userOtions )
			},
		});
	}
	else if ( actionCodes.nextResult === actionCode ) // next result
	{
		const refIndexPosition = searchResultIndexes.indexOf( refIndex );
		if ( refIndexPosition + 1 < searchResultIndexes.length )
		{
			refIndex = searchResultIndexes[refIndexPosition + 1];
		}
		const message = generateMessage( refIndex, userOtions.lastTranslaction );
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: await genButtons( refIndex, refIndex, searchResultIndexes, userOtions )
			},
		})
	}
	else if ( actionCodes.prevResult === actionCode ) // previous result
	{
		const refIndexPosition = searchResultIndexes.indexOf( refIndex );
		if ( refIndexPosition - 1 >= 0 )
		{
			refIndex = searchResultIndexes[refIndexPosition - 1];
		}
		const message = generateMessage( refIndex, userOtions.lastTranslaction );
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: await genButtons( refIndex, refIndex, searchResultIndexes, userOtions )
			},
		})
	}
	else if ( actionCodes.tafsirNemooneh.indexOf( actionCode ) != -1 ) // tafsir nemuneh
	{
		if ( readStatusCode === actionCodes.toggleRead )
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
				inline_keyboard: await genButtons( verseRefIndex, refIndex, searchResultIndexes, userOtions )
			},
		})
	}
	else if ( actionCodes.saanNuzul === actionCode ) // saan nuzul
	{
		const message = await generateSaanNuzulMessage( verseRefIndex );
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: await genButtons( verseRefIndex, refIndex, searchResultIndexes, userOtions )
			},
		});
	}
	else if ( actionCodes.khamenei.indexOf( actionCode ) != -1 )
	{
		// Replace in the khamenei section:
		if ( readStatusCode === actionCodes.toggleRead )
		{
			if ( await database.getKhamenei( `${chatId}${verseRefIndex}` ) )
			{
				await database.deleteKhamenei( `${chatId}${verseRefIndex}` )
			}
			else
			{
				await database.putKhamenei( `${chatId}${verseRefIndex}`, true )
			}
		}
		const message = await generateKhameneiMessage( verseRefIndex, actionCodes.khamenei.indexOf( actionCode ) );
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: await genButtons( verseRefIndex, refIndex, searchResultIndexes, userOtions )
			},
		});
	}
	else if ( actionCode === actionCodes.mainPage ) // main page
	{
		const message = generateMessage( verseRefIndex, userOtions.lastTranslaction );
		await editMessageWithRetry( bot, message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: await genButtons( verseRefIndex, refIndex, searchResultIndexes, userOtions )
			},
		})
		// const replyMerkup = {
		// 	inline_keyboard: await genButtons( verseRefIndex, refIndex, searchResultIndexes, userOtions )
		// }
		// await editMessageReplyMarkupWithRetry( bot, replyMerkup, {
		// 	...messageOptions
		// })
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
	const readStatusCode = input[3];
	const [verseRefIndexStr, searchResultIndexesStr] = input.slice( 4 ).split( "_" );
	let refIndex = -1;
	const searchResultIndexes = searchResultIndexesStr.split( "," ).map( ( num, index ) =>
	{
		const tmp = parseInt( num.replace( "@", "" ), 10 );
		if ( num.includes( "@" ) )
		{
			refIndex = tmp;
		}
		return tmp;
	});
	return { actionCode, previousActionCode, lastTranslaction, readStatusCode, searchResultIndexes, refIndex, verseRefIndex: parseInt( verseRefIndexStr ) };
}