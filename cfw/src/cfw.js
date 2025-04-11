const Fuse = require( "fuse.js" );
import KVNamespace from "./kvNamespace.js";
// const resources = require( "./resources" );
// const search = require( "./search" );
// const callback = require( "./callback" );

const fuseKeys = [
	{ name: "surah.number", weight: 1 }, // 1
	{ name: "surah.persian_number", weight: 1 }, // ۱
	{ name: "surah.arabic", weight: 1.2 }, // ٱلْفَاتِحَة
	{ name: "surah.farsi", weight: 1.2 }, // فاتحه
	{ name: "ayah", weight: 1.2 }, // 1
	{ name: "ayah_persian", weight: 1.2 }, // ۱
	{ name: "verse.farsi_makarem", weight: 1 },
	{ name: "verse.farsi_ansarian", weight: 1 },
	{ name: "verse.farsi_fooladvand", weight: 1 },
	{ name: "verse.farsi_mojtabavi", weight: 1 },
	{ name: "verse.arabic_clean", weight: 1 }, // بسم الله الرحمن الرحيم
	{ name: "verse.arabic_enhanced", weight: 1 }, // بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
	{ name: "id", weight: 0.05 }, // 1
	{ name: "id_persian", weight: 0.05 }, // ۱
];

const MESSAGE_LENGTH_LIMIT = 2100;
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days for HTML cache
const KV_QURAN_KEY = "quran"; // Key for Quran data in KV
const WEBHOOK = "/endpoint";
const SECRET = "MySecret123";

export default {
	async fetch ( request, env, ctx )
	{
		const kvNamespace = new KVNamespace( env.CFW_TEBIANE ); // Instantiate KVNamespace
		const TOKEN = env.ENV_BOT_TOKEN;

		if ( !TOKEN )
		{
			return new Response( "Bot token not configured", { status: 500 });
		}
		if ( !kvNamespace )
		{
			return new Response( "KV Namespace not configured", { status: 500 });
		}

		// Load Quran data once per worker instance (or fetch if not loaded)
		// Simple in-memory cache for the Quran data within this worker instance
		if ( !globalThis.quranData )
		{
			console.log( "Loading Quran data from KV..." );
			globalThis.quranData = await kvNamespace.getJson( KV_QURAN_KEY );
			if ( !globalThis.quranData )
			{
				console.error( "Failed to load Quran data from KV!" );
				return new Response( "Failed to load Quran data", { status: 500 });
			}
			console.log( `Quran data loaded successfully (${globalThis.quranData.length} verses).` );
		}
		// Use the cached data
		const { quranData } = globalThis;

		const fuseIndex = Fuse.createIndex( fuseKeys, quranData )
		const fuse = new Fuse( quranData, {
			isCaseSensitive: false,
			includeScore: false,
			includeMatches: false,
			useExtendedSearch: false,
			threshold: 0.5,
			keys: fuseKeys
		}, fuseIndex );

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
	return sendPlainText( message.chat.id, `Echo3:\n${ message.text}`, TOKEN );
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


// Specific KV functions replacing database.js
// const getReadStatus = async ( kv, type, chatId, verseRefIndex ) => { return await getKvJson( kv, `${type}_read_${chatId}_${verseRefIndex}` ); };
// const putReadStatus = async ( kv, type, chatId, verseRefIndex ) => { return await putKvJson( kv, `${type}_read_${chatId}_${verseRefIndex}`, true ); }; // Store simple true marker
// const deleteReadStatus = async ( kv, type, chatId, verseRefIndex ) => { return await deleteKv( kv, `${type}_read_${chatId}_${verseRefIndex}` ); };

// const getHtmlCache = async ( kv, url ) => { return await getKvText( kv, `cache_${url}` ); };
// const putHtmlCache = async ( kv, url, html ) => { return await putKvText( kv, `cache_${url}`, html, CACHE_TTL_SECONDS ); };

// --- Web Fetching ---

async function fetchHtmlWithCache ( url, kvNamespace )
{
	const cachedHtml = await getHtmlCache( kvNamespace, url );
	if ( cachedHtml )
	{
		// console.log(`Cache hit for: ${url}`);
		return cachedHtml;
	}

	// console.log(`Cache miss, fetching: ${url}`);
	try
	{
		const response = await fetch( url, {
			headers: { // Add a user-agent to look less like a bot
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
			}
		});
		if ( !response.ok )
		{
			throw new Error( `HTTP error! status: ${response.status} for ${url}` );
		}
		const htmlContent = await response.text();
		const cleanedHtml = htmlContent.replace( /\s+/g, " " ).trim(); // Basic cleaning

		// Store in cache
		await putHtmlCache( kvNamespace, url, cleanedHtml );

		return cleanedHtml;
	}
	catch ( error )
	{
		console.error( `Error fetching HTML from ${url}:`, error );
		throw error; // Re-throw to be handled by caller
	}
}
