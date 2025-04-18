const TelegramClient = require( "../src/telegram" );
const Fuse = require( "fuse.js" );
const path = require( "path" );
const fs = require( "fs" );

const { fuseKeys, sourcesText, quranData } = require( "../src/config" );

const fuseIndex = Fuse.createIndex( fuseKeys, quranData );
const fuse = new Fuse( quranData, {
	isCaseSensitive: false,
	includeScore: false,
	includeMatches: false,
	useExtendedSearch: false,
	ignoreLocation: false,
	threshold: 0.8,
	keys: fuseKeys,
}, fuseIndex );

// --- Vercel Serverless Function Handler ---
// This is the main function Vercel calls for each incoming request.
module.exports = async ( req, res ) =>
{
	console.log( "Incomming request:", req.body, req.params, req.query );
	const telegramClient = new TelegramClient({ fuse });

	if ( req.query.register_webhook === "true" )
	{
		try
		{
			const response = await telegramClient.registerWebhook();
			return res.status( 200 ).json({ success: true, message: "Webhook setup completed", response });
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
			await telegramClient.unRegisterWebhook();
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
		const update = req.body;
		if ( !update )
		{
			console.error( "Received empty request body" );
			return res.status( 400 ).send( "Bad Request: Empty body" );
		}

		await telegramClient.handleUpdate( update );
		console.log( "Acknowledging update:", update );
		res.status( 200 ).send( "OK" );
	}
	catch ( error )
	{
		console.error( "Error processing update:", error );
		res.status( 500 ).send( "Internal Server Error" );
	}
};
