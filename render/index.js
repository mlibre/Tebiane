const express = require( "express" );
const cors = require( "cors" );
const TelegramClient = require( "./src/telegram" );
const FlexSearch = require( "flexsearch" );
const util = require( "node:util" );

const { quranData } = require( "./src/config" );

const searchDocument = new FlexSearch.Document({
	tokenize: "strict",
	fastupdate: true,
	encoder: FlexSearch.Charset.LatinExtra,
	resolution: 9,
	cache: 1000,
	document: {
		store: true,
		id: "id",
		index: [
			"verse:arabic_clean",
			"ayah",
			"surah:number",
			"surah:persian_number",
			"surah:arabic",
			"ayah_persian",
			"surah:farsi",
			"verse:farsi_makarem",
			"verse:arabic_enhanced"
		]
	},
});

quranData.forEach( item =>
{
	item.ayah = item.ayah.toString();
	item.surah.number = item.surah.number.toString();
	searchDocument.add( item );
});

const app = express();
app.use( cors() );
app.use( express.json({ limit: "50mb" }) );

const telegramClient = new TelegramClient({ searchIndex: searchDocument });

app.get( "/register_webhook", async ( req, res ) =>
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
});

app.get( "/unregister_webhook", async ( req, res ) =>
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
});

app.post( "/api", async ( req, res ) =>
{
	try
	{
		const update = req.body;
		if ( !update )
		{
			console.error( "Received empty request body" );
			return res.status( 400 ).send( "Bad Request: Empty body" );
		}

		await telegramClient.handleUpdate( update );
		res.status( 200 ).send( "OK" );
	}
	catch ( error )
	{
		console.error( "Error processing update:", error );
		res.status( 500 ).send( "Internal Server Error" );
	}
});

function log ( ...update )
{
	console.log( util.inspect( update, { showHidden: true, depth: null }) );
}

const PORT = process.env.PORT || 3000;
app.listen( PORT, () =>
{
	log( `Server is running on port ${PORT}` );
});