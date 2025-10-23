const util = require( "node:util" );
const { generateMessage } = require( "./message-generator.js" );
const { actionCodes, appUrl, webhookPath, token, sourcesText } = require( "./config.js" );
const { genButtons } = require( "./button-generator.js" );
const { handleCallback } = require( "./callback.js" );
const { normalizeMessage } = require( "./text-helpers.js" );

class TelegramClient
{
	constructor ({
		searchIndex,
		baseUrl = "https://api.telegram.org"
	})
	{
		this.token = token;
		this.apiBaseUrl = `${baseUrl}/bot${token}`;
		this.searchIndex = searchIndex;
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
					console.log( `Retrying... Attempts left: ${retries - i - 1}`, error.cause, error.message );
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
			signal: AbortSignal.timeout( 30000 )
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


	async handleUpdate ( update )
	{
		console.log( update );
		if ( "message" in update && update.message.text )
		{
			const { text } = update.message;
			const chatId = update.message.chat.id;

			if ( text.startsWith( "/resources" ) )
			{
				await this.sendAllResources( chatId );
				return;
			}
			if ( text.startsWith( "/start" ) )
			{
				const message = `دستیار شخصی قرآن، ارائه دهنده ترجمه‌ها، تفسیرها (تفسیر نمونه، فیش‌های رهبری) و شأن نزول.
جستجو بر اساس متن، ترجمه، شماره سوره یا آیه 🌟
برای شروع هر عبارتی میخواید بنویسید.`
				await this.sendMessageWithRetry( chatId, normalizeMessage( message ), { parse_mode: "MarkdownV2" });
				return;
			}
			await this.search( text, chatId, update.message.message_id );
			return;
		}
		else if ( "callback_query" in update )
		{
			const { data } = update.callback_query;
			const chatId = update.callback_query.message.chat.id;
			const messageId = update.callback_query.message.message_id;
			try
			{
				await handleCallback( this, data, chatId, messageId );
			}
			catch ( error )
			{
				this.log( "error", error );
			}
			finally
			{
				await this.makeRequest( "answerCallbackQuery", {
					callback_query_id: update.callback_query.id
				});
			}
			return;
		}
	}

	async sendAllResources ( chatId )
	{
		const resourcesMessage = `\`\`\`text\n${this.sources}\`\`\``;
		await this.sendMessageWithRetry( chatId, resourcesMessage, { parse_mode: "MarkdownV2" });
	}

	performCombinedSearch ( query )
	{
		// Get exact matches
		const exactResults = this.searchIndex.search({
			query,
			enrich: true,
			merge: true
		});

		// Get suggested matches
		const suggestedResults = this.searchIndex.search({
			query,
			suggest: true,
			enrich: true,
			merge: true
		});

		// Merge results, removing duplicates by ID
		const combinedResultsMap = new Map();

		// Add exact matches first (higher priority)
		exactResults.forEach( result =>
		{
			combinedResultsMap.set( result.id, result );
		});

		// Add suggested matches if not already included
		suggestedResults.forEach( result =>
		{
			if ( !combinedResultsMap.has( result.id ) )
			{
				combinedResultsMap.set( result.id, result );
			}
		});

		// Convert map back to array
		return Array.from( combinedResultsMap.values() );
	}

	async search ( text, chatId, messageId )
	{
		const userInput = text.replace( /^\/search\s*/, "" );
		const finalResults = this.performCombinedSearch( userInput );

		if ( finalResults.length > 0 )
		{
			const refIndex = finalResults[0].id - 1; // Convert to 0-based index
			const refResults = finalResults.slice( 0, 8 ).map( result => { return result.id - 1 });
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

	async registerWebhook ()
	{
		const response = await this.makeRequest( "setWebhook", {
			url: `${appUrl}${webhookPath}`,
			drop_pending_updates: true,
			max_connections: 20,
		});
		return { response, url: `${appUrl}${webhookPath}` };
	}

	async unRegisterWebhook ()
	{
		const response = await this.makeRequest( "setWebhook", { url: "" });
		return response.ok === true;
	}

	isNetworkError ( error )
	{
		const message = error.message?.toLowerCase();
		return message.includes( "socket hang up" ) ||
			message.includes( "network socket disconnected" ) ||
			message.includes( "fetch failed" ) ||
			message.includes( "timeout" );
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