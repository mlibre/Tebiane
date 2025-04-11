const Fuse = require( "fuse.js" );
const util = require( "node:util" );

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
		const token = env.ENV_BOT_TOKEN;

		if ( !token )
		{
			return new Response( "Bot token not configured", { status: 500 });
		}
		globalThis.token = token;
		if ( !kvNamespace )
		{
			return new Response( "KV Namespace not configured", { status: 500 });
		}
		globalThis.kvNamespace = kvNamespace;

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
			return handleWebhook( request, ctx );
		}
		else if ( url.pathname === "/registerWebhook" )
		{
			return registerWebhook( request, url, WEBHOOK );
		}
		else if ( url.pathname === "/unRegisterWebhook" )
		{
			return unRegisterWebhook( );
		}
		else
		{
			return new Response( "No handler for this request" );
		}
	},
};

async function handleWebhook ( request, ctx )
{
	if ( request.headers.get( "X-Telegram-Bot-Api-Secret-Token" ) !== SECRET )
	{
		return new Response( "Unauthorized", { status: 403 });
	}

	const update = await request.json();
	// message: { \N	    message_id: 1130, \N	    from: { \N	      id: 354242641, \N	      is_bot: false, \N	      first_name: 'Масуд', \N	      username: 'mlibre', \N	      language_code: 'en' \N	    }, \N	    chat: { \N	      id: 354242641, \N	      first_name: 'Масуд', \N	      username: 'mlibre', \N	      type: 'private' \N	    }, \N	    date: 1744371005, \N	    text: 'سلام' \N	  } \N	} \N		{ \N	  update_id: 275201116, \N	  callback_query: { \N	    id: '1521460559992070096', \N	    from: { \N	      id: 354242641, \N	      is_bot: false, \N	      first_name: 'Масуд', \N	      username: 'mlibre', \N	      language_code: 'en' \N	    }, \N	    message: { \N	      message_id: 1051, \N	      from: { \N	        id: 7282644891, \N	        is_bot: true, \N	        first_name: 'تبیان - قرآن و تفسیر', \N	        username: 'TebianeBot' \N	      }, \N	      chat: { \N	        id: 354242641, \N	        first_name: 'Масуд', \N	        username: 'mlibre', \N	        type: 'private' \N	      }, \N	      date: 1732468708, \N	      edit_date: 1740855132, \N	      text: ' ٱلْفَاتِحَة 🕊️ فیش های رهبری 📖 ۱:۴\n' + \N	        '🔗 لینک به وب سایت', \N	      reply_markup: { \N	        inline_keyboard: [ \N	          [ \N	            { \N	              text: 'فیش های رهبری', \N	              callback_data: 'DEfB3_@0,1,2,3,4,5,6,3936' \N	            }, \N	            [length]: 1 \N	          ], \N	          [ \N	            { text: '5', callback_data: 'HEfB3_@0,1,2,3,4,5,6,3936' }, \N	            { text: '4', callback_data: 'GEfB3_@0,1,2,3,4,5,6,3936' }, \N	            { text: '3', callback_data: 'FEfB3_@0,1,2,3,4,5,6,3936' }, \N	            { text: '✅ 2', callback_data: 'EEfB3_@0,1,2,3,4,5,6,3936' }, \N	            { text: '1', callback_data: 'DEfB3_@0,1,2,3,4,5,6,3936' }, \N	            [length]: 5 \N	          ], \N	          [ \N	            { \N	              text: 'مطالعه نشده', \N	              callback_data: 'EEfA3_@0,1,2,3,4,5,6,3936' \N	            }, \N	            [length]: 1 \N	          ], \N	          [ \N	            { \N	              text: 'صفحه ی اصلی', \N	              callback_data: 'xEfB3_@0,1,2,3,4,5,6,3936' \N	            }, \N	            [length]: 1 \N	          ], \N	          [length]: 4 \N	        ] \N	      } \N	    }, \N	    chat_instance: '589297763605737593', \N	    data: 'DEfB3_@0,1,2,3,4,5,6,3936' \N	  } \N	}
	log( update );
	ctx.waitUntil( onUpdate( update ) );
	return new Response( "Ok" );
}

/**
 * Handle incoming Update
 * https://core.telegram.org/bots/api#update
 */
async function onUpdate ( update )
{
	if ( "message" in update )
	{
		await sendPlainText( update.message.chat.id, `Echo3:\n${ update.message.text}` );
	}
}

/**
 * Send plain text message
 * https://core.telegram.org/bots/api#sendmessage
 */
async function sendPlainText ( chatId, text )
{
	return ( await fetch( apiUrl( "sendMessage", {
		chat_id: chatId,
		text,
	}, globalThis.token ) ) ).json();
}

/**
 * Set webhook to this worker's url
 * https://core.telegram.org/bots/api#setwebhook
 */
async function registerWebhook ( request, requestUrl, suffix )
{
	const webhookUrl = `${requestUrl.protocol}//${requestUrl.hostname}${suffix}`;
	const r = await ( await fetch( apiUrl( "setWebhook", { url: webhookUrl, secret_token: SECRET }, globalThis.token ) ) ).json();
	return new Response( "ok" in r && r.ok ? "Ok" : JSON.stringify( r, null, 2 ) );
}

/**
 * Remove webhook
 * https://core.telegram.org/bots/api#setwebhook
 */
async function unRegisterWebhook ( )
{
	const r = await ( await fetch( apiUrl( "setWebhook", { url: "" }, globalThis.token ) ) ).json();
	return new Response( "ok" in r && r.ok ? "Ok" : JSON.stringify( r, null, 2 ) );
}

/**
 * Return url to telegram api, optionally with parameters added
 */
function apiUrl ( methodName, params = null )
{
	let query = "";
	if ( params )
	{
		query = `?${ new URLSearchParams( params ).toString()}`;
	}
	return `https://api.telegram.org/bot${globalThis.token}/${methodName}${query}`;
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

function log ( update )
{
	console.log( util.inspect( update, { showHidden: true, depth: null }) );
}