// const TelegramClient = require( "../src/telegram" );
const Fuse = require( "fuse.js" );
const path = require( "path" );
const fs = require( "fs" );

const { token, fuseKeys, appUrl, webhookPath } = require( "../src/config" );

// const searchHandler = require( "../src/search" );
// const callbackHandler = require( "../src/callback" );
// const resourcesHandler = require( "../src/resources" );

let quranData;
let sourcesText;
try
{
	quranData = require( "../sources/quran.json" );
	sourcesText = fs.readFileSync( path.resolve( __dirname, "../sources/sources.txt" ), "utf-8" );
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

// const RedisDatabase = require( "../src/database" );
// const database = new RedisDatabase();
// const databaseClient = await database.connect();
// database.putText( "test key", "test value" );
// await database.getText( "test key" )

// --- Vercel Serverless Function Handler ---
// This is the main function Vercel calls for each incoming request.
module.exports = async ( req, res ) =>
{
	if ( req.query.register_webhook === "true" )
	{
		try
		{
			await registerWebhook();
			return res.status( 200 ).json({ success: true, message: "Webhook setup completed" });
		}
		catch ( error )
		{
			console.error( "Error setting up webhook:", error );
			return res.status( 500 ).json({ success: false, error: error.message });
		}
	}

	else if ( req.query.unregister_webhook === "true" )
	{
		try
		{
			await unRegisterWebhook();
			return res.status( 200 ).json({ success: true, message: "Webhook unregistered" });
		}
		catch ( error )
		{
			console.error( "Error unregistering webhook:", error );
			return res.status( 500 ).json({ success: false, error: error.message });
		}
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

		// Send an immediate success response to Telegram.
		// Telegram needs this quickly, otherwise it might retry the webhook.
		console.log( "Acknowledging update:", update.update_id );
		res.status( 200 ).send( "OK" );

	}
	catch ( error )
	{
		console.error( "Error processing update:", error );
		res.status( 500 ).send( "Internal Server Error" );
	}
};
