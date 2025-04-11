export default class TelegramClient
{
	constructor ( token, secretToken = null, baseUrl = "https://api.telegram.org" )
	{
		this.token = token;
		this.secretToken = secretToken;
		this.apiBaseUrl = `${baseUrl}/bot${token}`;
	}

	isNetworkError ( error )
	{
		return error.message.includes( "socket hang up" ) ||
           error.message.includes( "network socket disconnected" ) ||
           error.message.includes( "fetch failed" );
	}

	async sleep ( ms )
	{
		await new Promise( resolve => { return setTimeout( resolve, ms ) });
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
		return await this.withRetry(
			() =>
			{
				return this.makeRequest( "sendMessage", {
					chat_id: chatId,
					text: message,
					...options
				})
			},
			options
		);
	}

	async editMessageWithRetry ( message, options = {})
	{
		if ( !options.chat_id || !options.message_id )
		{
			throw new Error( "chat_id and message_id are required for editMessageText" );
		}

		return await this.withRetry(
			() =>
			{
				return this.makeRequest( "editMessageText", {
					text: message,
					...options
				})
			},
			options
		);
	}

	async editMessageReplyMarkupWithRetry ( replyMarkup, options = {})
	{
		if ( !options.chat_id || !options.message_id )
		{
			throw new Error( "chat_id and message_id are required for editMessageReplyMarkup" );
		}

		return await this.withRetry(
			() =>
			{
				return this.makeRequest( "editMessageReplyMarkup", {
					reply_markup: replyMarkup,
					...options
				})
			},
			options
		);
	}

	async setWebhook ( webhookUrl, secretToken = this.secretToken )
	{
		return await this.makeRequest( "setWebhook", {
			url: webhookUrl,
			secret_token: secretToken
		});
	}

	async deleteWebhook ()
	{
		return await this.makeRequest( "setWebhook", { url: "" });
	}

	async handleUpdate ( update )
	{
		if ( "message" in update && update.message.text )
		{
			const { text } = update.message;
			const chatId = update.message.chat.id;

			// Check if the message is asking for resources
			if ( text.startsWith( "/resources" ) )
			{
				await this.sendAllResources( chatId );
				return;
			}

			// Default echo response
			await this.sendMessageWithRetry( chatId, `Echo3:\n${text}` );
		}
	}

	async sendAllResources ( chatId )
	{
		if ( !globalThis.sources )
		{
			await this.sendMessageWithRetry( chatId, "منابع در دسترس نیست" );
			return;
		}

		const resourcesMessage = `\`\`\`text\n${globalThis.sources}\`\`\``;
		await this.sendMessageWithRetry( chatId, resourcesMessage, { parse_mode: "MarkdownV2" });
	}

	validateWebhookRequest ( secretHeader )
	{
		return !this.secretToken || secretHeader === this.secretToken;
	}

	async registerWebhook ( requestUrl, suffix )
	{
		const webhookUrl = `${requestUrl.protocol}//${requestUrl.hostname}${suffix}`;
		const response = await this.setWebhook( webhookUrl );
		return "ok" in response && response.ok;
	}

	async unRegisterWebhook ()
	{
		const response = await this.deleteWebhook();
		return "ok" in response && response.ok;
	}
}
