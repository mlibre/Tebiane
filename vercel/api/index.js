const TelegramClient = require( "../src/telegram" );
const Fuse = require( "fuse.js" );
const path = require( "path" );
const fs = require( "fs" );

const { fuseKeys, sourcesText, quranData } = require( "../src/config" );

// const searchHandler = require( "../src/search" );
// const callbackHandler = require( "../src/callback" );
// const resourcesHandler = require( "../src/resources" );

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

		const telegramClient = new TelegramClient({ fuse });

		console.log( "Acknowledging update:", update.update_id );
		res.status( 200 ).send( "OK" );

	}
	catch ( error )
	{
		console.error( "Error processing update:", error );
		res.status( 500 ).send( "Internal Server Error" );
	}
};
