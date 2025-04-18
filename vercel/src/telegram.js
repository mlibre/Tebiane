const util = require( "node:util" );
const { generateMessage } = require( "./message-generator.js" );
const { actionCodes, productionUrl, webhookPath, token, sourcesText } = require( "./config.js" );
const { genButtons } = require( "./button-generator.js" );
const { handleCallback } = require( "./callback.js" );

class TelegramClient
{
	constructor ({
		fuse,
		baseUrl = "https://api.telegram.org"
	})
	{
		this.token = token;
		this.apiBaseUrl = `${baseUrl}/bot${token}`;
		this.fuse = fuse;
		this.sources = sourcesText;
	}

	async withRetry ( operation, options, retries = 10, delay = 50 )
	{
		for ( let i = 0; i < retries; i++ )
		{
			try
			{
				return await operation( options );
			}
			catch ( error )
			{
				if ( this.isNetworkError( error ) )
				{
					console.log( `Retrying... Attempts left: ${retries - i - 1}` );
					await this.sleep( delay );
				}
				else
				{
					throw error;
				}
			}
		}
		throw new Error( "Max retries reached" );
	}

	async makeRequest ( method, params = {})
	{
		const url = `${this.apiBaseUrl}/${method}`;
		const response = await fetch( url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify( params ),
		});

		if ( !response.ok )
		{
			const error = await response.json();
			throw new Error( `Telegram API error: ${JSON.stringify( error )}` );
		}

		return await response.json();
	}

	async sendMessageWithRetry ( chatId, message, options = {})
	{
		return await this.withRetry( () =>
		{
			return this.makeRequest( "sendMessage", {
				chat_id: chatId,
				text: message,
				...options,
			});
		}, options );
	}

	async editMessageWithRetry ( message, options = {})
	{
		if ( !options.chat_id || !options.message_id )
		{
			throw new Error( "chat_id and message_id are required for editMessageText" );
		}

		return await this.withRetry( () =>
		{
			return this.makeRequest( "editMessageText", {
				text: message,
				...options,
			});
		}, options );
	}

	async editMessageReplyMarkupWithRetry ( replyMarkup, options = {})
	{
		if ( !options.chat_id || !options.message_id )
		{
			throw new Error( "chat_id and message_id are required for editMessageReplyMarkup" );
		}

		return await this.withRetry( () =>
		{
			return this.makeRequest( "editMessageReplyMarkup", {
				reply_markup: replyMarkup,
				...options,
			});
		}, options );
	}

	async handleUpdate ( update )
	{
		console.log( update );
		if ( "message" in update && update.message.text )
		{
			const { text } = update.message;
			const chatId = update.message.chat.id;

			if ( text.startsWith( "/search" ) )
			{
				await this.search( text, chatId, update.message.message_id );
				return;
			}

			if ( text.startsWith( "/resources" ) )
			{
				await this.sendAllResources( chatId );
				return;
			}

			// Default echo response
			await this.search( text, chatId, update.message.message_id );
			return;
		}
		else if ( "callback_query" in update )
		{
			const { data } = update.callback_query;
			const chatId = update.callback_query.message.chat.id;
			const messageId = update.callback_query.message.message_id;

			// Use the callback handler
			await handleCallback( this, data, chatId, messageId );

			// Answer the callback query to remove the loading state
			await this.makeRequest( "answerCallbackQuery", {
				callback_query_id: update.callback_query.id
			});

			return;
		}
	}

	async sendAllResources ( chatId )
	{
		const resourcesMessage = `\`\`\`text\n${this.sources}\`\`\``;
		await this.sendMessageWithRetry( chatId, resourcesMessage, { parse_mode: "MarkdownV2" });
	}

	async search ( text, chatId, messageId )
	{
		const userInput = text.replace( /^\/search\s*/, "" );
		// this.log( "search request", text, chatId, messageId, userInput );
		const searchResult = this.fuse.search( userInput, 12 );

		if ( searchResult.length > 0 )
		{
			const { refIndex } = searchResult[0];
			const refResults = searchResult.map( result => { return result.refIndex }).slice( 0, 8 );
			const message = generateMessage( refIndex, actionCodes.makarem );

			await this.sendMessageWithRetry( chatId, message, {
				reply_markup: {
					inline_keyboard: await genButtons(
						refIndex, refIndex, refResults,
						{
							actionCode: actionCodes.makarem,
							lastTranslaction: actionCodes.makarem,
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
			await this.sendMessageWithRetry( chatId, "نتیجه ای یافت نشد!" );
		}
	}

	async registerWebhook ( )
	{
		const response = await this.makeRequest( "setWebhook", {
			url: `${productionUrl}${webhookPath}`,
			drop_pending_updates: true,
			max_connections: 10,
		});
		return { response, url: `${productionUrl}${webhookPath}` };
	}

	async unRegisterWebhook ()
	{
		const response = await this.makeRequest( "setWebhook", { url: "" });
		return response.ok === true;
	}

	isNetworkError ( error )
	{
		// TODO: check with fetch
		return error.message.includes( "socket hang up" ) ||
      error.message.includes( "network socket disconnected" ) ||
      error.message.includes( "fetch failed" );
	}

	async sleep ( ms )
	{
		await new Promise( resolve => { return setTimeout( resolve, ms ) });
	}

	log ( ...update )
	{
		console.log( util.inspect( update, { showHidden: true, depth: null }) );
	}
}

module.exports = TelegramClient;
