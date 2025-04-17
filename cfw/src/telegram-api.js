import util from "node:util";
import { generateMessage } from "./message-generator.js";
import { actionCodes } from "./config.js";
import { genButtons } from "./button-generator.js";
import { handleCallback } from "./callback.js";

export default class TelegramClient
{
	constructor ({
		token,
		secretToken = null,
		fuse,
		baseUrl = "https://api.telegram.org",
		sources
	})
	{
		this.token = token;
		this.secretToken = secretToken;
		this.apiBaseUrl = `${baseUrl}/bot${token}`;
		this.fuse = fuse;
		this.sources = sources;
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
		// message: { \N	    message_id: 1130, \N	    from: { \N	      id: 354242641, \N	      is_bot: false, \N	      first_name: 'Масуд', \N	      username: 'mlibre', \N	      language_code: 'en' \N	    }, \N	    chat: { \N	      id: 354242641, \N	      first_name: 'Масуд', \N	      username: 'mlibre', \N	      type: 'private' \N	    }, \N	    date: 1744371005, \N	    text: 'سلام' \N	  } \N	} \N		{ \N	  update_id: 275201116, \N	  callback_query: { \N	    id: '1521460559992070096', \N	    from: { \N	      id: 354242641, \N	      is_bot: false, \N	      first_name: 'Масуд', \N	      username: 'mlibre', \N	      language_code: 'en' \N	    }, \N	    message: { \N	      message_id: 1051, \N	      from: { \N	        id: 7282644891, \N	        is_bot: true, \N	        first_name: 'تبیان - قرآن و تفسیر', \N	        username: 'TebianeBot' \N	      }, \N	      chat: { \N	        id: 354242641, \N	        first_name: 'Масуд', \N	        username: 'mlibre', \N	        type: 'private' \N	      }, \N	      date: 1732468708, \N	      edit_date: 1740855132, \N	      text: ' ٱلْفَاتِحَة 🕊️ فیش های رهبری 📖 ۱:۴\n' + \N	        '🔗 لینک به وب سایت', \N	      reply_markup: { \N	        inline_keyboard: [ \N	          [ \N	            { \N	              text: 'فیش های رهبری', \N	              callback_data: 'DEfB3_@0,1,2,3,4,5,6,3936' \N	            }, \N	            [length]: 1 \N	          ], \N	          [ \N	            { text: '5', callback_data: 'HEfB3_@0,1,2,3,4,5,6,3936' }, \N	            { text: '4', callback_data: 'GEfB3_@0,1,2,3,4,5,6,3936' }, \N	            { text: '3', callback_data: 'FEfB3_@0,1,2,3,4,5,6,3936' }, \N	            { text: '✅ 2', callback_data: 'EEfB3_@0,1,2,3,4,5,6,3936' }, \N	            { text: '1', callback_data: 'DEfB3_@0,1,2,3,4,5,6,3936' }, \N	            [length]: 5 \N	          ], \N	          [ \N	            { \N	              text: 'مطالعه نشده', \N	              callback_data: 'EEfA3_@0,1,2,3,4,5,6,3936' \N	            }, \N	            [length]: 1 \N	          ], \N	          [ \N	            { \N	              text: 'صفحه ی اصلی', \N	              callback_data: 'xEfB3_@0,1,2,3,4,5,6,3936' \N	            }, \N	            [length]: 1 \N	          ], \N	          [length]: 4 \N	        ] \N	      } \N	    }, \N	    chat_instance: '589297763605737593', \N	    data: 'DEfB3_@0,1,2,3,4,5,6,3936' \N	  } \N	}
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
		const searchResult = this.fuse.search( userInput );

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

	async registerWebhook ( requestUrl, suffix )
	{
		const webhookUrl = `${requestUrl.protocol}//${requestUrl.hostname}${suffix}`;
		const response = await this.makeRequest( "setWebhook", {
			url: webhookUrl,
			secret_token: this.secretToken,
			drop_pending_updates: true,
			max_connections: 10,
		});
		return response.ok === true;
	}

	async unRegisterWebhook ()
	{
		const response = await this.makeRequest( "setWebhook", { url: "" });
		return response.ok === true;
	}

	validateWebhookRequest ( secretHeader )
	{
		return !this.secretToken || secretHeader === this.secretToken;
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
