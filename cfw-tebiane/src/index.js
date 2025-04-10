/**
 * Telegram Bot Cloudflare Worker
 * https://github.com/cvzi/telegram-bot-cloudflare
 */

const WEBHOOK = "/endpoint";
const SECRET = "MySecret123";

export default {
	async fetch ( request, env, ctx )
	{
		const TOKEN = env.ENV_BOT_TOKEN;
		const url = new URL( request.url );

		if ( url.pathname === WEBHOOK )
		{
			return handleWebhook( request, TOKEN, SECRET, ctx );
		}
		else if ( url.pathname === "/registerWebhook" )
		{
			return registerWebhook( request, url, WEBHOOK, SECRET, TOKEN );
		}
		else if ( url.pathname === "/unRegisterWebhook" )
		{
			return unRegisterWebhook( TOKEN );
		}
		else
		{
			return new Response( "No handler for this request" );
		}
	},
};

/**
 * Handle requests to WEBHOOK
 * https://core.telegram.org/bots/api#update
 */
async function handleWebhook ( request, TOKEN, SECRET, ctx )
{
	if ( request.headers.get( "X-Telegram-Bot-Api-Secret-Token" ) !== SECRET )
	{
		return new Response( "Unauthorized", { status: 403 });
	}

	const update = await request.json();
	ctx.waitUntil( onUpdate( update, TOKEN ) );

	return new Response( "Ok" );
}

/**
 * Handle incoming Update
 * https://core.telegram.org/bots/api#update
 */
async function onUpdate ( update, TOKEN )
{
	if ( "message" in update )
	{
		await onMessage( update.message, TOKEN );
	}
}

/**
 * Handle incoming Message
 * https://core.telegram.org/bots/api#message
 */
function onMessage ( message, TOKEN )
{
	return sendPlainText( message.chat.id, `Echo:\n${ message.text}`, TOKEN );
}

/**
 * Send plain text message
 * https://core.telegram.org/bots/api#sendmessage
 */
async function sendPlainText ( chatId, text, TOKEN )
{
	return ( await fetch( apiUrl( "sendMessage", {
		chat_id: chatId,
		text,
	}, TOKEN ) ) ).json();
}

/**
 * Set webhook to this worker's url
 * https://core.telegram.org/bots/api#setwebhook
 */
async function registerWebhook ( request, requestUrl, suffix, secret, TOKEN )
{
	const webhookUrl = `${requestUrl.protocol}//${requestUrl.hostname}${suffix}`;
	const r = await ( await fetch( apiUrl( "setWebhook", { url: webhookUrl, secret_token: secret }, TOKEN ) ) ).json();
	return new Response( "ok" in r && r.ok ? "Ok" : JSON.stringify( r, null, 2 ) );
}

/**
 * Remove webhook
 * https://core.telegram.org/bots/api#setwebhook
 */
async function unRegisterWebhook ( TOKEN )
{
	const r = await ( await fetch( apiUrl( "setWebhook", { url: "" }, TOKEN ) ) ).json();
	return new Response( "ok" in r && r.ok ? "Ok" : JSON.stringify( r, null, 2 ) );
}

/**
 * Return url to telegram api, optionally with parameters added
 */
function apiUrl ( methodName, params = null, TOKEN )
{
	let query = "";
	if ( params )
	{
		query = `?${ new URLSearchParams( params ).toString()}`;
	}
	return `https://api.telegram.org/bot${TOKEN}/${methodName}${query}`;
}
