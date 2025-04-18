const TelegramBot = require( "node-telegram-bot-api" );
const Fuse = require( "fuse.js" );
const path = require( "path" );
const fs = require( "fs" );

const { token, fuseKeys } = require( "../src/config" );

// const searchHandler = require( "../src/search" );
// const callbackHandler = require( "../src/callback" );
// const resourcesHandler = require( "../src/resources" );

let quranData;
let sourcesText;
try
{
	quranData = require( "../src/sources/quran.json" );
	sourcesText = fs.readFileSync( path.resolve( __dirname, "../src/sources/sources.txt" ), "utf-8" );
}
catch ( error )
{
	console.error( "FATAL: Could not load quran.json or sources.txt", error );
	throw error;
}


const fuseIndex = Fuse.createIndex( fuseKeys, quranData );
const fuse = new Fuse( quranData, {
	isCaseSensitive: false,
	includeScore: false,
	includeMatches: false,
	useExtendedSearch: false,
	ignoreLocation: true,
	threshold: 0.8,
	keys: fuseKeys,
}, fuseIndex );

const bot = new TelegramBot( token );

// --- Bot Event Handlers ---
// These listeners are attached once when the serverless function initializes.
// They will be triggered by bot.processUpdate(update) below.

// Handle /search command explicitly
bot.onText( /\/search(?: (.+))?/, async ( msg, match ) =>
{
	const query = match[1] || msg.text.replace( "/search", "" ).trim(); // Get query or text after command
	if ( query )
	{
		console.log( `Handling /search for chat ${msg.chat.id} with query: ${query}` );
		try
		{
			// await searchHandler( bot, fuse, query, msg.chat.id, msg.message_id );
		}
		catch ( error )
		{
			console.error( `Error in searchHandler for chat ${msg.chat.id}:`, error );
			// Optionally send an error message to the user
			// await bot.sendMessage(msg.chat.id, "Sorry, an error occurred during search.");
		}
	}
	else
	{
		console.log( `Handling /search for chat ${msg.chat.id} with no query.` );
		await bot.sendMessage( msg.chat.id, "Please provide a search term after /search, like `/search بسم الله`" );
	}
});

// Handle /resources command
bot.onText( /\/resources/, async ( msg ) =>
{
	console.log( `Handling /resources for chat ${msg.chat.id}` );
	try
	{
		// await resourcesHandler( bot, msg );
	}
	catch ( error )
	{
		console.error( `Error in resourcesHandler for chat ${msg.chat.id}:`, error );
	}
});

// Handle regular messages (treat as search)
bot.on( "message", async ( msg ) =>
{
	// Ignore commands already handled
	if ( msg.text && ( msg.text.startsWith( "/search" ) || msg.text.startsWith( "/resources" ) || msg.text.startsWith( "/start" ) ) )
	{
		return;
	}
	// Ignore messages without text
	if ( !msg.text )
	{
		return;
	}

	console.log( `Handling message as search for chat ${msg.chat.id}: ${msg.text.substring( 0, 50 )}...` );
	try
	{
		// await searchHandler( bot, fuse, msg.text, msg.chat.id, msg.message_id );
	}
	catch ( error )
	{
		console.error( `Error in message searchHandler for chat ${msg.chat.id}:`, error );
	}
});

// Handle button callbacks
bot.on( "callback_query", async ( callbackQuery ) =>
{
	const { data, message } = callbackQuery;
	const chatId = message.chat.id;
	const messageId = message.message_id;
	console.log( `Handling callback_query for chat ${chatId}, message ${messageId}, data: ${data}` );

	try
	{
		// await callbackHandler( bot, data, chatId, messageId );
	}
	catch ( error )
	{
		console.error( `Error in callbackHandler for chat ${chatId}, message ${messageId}:`, error );
		// Optionally send an error message or answer the callback query with an error
	}
	finally
	{
		// IMPORTANT: Always answer the callback query to remove the loading state
		try
		{
			await bot.answerCallbackQuery( callbackQuery.id );
		}
		catch ( answerError )
		{
			// Ignore errors here if the main handler already failed, but log them
			console.error( `Error answering callback query ${callbackQuery.id}:`, answerError );
		}
	}
});

// Handle webhook errors
bot.on( "webhook_error", ( error ) =>
{
	console.error( "Webhook error:", error.message || error );
});

// --- Vercel Serverless Function Handler ---
// This is the main function Vercel calls for each incoming request.
module.exports = async ( req, res ) =>
{
	if ( req.method !== "POST" )
	{
		console.log( "Received non-POST request" );
		return res.status( 405 ).send( "Method Not Allowed" );
	}

	try
	{
		// The request body should contain the Telegram update JSON
		const update = req.body;
		if ( !update )
		{
			console.error( "Received empty request body" );
			return res.status( 400 ).send( "Bad Request: Empty body" );
		}

		console.log( "Processing update:", update.update_id );

		// Process the update using the bot instance.
		// This triggers the .on() handlers we defined above.
		// It does NOT block the response.
		bot.processUpdate( update );

		// Send an immediate success response to Telegram.
		// Telegram needs this quickly, otherwise it might retry the webhook.
		console.log( "Acknowledging update:", update.update_id );
		res.status( 200 ).send( "OK" );

	}
	catch ( error )
	{
		console.error( "Error processing update:", error );
		// Send an error response, but Telegram might ignore it if it's too late.
		// The main goal is to acknowledge quickly. Logging is key.
		res.status( 500 ).send( "Internal Server Error" );
	}
};

// --- Webhook Setup (Optional but Recommended) ---
// You can run this logic once, e.g., in a separate script or manually.
// Or, include it here to run on first deployment/invocation (less ideal).
// Vercel provides the VERCEL_URL env var automatically in deployment.
const APP_URL = process.env.VERCEL_URL; // Provided by Vercel
const WEBHOOK_PATH = "/api"; // Path to this serverless function

async function setupWebhook ()
{
	if ( !APP_URL )
	{
		console.warn( "VERCEL_URL not set. Skipping webhook setup." );
		return;
	}
	const webhookUrl = `https://${APP_URL}${WEBHOOK_PATH}`;
	try
	{
		const currentWebhook = await bot.getWebHookInfo();
		if ( currentWebhook.url !== webhookUrl )
		{
			console.log( `Setting webhook to: ${webhookUrl}` );
			await bot.setWebHook( webhookUrl, {
				// drop_pending_updates: true // Optional: drop old updates
			});
			console.log( "Webhook set successfully." );
		}
		else
		{
			console.log( "Webhook already set correctly." );
		}
	}
	catch ( error )
	{
		console.error( "Error setting/checking webhook:", error );
	}
}

// Call setupWebhook() only if needed, e.g., during a build step or manually.
// Running it on every invocation is inefficient.
// setupWebhook(); // Uncomment cautiously or run separately.