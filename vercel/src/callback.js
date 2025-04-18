const { genButtons } = require( "./button-generator.js" );
const { generateMessage } = require( "./message-generator.js" );
const { generateSaanNuzulMessage, generateKhameneiMessage, generateTafsirNemunehMessage } = require( "./interpretations.js" );
const { actionCodes, all_translations } = require( "./config.js" );

async function handleCallback ( telegramClient, input, chatId, messageId )
{
	const messageOptions = {
		chat_id: chatId,
		message_id: messageId,
		parse_mode: "MarkdownV2"
	};

	let { actionCode, previousActionCode, lastTranslaction, readStatusCode, searchResultIndexes, refIndex, verseRefIndex } = parseCallbackData( input );

	const userOptions = {
		actionCode,
		previousActionCode,
		lastTranslaction,
		chatId,
		messageId
	};

	if ( all_translations[actionCode] )
	{ // translation
		userOptions.lastTranslaction = actionCode;
		const message = generateMessage( verseRefIndex, actionCode );
		await telegramClient.editMessageWithRetry( message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: await genButtons( verseRefIndex, refIndex, searchResultIndexes, userOptions )
			},
		});
	}
	else if ( actionCodes.nextVerse === actionCode )
	{ // next ayeh
		if ( verseRefIndex + 1 < globalThis.quranData.length )
		{
			verseRefIndex += 1;
		}
		let message;
		if ( previousActionCode == actionCodes.saanNuzul )
		{
			userOptions.actionCode = actionCodes.saanNuzul;
			message = await generateSaanNuzulMessage( verseRefIndex );
		}
		else
		{
			message = generateMessage( verseRefIndex, userOptions.lastTranslaction );
		}
		await telegramClient.editMessageWithRetry( message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: await genButtons( verseRefIndex, refIndex, searchResultIndexes, userOptions )
			},
		});
	}
	else if ( actionCodes.prevVerse === actionCode )
	{ // previous ayeh
		if ( verseRefIndex - 1 >= 0 )
		{
			verseRefIndex -= 1;
		}
		let message;
		if ( previousActionCode == actionCodes.saanNuzul )
		{
			userOptions.actionCode = actionCodes.saanNuzul;
			message = await generateSaanNuzulMessage( verseRefIndex );
		}
		else
		{
			message = generateMessage( verseRefIndex, userOptions.lastTranslaction );
		}
		await telegramClient.editMessageWithRetry( message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: await genButtons( verseRefIndex, refIndex, searchResultIndexes, userOptions )
			},
		});
	}
	else if ( actionCodes.nextResult === actionCode )
	{ // next result
		const refIndexPosition = searchResultIndexes.indexOf( refIndex );
		if ( refIndexPosition + 1 < searchResultIndexes.length )
		{
			refIndex = searchResultIndexes[refIndexPosition + 1];
		}
		const message = generateMessage( refIndex, userOptions.lastTranslaction );
		await telegramClient.editMessageWithRetry( message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: await genButtons( refIndex, refIndex, searchResultIndexes, userOptions )
			},
		});
	}
	else if ( actionCodes.prevResult === actionCode )
	{ // previous result
		const refIndexPosition = searchResultIndexes.indexOf( refIndex );
		if ( refIndexPosition - 1 >= 0 )
		{
			refIndex = searchResultIndexes[refIndexPosition - 1];
		}
		const message = generateMessage( refIndex, userOptions.lastTranslaction );
		await telegramClient.editMessageWithRetry( message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: await genButtons( refIndex, refIndex, searchResultIndexes, userOptions )
			},
		});
	}
	else if ( actionCodes.tafsirNemooneh.indexOf( actionCode ) != -1 )
	{ // tafsir nemuneh
		if ( readStatusCode === actionCodes.toggleRead )
		{
			const key = `tafsir_read_${chatId}_${verseRefIndex}`;
			if ( await globalThis.kvNamespace.getJson( key ) )
			{
				await globalThis.kvNamespace.delete( key );
			}
			else
			{
				await globalThis.kvNamespace.putJson( key, true );
			}
		}
		const message = await generateTafsirNemunehMessage( verseRefIndex, actionCodes.tafsirNemooneh.indexOf( actionCode ) );
		await telegramClient.editMessageWithRetry( message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: await genButtons( verseRefIndex, refIndex, searchResultIndexes, userOptions )
			},
		});
	}
	else if ( actionCodes.saanNuzul === actionCode )
	{ // saan nuzul
		const message = await generateSaanNuzulMessage( verseRefIndex );
		await telegramClient.editMessageWithRetry( message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: await genButtons( verseRefIndex, refIndex, searchResultIndexes, userOptions )
			},
		});
	}
	else if ( actionCodes.khamenei.indexOf( actionCode ) != -1 )
	{
		// Replace in the khamenei section:
		if ( readStatusCode === actionCodes.toggleRead )
		{
			const key = `khamenei_read_${chatId}_${verseRefIndex}`;
			if ( await globalThis.kvNamespace.getJson( key ) )
			{
				await globalThis.kvNamespace.delete( key );
			}
			else
			{
				await globalThis.kvNamespace.putJson( key, true );
			}
		}
		const message = await generateKhameneiMessage( verseRefIndex, actionCodes.khamenei.indexOf( actionCode ) );
		await telegramClient.editMessageWithRetry( message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: await genButtons( verseRefIndex, refIndex, searchResultIndexes, userOptions )
			},
		});
	}
	else if ( actionCode === actionCodes.mainPage )
	{ // main page
		const message = generateMessage( verseRefIndex, userOptions.lastTranslaction );
		await telegramClient.editMessageWithRetry( message, {
			...messageOptions,
			reply_markup: {
				inline_keyboard: await genButtons( verseRefIndex, refIndex, searchResultIndexes, userOptions )
			},
		});
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
	const searchResultIndexes = searchResultIndexesStr.split( "," ).map( ( num ) =>
	{
		const tmp = parseInt( num.replace( "@", "" ), 10 );
		if ( num.includes( "@" ) )
		{
			refIndex = tmp;
		}
		return tmp;
	});
	return {
		actionCode,
		previousActionCode,
		lastTranslaction,
		readStatusCode,
		searchResultIndexes,
		refIndex,
		verseRefIndex: parseInt( verseRefIndexStr )
	};
}

module.exports = {
	handleCallback
};
