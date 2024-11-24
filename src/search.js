const { genButtons } = require( "./utils/button-generator" );
const { generateMessage } = require( "./utils/message-generator" );
const { sendMessageWithRetry } = require( "./utils/telegram-helpers" );

const database = require( "./database" );
const config = require( "./configs" );

module.exports = async function search ( bot, fuse, text, chatId, messageId )
{
	const userInput = text.replace( /^\/search\s*/, "" );
	const searchResult = fuse.search( userInput );

	if ( searchResult.length > 0 )
	{
		const { refIndex } = searchResult[0];
		const refResults = searchResult.map( result => { return result.refIndex }).slice( 0, 8 );
		const message = generateMessage( refIndex, config.actionCodes.makarem );
		await sendMessageWithRetry( bot, chatId, message, {
			reply_markup: {
				inline_keyboard: await genButtons(
					refIndex, refIndex, refResults,
					{
						actionCode: config.actionCodes.makarem,
						lastTranslaction: config.actionCodes.makarem,
						chatId,
						messageId
					}
				)
			},
			parse_mode: "MarkdownV2"
		});
	}
	else
	{
		await sendMessageWithRetry( bot, chatId, "نتیجه ای یافت نشد!", {});
	}
};
