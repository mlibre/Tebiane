/**
 * Cloudflare Worker for Tebiane Telegram Bot
 *
 * This single file contains the entire logic for the bot, adapted from the original Node.js project.
 * It uses Cloudflare KV for storing Quran data and caching, and relies on native fetch for API calls.
 * It implements simplified versions of search and HTML parsing due to CFW limitations and library restrictions.
 */

// --- Configuration ---
const WEBHOOK = "/endpoint";
const SECRET = "MySecret123"; // This should match the secret token set with Telegram

// Action codes for callback data (shortened for brevity)
const actionCodes = {
	nextResult: "a",
	prevResult: "b",
	ansarian: "c",
	fooladvand: "d",
	mojtabavi: "e",
	makarem: "f",
	arabicText: "g",
	arabicIrabText: "h",
	nextVerse: "i",
	prevVerse: "j",
	tafsirNemooneh: ["k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w"], // Max 13 parts for Tafsir
	mainPage: "x",
	hasRead: "y", // Not actively used in this simplified version's state tracking
	hasNotRead: "z", // Not actively used
	toggleRead: "A", // Used for marking interpretations as read/unread
	others: "B", // Placeholder in callback data structure
	saanNuzul: "C",
	khamenei: ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q"], // Max 14 parts for Khamenei
};

// Translation mapping
const perian_translations = {
	[actionCodes.ansarian]: { farsi: "انصاریان", key: "farsi_ansarian" },
	[actionCodes.fooladvand]: { farsi: "فولادوند", key: "farsi_fooladvand" },
	[actionCodes.mojtabavi]: { farsi: "مجتبوی", key: "farsi_mojtabavi" },
	[actionCodes.makarem]: { farsi: "مکارم شیرازی", key: "farsi_makarem" },
};

const arabic_texts = {
	[actionCodes.arabicText]: { farsi: "عربی ساده", key: "arabic_clean" },
	[actionCodes.arabicIrabText]: { farsi: "عربی با اعراب", key: "arabic_enhanced" },
};

const all_translations = { ...perian_translations, ...arabic_texts };

// Other constants
const MESSAGE_LENGTH_LIMIT = 4000; // Reduced slightly from Telegram max 4096 for safety
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days for HTML cache
const KV_QURAN_KEY = "quran"; // Key for Quran data in KV

// --- Text Helpers ---

const PERSIAN_NUMBERS_MAP = {
	"0": "۰", "1": "۱", "2": "۲", "3": "۳", "4": "۴",
	"5": "۵", "6": "۶", "7": "۷", "8": "۸", "9": "۹"
};

function toPersian ( text )
{
	if ( !text ) return "";
	return text
	.toString()
	.split( "" )
	.map( char => { return PERSIAN_NUMBERS_MAP[char] || char })
	.join( "" );
}

// Escapes characters for Telegram MarkdownV2
function escapeMarkdownV2 ( text )
{
	if ( !text ) return "";
	// Escape characters: _ * [ ] ( ) ~ ` > # + - = | { } . !
	// Note: We handle *bold* conversion separately in normalizeMessage
	return text.replace( /([_*\[\]()~`>#+\-=|{}.!])/g, "\\$1" );
}

// Normalizes messages for Telegram: applies Markdown and Persian numbers
function normalizeMessage ( message )
{
	if ( !message ) return "";
	// First, escape everything
	let escapedMessage = escapeMarkdownV2( message );

	// Then, selectively un-escape and apply our custom bold markers
	// Using a simple placeholder approach to avoid complex regex with escaped chars
	const BOLD_MARKER_START = "@@BOLD_START@@";
	const BOLD_MARKER_END = "@@BOLD_END@@";
	escapedMessage = escapedMessage.replace( /\\?\*([^\*]+?)\\?\*/g, `${BOLD_MARKER_START}$1${BOLD_MARKER_END}` );

	// Now replace placeholders with actual Markdown V2 bold
	escapedMessage = escapedMessage.replace( new RegExp( BOLD_MARKER_START, "g" ), "*" );
	escapedMessage = escapedMessage.replace( new RegExp( BOLD_MARKER_END, "g" ), "*" );

	// Convert numbers to Persian
	return toPersian( escapedMessage );
}


// Extracts verse information using the globally available `quranData`
function extractInfoByRefIndex ( refIndex, quranData )
{
	if ( !quranData || refIndex < 0 || refIndex >= quranData.length )
	{
		console.error( `Invalid refIndex or quranData for extractInfoByRefIndex: ${refIndex}` );
		return { // Return default/empty values to prevent crashes downstream
			currentSurahTitle: "N/A",
			currentSurahTitlePersian: "N/A",
			currentSurahNumber: 0,
			currentSurahPersianNumber: "۰",
			currentAyahNumber: 0,
			currentAyahPersianNumber: "۰"
		};
	}
	const verse = quranData[refIndex];
	return {
		currentSurahTitle: verse.surah.arabic,
		currentSurahTitlePersian: verse.surah.farsi,
		currentSurahNumber: verse.surah.number,
		currentSurahPersianNumber: verse.surah.persian_number,
		currentAyahNumber: verse.ayah,
		currentAyahPersianNumber: verse.ayah_persian
	};
}

// --- Simple HTML Parsing / Content Extraction ---
// Replaces Cheerio/Readability/JSDOM with basic string manipulation and regex.
// WARNING: These are fragile and highly dependent on the target website structure.

function simpleHtmlToText ( html )
{
	if ( !html ) return "";
	// Remove script and style elements
	let text = html.replace( /<script[^>]*>([\S\s]*?)<\/script>/gmi, "" );
	text = text.replace( /<style[^>]*>([\S\s]*?)<\/style>/gmi, "" );
	// Remove HTML comments
	text = text.replace( /<!--.*?-->/gs, "" );
	// Replace <br> and <p> tags with newlines
	text = text.replace( /<br\s*\/?>/gi, "\n" );
	text = text.replace( /<\/p>/gi, "\n" );
	// Remove remaining HTML tags
	text = text.replace( /<[^>]+>/g, "" );
	// Decode HTML entities
	text = text.replace( / /g, " " );
	text = text.replace( /&/g, "&" );
	text = text.replace( /</g, "<" );
	text = text.replace( />/g, ">" );
	text = text.replace( /"/g, "\"" );
	text = text.replace( /'/g, "'" );
	// Normalize whitespace
	text = text.replace( /\s+/g, " " ).trim();
	text = text.replace( /\n\s*\n/g, "\n\n" ); // Consolidate multiple newlines
	return text;
}

// Specific extractor for Ahlolbait Wiki Saan Nuzul
function extractSaanNuzulContent ( html )
{
	const startMarker = /<span class="mw-headline" id="نزول">نزول<\/span><\/h2>/i;
	const endMarker = /<h2><span class="mw-headline"/i; // Next H2 tag

	const startIndex = html.search( startMarker );
	if ( startIndex === -1 ) return null; // "نزول" section not found

	const contentStartIndex = html.indexOf( "</h2>", startIndex ) + 5;
	let contentEndIndex = html.indexOf( "<h2>", contentStartIndex );
	if ( contentEndIndex === -1 )
	{ // If no next H2, take content to the end (might need refinement)
		contentEndIndex = html.length;
	}

	const sectionHtml = html.substring( contentStartIndex, contentEndIndex );

	// Extract text primarily from <p> tags within the section
	const paragraphs = [];
	const pRegex = /<p>(.*?)<\/p>/gis;
	let match;
	while ( ( match = pRegex.exec( sectionHtml ) ) !== null )
	{
		paragraphs.push( simpleHtmlToText( match[1] ) );
	}

	return paragraphs.length > 0 ? paragraphs.join( "\n\n" ) : simpleHtmlToText( sectionHtml ); // Fallback if no <p>
}

// Specific extractor for Makarem Tafsir
function extractTafsirNemunehContent ( html )
{
	// Try to find the main content div (assuming class="page" or similar)
	// This is highly fragile. Let's assume a simpler structure or just extract all text.
	// A more robust (but still limited) approach: find known header patterns
	const contentRegex = /<div[^>]+class="page"[^>]*>([\s\S]*?)<\/div>/i; // Example, adjust class if needed
	let mainContentHtml = html;
	const contentMatch = html.match( contentRegex );
	if ( contentMatch && contentMatch[1] )
	{
		mainContentHtml = contentMatch[1];
	}
	else
	{
		// Fallback: try extracting from body if specific div not found
		const bodyMatch = html.match( /<body[^>]*>([\s\S]*?)<\/body>/i );
		if ( bodyMatch && bodyMatch[1] )
		{
			mainContentHtml = bodyMatch[1];
		}
	}


	// Extract text from relevant tags like p, h3, h6
	const extractedParts = [];
	// Regex to capture content within p, h3, h6 tags
	const tagRegex = /<(p|h3|h6)[^>]*>([\s\S]*?)<\/\1>/gi;
	let match;
	while ( ( match = tagRegex.exec( mainContentHtml ) ) !== null )
	{
		const tagName = match[1].toLowerCase();
		const content = simpleHtmlToText( match[2] );
		if ( content )
		{
			if ( tagName === "h3" || tagName === "h6" )
			{
				extractedParts.push( `*${content}*` ); // Mark headers as bold
			}
			else
			{ // tagName === 'p'
				extractedParts.push( content );
			}
		}
	}

	if ( extractedParts.length > 0 )
	{
		return extractedParts.join( "\n\n" );
	}
	else
	{
		// Fallback if no specific tags found, just clean the whole content block
		return simpleHtmlToText( mainContentHtml );
	}
}

// Specific extractor for Khamenei Fiches
function extractKhameneiContent ( html )
{
	// Try to find the main content div (e.g., id="npTL")
	const contentRegex = /<div[^>]+id="npTL"[^>]*>([\s\S]*?)<\/div>/i; // Example, adjust ID if needed
	let mainContentHtml = html;
	const contentMatch = html.match( contentRegex );
	if ( contentMatch && contentMatch[1] )
	{
		mainContentHtml = contentMatch[1];
	}
	else
	{
		// Fallback: try extracting from body
		const bodyMatch = html.match( /<body[^>]*>([\s\S]*?)<\/body>/i );
		if ( bodyMatch && bodyMatch[1] )
		{
			mainContentHtml = bodyMatch[1];
		}
	}

	// Simulate the original logic's replacements using string manipulation
	// This is extremely fragile without a DOM
	let text = mainContentHtml;

	// 1. Mark potential headers (often in <header> tags, or maybe specific classes)
	//    Let's assume headers are followed by <p> or are the first significant text block.
	//    This is a guess. We'll mark lines that look like titles (short, maybe bolded in original).
	//    The original code used `header` tags. Let's try to find those.
	text = text.replace( /<header[^>]*>([\s\S]*?)<\/header>/gi, ( _, headerContent ) => { return `\n*${simpleHtmlToText( headerContent )}*\n`; });

	// 2. Replace <hr> with a marker for the footer/references section
	text = text.replace( /<hr[^>]*>/gi, "\n--- References ---\n" );

	// 3. Convert paragraphs and breaks to newlines
	text = text.replace( /<br\s*\/?>/gi, "\n" );
	text = text.replace( /<\/p>/gi, "\n" );

	// 4. Clean remaining tags and normalize
	text = simpleHtmlToText( text ); // Use the general cleaner

	return text;
}


// --- Simple Search Implementation ---
// Replaces Fuse.js with basic substring matching.

function simpleSearch ( query, quranData, keysToSearch )
{
	if ( !query || !quranData || !keysToSearch ) return [];

	const normalizedQuery = query.toLowerCase().trim();
	// Simple approach: check if the entire query is a substring in any key field
	// More advanced: split query into words and check if *all* words are present.
	const queryWords = normalizedQuery.split( /\s+/ ).filter( w => { return w.length > 0 });

	const results = [];

	for ( let i = 0; i < quranData.length; i++ )
	{
		const item = quranData[i];
		let matchFound = false;

		// Check direct match for Surah:Ayah format (e.g., "2:15", "۲:۱۵")
		const surahAyahMatch = normalizedQuery.match( /^(\d{1,3})[:\s](\d{1,3})$/ );
		const surahAyahPersianMatch = query.match( /^([۰-۹]{1,3})[:\s]([۰-۹]{1,3})$/ ); // Use original query for Persian nums

		if ( surahAyahMatch )
		{
			if ( item.surah.number == parseInt( surahAyahMatch[1] ) && item.ayah == parseInt( surahAyahMatch[2] ) )
			{
				matchFound = true;
				// Give exact matches a higher score implicitly by adding them first? Or add a score property.
				// For simplicity, just mark as found.
			}
		}
		else if ( surahAyahPersianMatch )
		{
			const persianToArabic = ( pNum ) => { return Object.keys( PERSIAN_NUMBERS_MAP ).find( key => { return PERSIAN_NUMBERS_MAP[key] === pNum }) || ""; };
			const pSurah = toPersian( surahAyahPersianMatch[1] ); // Ensure consistent Persian format
			const pAyah = toPersian( surahAyahPersianMatch[2] );
			if ( item.surah.persian_number == pSurah && item.ayah_persian == pAyah )
			{
				matchFound = true;
			}
		}
		else
		{
			// Check general substring match across specified fields
			let wordsMatchedCount = 0;
			for ( const keyData of keysToSearch )
			{
				const keyPath = keyData.name.split( "." );
				let value = item;
				for ( const part of keyPath )
				{
					value = value ? value[part] : undefined;
				}

				if ( typeof value === "string" || typeof value === "number" )
				{
					const normalizedValue = value.toString().toLowerCase();

					// Check if *all* query words are substrings in this field
					let fieldMatchesAllWords = true;
					for ( const word of queryWords )
					{
						if ( !normalizedValue.includes( word ) )
						{
							fieldMatchesAllWords = false;
							break;
						}
					}
					if ( fieldMatchesAllWords )
					{
						matchFound = true;
						break; // Found a match in one field, no need to check others for this item
					}

					// Alternative: Check if *any* query word matches (looser search)
					// for (const word of queryWords) {
					//   if (normalizedValue.includes(word)) {
					//     matchFound = true;
					//     break; // Exit inner loop (words)
					//   }
					// }
					// if (matchFound) break; // Exit outer loop (keys)
				}
			}
		}


		if ( matchFound )
		{
			// Add refIndex for compatibility with original structure
			results.push({ item, refIndex: i, score: 0.5 }); // Add a dummy score
		}
	}

	// Simple sorting: exact surah:ayah matches might implicitly be found faster if checked first.
	// A real scoring system would be better.
	// Limit results? The original sliced at 8.
	return results.slice( 0, 8 );
}

// Define the keys to search (similar to Fuse.js keys)
const searchKeys = [
	{ name: "surah.number" },
	{ name: "surah.persian_number" },
	{ name: "surah.arabic" },
	{ name: "surah.farsi" },
	{ name: "ayah" },
	{ name: "ayah_persian" },
	{ name: "verse.farsi_makarem" },
	{ name: "verse.farsi_ansarian" },
	{ name: "verse.farsi_fooladvand" },
	{ name: "verse.farsi_mojtabavi" },
	{ name: "verse.arabic_clean" },
	{ name: "verse.arabic_enhanced" },
	{ name: "id" },
	{ name: "id_persian" },
];


// --- Telegram API Helpers ---

/**
 * Generates the URL for a Telegram Bot API method.
 */
function apiUrl ( methodName, params = null, token )
{
	let query = "";
	if ( params )
	{
		// Filter out null/undefined params
		const filteredParams = Object.fromEntries( Object.entries( params ).filter( ( [_, v] ) => { return v != null }) );
		query = `?${new URLSearchParams( filteredParams ).toString()}`;
	}
	return `https://api.telegram.org/bot${token}/${methodName}${query}`;
}

/**
 * Sends a POST request to the Telegram API.
 */
async function sendTelegramRequest ( methodName, payload, token )
{
	try
	{
		const url = apiUrl( methodName, null, token );
		const response = await fetch( url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify( payload ),
		});
		const result = await response.json();
		if ( !result.ok )
		{
			console.error( `Telegram API Error (${methodName}): ${result.description || JSON.stringify( result )}` );
			// Throw an error that includes the description if possible
			const error = new Error( `Telegram API Error: ${result.description || "Unknown error"}` );
			error.result = result;
			throw error;
		}
		return result;
	}
	catch ( error )
	{
		console.error( `Error sending Telegram request (${methodName}):`, error );
		// Re-throw the error so callers can handle it (e.g., retry logic)
		throw error;
	}
}

// Simple retry mechanism
async function withRetry ( operation, retries = 3, delay = 200 )
{
	for ( let i = 0; i < retries; i++ )
	{
		try
		{
			return await operation();
		}
		catch ( error )
		{
			// Only retry network-like errors (fetch failures, timeouts - harder to detect precisely in CFW)
			// Or specific Telegram errors like "Too Many Requests" (429)
			const isRetryable = error.message.includes( "fetch" ) || // Generic fetch failure
				 error.result && error.result.error_code === 429 ; // Telegram rate limit

			if ( isRetryable && i < retries - 1 )
			{
				console.log( `Retrying Telegram API call (${i + 1}/${retries})... Error: ${error.message}` );
				await new Promise( resolve => { return setTimeout( resolve, delay * ( i + 1 ) ) }); // Exponential backoff
			}
			else
			{
				console.error( `Telegram API call failed after ${retries} attempts.` );
				throw error; // Final failure
			}
		}
	}
}


async function sendTextMessage ( chatId, text, options, token )
{
	const payload = {
		chat_id: chatId,
		text,
		parse_mode: "MarkdownV2", // Default parse mode
		...options, // Allow overriding parse_mode, adding reply_markup, etc.
	};
	return await withRetry( () => { return sendTelegramRequest( "sendMessage", payload, token ) });
}

async function editMessageText ( chatId, messageId, text, options, token )
{
	const payload = {
		chat_id: chatId,
		message_id: messageId,
		text,
		parse_mode: "MarkdownV2",
		...options,
	};
	// Don't retry edits aggressively, as the message might have changed.
	try
	{
		return await sendTelegramRequest( "editMessageText", payload, token );
	}
	catch ( error )
	{
		// Ignore errors like "message is not modified"
		if ( error.result && error.result.error_code === 400 && error.result.description.includes( "message is not modified" ) )
		{
			console.log( "Ignoring 'message is not modified' error." );
			return { ok: true, result: null }; // Simulate success
		}
		// Ignore errors editing already deleted messages
		if ( error.result && error.result.error_code === 400 && error.result.description.includes( "message to edit not found" ) )
		{
			console.log( "Ignoring 'message to edit not found' error." );
			return { ok: true, result: null }; // Simulate success
		}
		throw error; // Re-throw other errors
	}
}

async function editMessageReplyMarkup ( chatId, messageId, replyMarkup, token )
{
	const payload = {
		chat_id: chatId,
		message_id: messageId,
		reply_markup: replyMarkup, // replyMarkup should be { inline_keyboard: [...] }
	};
	try
	{
		return await sendTelegramRequest( "editMessageReplyMarkup", payload, token );
	}
	catch ( error )
	{
		if ( error.result && error.result.error_code === 400 && error.result.description.includes( "message is not modified" ) )
		{
			console.log( "Ignoring 'message is not modified' error for reply markup." );
			return { ok: true, result: null };
		}
		if ( error.result && error.result.error_code === 400 && error.result.description.includes( "message to edit not found" ) )
		{
			console.log( "Ignoring 'message to edit not found' error for reply markup." );
			return { ok: true, result: null };
		}
		throw error;
	}
}

async function answerCallbackQuery ( callbackQueryId, options, token )
{
	const payload = {
		callback_query_id: callbackQueryId,
		...options, // e.g., { text: "...", show_alert: false }
	};
	// Don't retry answers, they are less critical
	try
	{
		return await sendTelegramRequest( "answerCallbackQuery", payload, token );
	}
	catch ( error )
	{
		console.error( "Failed to answer callback query:", error );
		// Don't throw, just log
	}
}


// --- KV Store Helpers ---

async function getKvJson ( kvNamespace, key )
{
	try
	{
		return await kvNamespace.get( key, "json" );
	}
	catch ( e )
	{
		console.error( `Error getting JSON from KV (${key}):`, e );
		return null;
	}
}

async function getKvText ( kvNamespace, key )
{
	try
	{
		return await kvNamespace.get( key, "text" );
	}
	catch ( e )
	{
		console.error( `Error getting text from KV (${key}):`, e );
		return null;
	}
}


async function putKvJson ( kvNamespace, key, value, ttl = null )
{
	try
	{
		const options = ttl ? { expirationTtl: ttl } : {};
		await kvNamespace.put( key, JSON.stringify( value ), options );
	}
	catch ( e )
	{
		console.error( `Error putting JSON to KV (${key}):`, e );
	}
}

async function putKvText ( kvNamespace, key, value, ttl = null )
{
	try
	{
		const options = ttl ? { expirationTtl: ttl } : {};
		await kvNamespace.put( key, value, options );
	}
	catch ( e )
	{
		console.error( `Error putting text to KV (${key}):`, e );
	}
}

async function deleteKv ( kvNamespace, key )
{
	try
	{
		await kvNamespace.delete( key );
	}
	catch ( e )
	{
		console.error( `Error deleting from KV (${key}):`, e );
	}
}

// Specific KV functions replacing database.js
const getReadStatus = async ( kv, type, chatId, verseRefIndex ) => { return await getKvJson( kv, `${type}_read_${chatId}_${verseRefIndex}` ); };
const putReadStatus = async ( kv, type, chatId, verseRefIndex ) => { return await putKvJson( kv, `${type}_read_${chatId}_${verseRefIndex}`, true ); }; // Store simple true marker
const deleteReadStatus = async ( kv, type, chatId, verseRefIndex ) => { return await deleteKv( kv, `${type}_read_${chatId}_${verseRefIndex}` ); };

const getHtmlCache = async ( kv, url ) => { return await getKvText( kv, `cache_${url}` ); };
const putHtmlCache = async ( kv, url, html ) => { return await putKvText( kv, `cache_${url}`, html, CACHE_TTL_SECONDS ); };

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


// --- Interpretation Logic ---

// Base function for generating interpretation messages
async function generateInterpretationMessage ( verseRefIndex, part, options, quranData, kvNamespace )
{
	const {
		fetchUrlFunc,
		extractContentFunc,
		cacheKeyPrefix, // Not used directly here, fetchHtmlWithCache handles it
		title,
		notFoundMessage,
		sourceLinkText,
		calculateTotalPartsFunc, // Function to calculate total parts
	} = options;

	const { currentSurahTitle, currentSurahNumber, currentSurahPersianNumber,
		currentAyahNumber, currentAyahPersianNumber } = extractInfoByRefIndex( verseRefIndex, quranData );

	const url = fetchUrlFunc( currentSurahNumber, currentAyahNumber );
	const headerText = `> ${currentSurahTitle} 🕊️ ${title} 📖 ${currentSurahPersianNumber}:${currentAyahPersianNumber}`;
	const linkText = `[🔗 ${sourceLinkText}](${url})`;

	try
	{
		const html = await fetchHtmlWithCache( url, kvNamespace );
		if ( !html )
		{
			return normalizeMessage( `${headerText}\n\n${notFoundMessage}\n\n${linkText}` );
		}

		const fullContent = extractContentFunc( html );
		if ( !fullContent || fullContent.trim() === "" )
		{
			return normalizeMessage( `${headerText}\n\n${notFoundMessage}\n\n${linkText}` );
		}

		// Calculate total parts based on the *full* content
		const totalParts = calculateTotalPartsFunc( fullContent ); // Pass full content to calculator

		// Basic pagination based on character count
		const startPos = part * MESSAGE_LENGTH_LIMIT;
		const endPos = startPos + MESSAGE_LENGTH_LIMIT;
		let contentPart = fullContent.substring( startPos, endPos );

		// Add ellipsis if content is truncated
		if ( startPos > 0 ) contentPart = `… ${contentPart}`;
		if ( endPos < fullContent.length ) contentPart = `${contentPart} …`;

		// Add part indicator if more than one part
		const partIndicator = totalParts > 1 ? ` (بخش ${toPersian( part + 1 )} از ${toPersian( totalParts )})` : "";

		return normalizeMessage( `${headerText}${partIndicator}\n\n${contentPart}\n\n${linkText}` );

	}
	catch ( error )
	{
		console.error( `Error generating ${title} message for ${url}:`, error );
		return normalizeMessage( `${headerText}\n\n⚠️ خطایی در دریافت یا پردازش ${title} رخ داد.\n\n${linkText}` );
	}
}

// --- Pagination Calculation ---
// These functions now take the *extracted text* as input

function calculatePartsBasedOnLength ( textContent )
{
	if ( !textContent ) return 0;
	return Math.ceil( textContent.length / MESSAGE_LENGTH_LIMIT );
}

// --- Specific Interpretation Generators ---

async function generateSaanNuzulMessage ( verseRefIndex, quranData, kvNamespace )
{
	return await generateInterpretationMessage( verseRefIndex, 0, { // Saan Nuzul usually fits in one part
		fetchUrlFunc: ( surah, ayah ) => { return `https://wiki.ahlolbait.com/آیه_${ayah}_سوره_${extractInfoByRefIndex( verseRefIndex, quranData ).currentSurahTitlePersian}`; },
		extractContentFunc: extractSaanNuzulContent,
		title: "شان نزول",
		notFoundMessage: "شان نزولی برای این آیه در ویکی اهل البیت پیدا نشد.",
		sourceLinkText: "لینک به ویکی اهل البیت",
		calculateTotalPartsFunc: calculatePartsBasedOnLength, // Use generic length calculation
	}, quranData, kvNamespace );
}

async function generateTafsirNemunehMessage ( verseRefIndex, part, quranData, kvNamespace )
{
	return await generateInterpretationMessage( verseRefIndex, part, {
		fetchUrlFunc: ( surah, ayah ) => { return `https://quran.makarem.ir/fa/interpretation?sura=${surah}&verse=${ayah}`; },
		extractContentFunc: extractTafsirNemunehContent,
		title: "تفسیر نمونه",
		notFoundMessage: "تفسیری برای این آیه در وب‌سایت آیت‌الله مکارم پیدا نشد. (ممکن است در آیه قبل یا بعد باشد)",
		sourceLinkText: "لینک به وب‌سایت تفسیر",
		calculateTotalPartsFunc: calculatePartsBasedOnLength,
	}, quranData, kvNamespace );
}

async function generateKhameneiMessage ( verseRefIndex, part, quranData, kvNamespace )
{
	return await generateInterpretationMessage( verseRefIndex, part, {
		fetchUrlFunc: ( surah, ayah ) => { return `https://farsi.khamenei.ir/newspart-index?sid=${surah}&npt=7&aya=${ayah}`; },
		extractContentFunc: extractKhameneiContent,
		title: "فیش‌های رهبری",
		notFoundMessage: "فیش مرتبطی برای این آیه در وب‌سایت رهبری پیدا نشد.",
		sourceLinkText: "لینک به وب‌سایت رهبری",
		calculateTotalPartsFunc: calculatePartsBasedOnLength,
	}, quranData, kvNamespace );
}

// --- Message Generation ---

function generateMessage ( refIndex, translationCode, quranData, defaultTranslationCode )
{
	const {
		currentSurahTitle,
		currentSurahNumber,
		currentSurahPersianNumber,
		currentAyahNumber,
		currentAyahPersianNumber
	} = extractInfoByRefIndex( refIndex, quranData );

	const currentAyah = quranData[refIndex];
	let prevAyah = null;
	let nextAyah = null;

	// Find previous verse *in the same surah*
	if ( refIndex > 0 && quranData[refIndex - 1].surah.number === currentSurahNumber )
	{
		prevAyah = quranData[refIndex - 1];
	}

	// Find next verse *in the same surah*
	if ( refIndex < quranData.length - 1 && quranData[refIndex + 1].surah.number === currentSurahNumber )
	{
		nextAyah = quranData[refIndex + 1];
	}

	const translator = all_translations[translationCode] || all_translations[defaultTranslationCode];
	const arabicTranslator = all_translations[actionCodes.arabicIrabText]; // Always use enhanced Arabic for context

	if ( !translator || !arabicTranslator )
	{
		console.error( `Invalid translation code or missing Arabic translator: ${translationCode}` );
		return normalizeMessage( `خطا: کد ترجمه نامعتبر (${translationCode})` );
	}

	let translatorWord = perian_translations[translationCode] ? "ترجمه" : "متن";

	let prevAyahText = "";
	if ( prevAyah )
	{
		const prevAyahNumPersian = prevAyah.ayah_persian;
		if ( perian_translations[translationCode] )
		{ // Show Arabic + Translation
			prevAyahText = `${prevAyah.verse[arabicTranslator.key]} ۝ ${prevAyahNumPersian}\n${prevAyah.verse[translator.key]}\n`;
		}
		else
		{ // Show only selected text (which is Arabic)
			prevAyahText = `${prevAyah.verse[translator.key]} ۝ ${prevAyahNumPersian}\n`;
		}
	}

	let currentAyahText = "";
	if ( perian_translations[translationCode] )
	{
		currentAyahText = `*${currentAyah.verse[arabicTranslator.key]}* ۝ ${currentAyahPersianNumber}\n*${currentAyah.verse[translator.key]}*\n`; // Bold current verse
	}
	else
	{
		currentAyahText = `*${currentAyah.verse[translator.key]}* ۝ ${currentAyahPersianNumber}\n`; // Bold current verse (Arabic)
	}

	let nextAyahText = "";
	if ( nextAyah )
	{
		const nextAyahNumPersian = nextAyah.ayah_persian;
		if ( perian_translations[translationCode] )
		{
			nextAyahText = `${nextAyah.verse[arabicTranslator.key]} ۝ ${nextAyahNumPersian}\n${nextAyah.verse[translator.key]}`;
		}
		else
		{
			nextAyahText = `${nextAyah.verse[translator.key]} ۝ ${nextAyahNumPersian}`;
		}
	}

	const messageHeader = `> ${currentSurahTitle} 🕊️ ${translatorWord} ${translator.farsi} 📖 ${currentSurahPersianNumber}:${currentAyahPersianNumber}\n\n`;
	const messageBody = `${prevAyahText}${currentAyahText}${nextAyahText}`;

	// Normalize the final message
	return normalizeMessage( messageHeader + messageBody );
}


// --- Button Generation ---

// Helper to create the base callback data string
function createVerseRefString ( actionCode, lastTranslation, readStatus, verseRefIndex, searchRefIndex, refResults )
{
	const refIndexesStr = refResults.map( index => { return index === searchRefIndex ? `@${index}` : index }).join( "," );
	// Format: ActionCode | PrevActionCode (use action for now) | LastTranslation | ReadStatus | VerseIndex _ RefResults(@Current)
	// Using "|" as a separator for better readability and parsing robustness.
	return `${actionCode}|${actionCode}|${lastTranslation}|${readStatus}|${verseRefIndex}_${refIndexesStr}`;
}

// Generates buttons for interpretation pagination
async function createPaginatedButtons ({
	verseRefIndex,
	searchRefIndex,
	refResults,
	userOptions,
	buttonConfig,
	quranData,
	kvNamespace
})
{
	const {
		actionCode, // The *current* action code (e.g., 'k' for Tafsir part 1)
		lastTranslation,
		chatId
	} = userOptions;

	const {
		baseActionCodes, // Array of codes for this interpretation type (e.g., actionCodes.tafsirNemooneh)
		readStatusType, // e.g., 'tafsir' or 'khamenei'
		mainButtonText,
		calculateTotalPartsFunc, // Function to calculate total parts based on *content*
		extractContentFunc, // Function to get the content for calculation
		fetchUrlFunc, // Function to get the URL to fetch content
	} = buttonConfig;

	// Fetch content to calculate total parts accurately
	const { currentSurahNumber, currentAyahNumber } = extractInfoByRefIndex( verseRefIndex, quranData );
	const url = fetchUrlFunc( currentSurahNumber, currentAyahNumber );
	let totalParts = 0;
	try
	{
		const html = await fetchHtmlWithCache( url, kvNamespace );
		if ( html )
		{
			const content = extractContentFunc( html );
			totalParts = calculateTotalPartsFunc( content );
		}
	}
	catch ( error )
	{
		console.error( `Error calculating parts for ${mainButtonText}:`, error );
		// Default to 1 part if calculation fails
		totalParts = 1;
	}
	totalParts = Math.min( totalParts, baseActionCodes.length ); // Limit by available action codes
	if ( totalParts <= 0 ) totalParts = 1; // Ensure at least one part


	const buttons = [];
	for ( let index = 0; index < totalParts; index++ )
	{
		const partActionCode = baseActionCodes[index];
		// Create callback data for this specific part button
		const partCallbackData = createVerseRefString( partActionCode, lastTranslation, actionCodes.others, verseRefIndex, searchRefIndex, refResults );
		buttons.push({
			text: partActionCode === actionCode ? `✅ ${toPersian( index + 1 )}` : toPersian( index + 1 ),
			callback_data: partCallbackData
		});
	}

	// Arrange buttons in rows (max 5 per row is reasonable)
	const buttonRows = [];
	const buttonsPerRow = 5;
	for ( let i = 0; i < buttons.length; i += buttonsPerRow )
	{
		buttonRows.push( buttons.slice( i, i + buttonsPerRow ) );
	}

	// Add Read/Unread toggle button
	const isRead = await getReadStatus( kvNamespace, readStatusType, chatId, verseRefIndex );
	const toggleCallbackData = createVerseRefString( actionCode, lastTranslation, actionCodes.toggleRead, verseRefIndex, searchRefIndex, refResults );
	const readStatusButton = {
		text: isRead ? "مطالعه شده ✅" : "مطالعه نشده",
		callback_data: toggleCallbackData
	};

	// Add Main Page button
	const mainPageCallbackData = createVerseRefString( actionCodes.mainPage, lastTranslation, actionCodes.others, verseRefIndex, searchRefIndex, refResults );
	const mainPageButton = { text: "صفحه ی اصلی", callback_data: mainPageCallbackData };

	// Structure the final keyboard
	return [
		...buttonRows, // Pagination buttons
		[readStatusButton], // Read status toggle
		[mainPageButton] // Back to main view
	];
}


// Main function to generate buttons based on context
async function genButtons ( verseRefIndex, searchRefIndex, refResults, userOptions, quranData, kvNamespace, defaultTranslationCode )
{
	const { actionCode, lastTranslation, chatId } = userOptions;

	// --- Interpretation Views ---
	if ( actionCodes.tafsirNemooneh.includes( actionCode ) )
	{
		return await createPaginatedButtons({
			verseRefIndex, searchRefIndex, refResults, userOptions, quranData, kvNamespace,
			buttonConfig: {
				baseActionCodes: actionCodes.tafsirNemooneh,
				readStatusType: "tafsir",
				mainButtonText: "تفسیر نمونه", // Not used directly in this layout
				calculateTotalPartsFunc: calculatePartsBasedOnLength,
				extractContentFunc: extractTafsirNemunehContent,
				fetchUrlFunc: ( surah, ayah ) => { return `https://quran.makarem.ir/fa/interpretation?sura=${surah}&verse=${ayah}`; },
			}
		});
	}

	if ( actionCodes.khamenei.includes( actionCode ) )
	{
		return await createPaginatedButtons({
			verseRefIndex, searchRefIndex, refResults, userOptions, quranData, kvNamespace,
			buttonConfig: {
				baseActionCodes: actionCodes.khamenei,
				readStatusType: "khamenei",
				mainButtonText: "فیش های رهبری", // Not used directly
				calculateTotalPartsFunc: calculatePartsBasedOnLength,
				extractContentFunc: extractKhameneiContent,
				fetchUrlFunc: ( surah, ayah ) => { return `https://farsi.khamenei.ir/newspart-index?sid=${surah}&npt=7&aya=${ayah}`; },
			}
		});
	}

	// Saan Nuzul view (no pagination, just back button)
	if ( actionCode === actionCodes.saanNuzul )
	{
		const mainPageCallbackData = createVerseRefString( actionCodes.mainPage, lastTranslation, actionCodes.others, verseRefIndex, searchRefIndex, refResults );
		return [
			[{ text: "صفحه ی اصلی", callback_data: mainPageCallbackData }]
		];
	}

	// --- Main View (Translations & Navigation) ---
	const baseCallbackData = createVerseRefString( actionCode, lastTranslation, actionCodes.others, verseRefIndex, searchRefIndex, refResults );
	const currentTranslationCode = all_translations[actionCode] ? actionCode : lastTranslation || defaultTranslationCode;

	// Navigation Buttons (Verse)
	const navVerseButtons = [
		{ text: "آیه ی بعد ⬅️", callback_data: createVerseRefString( actionCodes.nextVerse, currentTranslationCode, actionCodes.others, verseRefIndex, searchRefIndex, refResults ) },
		{ text: "➡️ آیه ی قبل", callback_data: createVerseRefString( actionCodes.prevVerse, currentTranslationCode, actionCodes.others, verseRefIndex, searchRefIndex, refResults ) }
	];

	// Translation Buttons
	const translationButtons = Object.entries( perian_translations ).map( ( [code, details] ) =>
	{
		const callbackData = createVerseRefString( code, code, actionCodes.others, verseRefIndex, searchRefIndex, refResults );
		return { text: code === currentTranslationCode ? `✅ ${details.farsi}` : details.farsi, callback_data: callbackData };
	});

	// Arabic Text Buttons
	const arabicButtons = Object.entries( arabic_texts ).map( ( [code, details] ) =>
	{
		const callbackData = createVerseRefString( code, code, actionCodes.others, verseRefIndex, searchRefIndex, refResults );
		return { text: code === currentTranslationCode ? `✅ ${details.farsi}` : details.farsi, callback_data: callbackData };
	});

	// Interpretation Buttons
	const interpretationButtons = [
		{ text: "تفسیر نمونه", callback_data: createVerseRefString( actionCodes.tafsirNemooneh[0], currentTranslationCode, actionCodes.others, verseRefIndex, searchRefIndex, refResults ) },
		{ text: "فیش رهبری", callback_data: createVerseRefString( actionCodes.khamenei[0], currentTranslationCode, actionCodes.others, verseRefIndex, searchRefIndex, refResults ) },
		{ text: "شان نزول", callback_data: createVerseRefString( actionCodes.saanNuzul, currentTranslationCode, actionCodes.others, verseRefIndex, searchRefIndex, refResults ) }
	];

	// Navigation Buttons (Search Results) - Only show if there are multiple results
	const navResultButtons = refResults.length > 1 ? [
		{ text: "نتیجه بعد 🔍", callback_data: createVerseRefString( actionCodes.nextResult, currentTranslationCode, actionCodes.others, verseRefIndex, searchRefIndex, refResults ) },
		{ text: "🔎 نتیجه قبل", callback_data: createVerseRefString( actionCodes.prevResult, currentTranslationCode, actionCodes.others, verseRefIndex, searchRefIndex, refResults ) }
	] : [];

	// Combine all button rows
	const keyboard = [
		navVerseButtons,
		translationButtons,
		arabicButtons,
		interpretationButtons,
	];
	if ( navResultButtons.length > 0 )
	{
		keyboard.push( navResultButtons );
	}

	return keyboard;
}

// --- Callback Query Parsing ---

function parseCallbackData ( data )
{
	// Format: ActionCode | PrevActionCode | LastTranslation | ReadStatus | VerseIndex _ RefResults(@Current)
	const parts = data.split( "|" );
	if ( parts.length !== 5 )
	{
		console.error( "Invalid callback data format:", data );
		return null; // Indicate error
	}

	const [actionCode, previousActionCode, lastTranslation, readStatusCode, verseAndResults] = parts;
	const [verseRefIndexStr, searchResultIndexesStr] = verseAndResults.split( "_" );

	if ( !verseRefIndexStr || !searchResultIndexesStr )
	{
		console.error( "Invalid verse/results part in callback data:", verseAndResults );
		return null;
	}

	let searchRefIndex = -1; // The index within searchResultIndexes that corresponds to the *search* result focus
	const searchResultIndexes = searchResultIndexesStr.split( "," ).map( ( numStr ) =>
	{
		const isCurrent = numStr.includes( "@" );
		const num = parseInt( numStr.replace( "@", "" ), 10 );
		if ( isCurrent )
		{
			searchRefIndex = num;
		}
		return num;
	}).filter( n => { return !isNaN( n ) }); // Filter out potential NaN values

	const verseRefIndex = parseInt( verseRefIndexStr, 10 );

	if ( isNaN( verseRefIndex ) || searchResultIndexes.length === 0 )
	{
		console.error( "Error parsing numbers in callback data:", data );
		return null;
	}

	// If searchRefIndex wasn't marked with '@', assume it's the same as verseRefIndex if that index exists in the results
	if ( searchRefIndex === -1 && searchResultIndexes.includes( verseRefIndex ) )
	{
		searchRefIndex = verseRefIndex;
	}
	else if ( searchRefIndex === -1 )
	{
		// Fallback: use the first result index if verseRefIndex is not in the list
		searchRefIndex = searchResultIndexes[0];
	}


	return {
		actionCode,
		previousActionCode, // Note: Currently set same as actionCode in creation helper
		lastTranslation,
		readStatusCode,
		searchResultIndexes, // Array of refIndexes from the search
		searchRefIndex, // The refIndex that was the *focus* of the search result navigation
		verseRefIndex // The refIndex of the verse currently being *displayed* or acted upon
	};
}


// --- Main Worker Logic ---

export default {
	async fetch ( request, env, ctx )
	{
		const url = new URL( request.url );
		const token = env.ENV_BOT_TOKEN;
		const kvNamespace = env.CFW_TEBIANE; // KV namespace binding
		const defaultTranslationCode = env.DEFAULT_TRANSLATION || actionCodes.makarem; // Get default from env or fallback

		if ( !token )
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
			globalThis.quranData = await getKvJson( kvNamespace, KV_QURAN_KEY );
			if ( !globalThis.quranData )
			{
				console.error( "Failed to load Quran data from KV!" );
				// Optionally clear the cache variable so it retries next time
				// delete globalThis.quranData;
				return new Response( "Failed to load Quran data", { status: 500 });
			}
			console.log( `Quran data loaded successfully (${globalThis.quranData.length} verses).` );
		}
		// Use the cached data
		const { quranData } = globalThis;


		// --- Route Handlers ---
		if ( url.pathname === WEBHOOK )
		{
			// Check secret token
			if ( request.headers.get( "X-Telegram-Bot-Api-Secret-Token" ) !== SECRET )
			{
				console.warn( "Unauthorized webhook access attempt." );
				return new Response( "Unauthorized", { status: 403 });
			}

			try
			{
				const update = await request.json();
				// Process update asynchronously
				ctx.waitUntil( handleUpdate( update, token, quranData, kvNamespace, defaultTranslationCode ) );
				return new Response( "Ok" ); // Respond quickly to Telegram
			}
			catch ( e )
			{
				console.error( "Error parsing webhook update:", e );
				return new Response( "Invalid request", { status: 400 });
			}
		}
		else if ( url.pathname === "/registerWebhook" )
		{
			const webhookUrl = `${url.protocol}//${url.hostname}${WEBHOOK}`;
			try
			{
				const result = await sendTelegramRequest( "setWebhook", { url: webhookUrl, secret_token: SECRET }, token );
				return new Response( result.ok ? "Webhook registered successfully!" : `Webhook registration failed: ${JSON.stringify( result )}`, {
					headers: { "Content-Type": "application/json" }
				});
			}
			catch ( error )
			{
				return new Response( `Error registering webhook: ${error.message}`, { status: 500 });
			}
		}
		else if ( url.pathname === "/unRegisterWebhook" )
		{
			try
			{
				const result = await sendTelegramRequest( "setWebhook", { url: "" }, token ); // Remove webhook
				return new Response( result.ok ? "Webhook unregistered successfully!" : `Webhook unregistration failed: ${JSON.stringify( result )}`, {
					headers: { "Content-Type": "application/json" }
				});
			}
			catch ( error )
			{
				return new Response( `Error unregistering webhook: ${error.message}`, { status: 500 });
			}
		}
		else if ( url.pathname === "/loadquran" )
		{ // Simple endpoint to check if quran data loaded
			return new Response( quranData ? `Quran data loaded (${quranData.length} verses)` : "Quran data not loaded", { status: quranData ? 200 : 500 });
		}
		else
		{
			return new Response( "Not Found", { status: 404 });
		}
	},
};

// --- Update Handling ---

async function handleUpdate ( update, token, quranData, kvNamespace, defaultTranslationCode )
{
	try
	{
		if ( update.message )
		{
			await handleMessage( update.message, token, quranData, kvNamespace, defaultTranslationCode );
		}
		else if ( update.callback_query )
		{
			await handleCallbackQuery( update.callback_query, token, quranData, kvNamespace, defaultTranslationCode );
		}
		// Add handlers for other update types if needed (edited_message, etc.)
	}
	catch ( error )
	{
		console.error( "Error handling update:", error );
		// Optionally, send an error message back to the user if possible/appropriate
		const chatId = update.message?.chat.id || update.callback_query?.message?.chat.id;
		if ( chatId )
		{
			try
			{
				await sendTextMessage( chatId, "⚠️ متاسفانه خطایی در پردازش درخواست شما رخ داد.", {}, token );
			}
			catch ( sendError )
			{
				console.error( "Failed to send error message to user:", sendError );
			}
		}
	}
}

// --- Message Handler ---

async function handleMessage ( message, token, quranData, kvNamespace, defaultTranslationCode )
{
	const chatId = message.chat.id;
	const { text } = message;

	if ( !text ) return; // Ignore messages without text

	// Handle commands
	if ( text.startsWith( "/start" ) )
	{
		await sendTextMessage( chatId, normalizeMessage( "سلام! 👋\nبرای جستجو در قرآن، کلمه، عبارت یا شماره سوره و آیه (مانند ۲:۱۵ یا ۲:۱۵) را وارد کنید." ), {}, token );
		return;
	}
	if ( text.startsWith( "/resources" ) )
	{
		// In CFW, we don't have easy access to the file system like in Node.js.
		// The resources text should be hardcoded or fetched from another source (e.g., a KV key or external URL).
		const resourcesMessage = `
منابع استفاده شده:
*   ترجمه‌ها و متن عربی: GlobalQuran API
*   نام سوره‌ها: Wikipedia
*   تفسیر نمونه: quran.makarem.ir
*   شان نزول: wiki.ahlolbait.com
*   فیش‌های رهبری: farsi.khamenei.ir

کد منبع: https://github.com/mlibre/Tebiane
`;
		await sendTextMessage( chatId, normalizeMessage( resourcesMessage ), {}, token );
		return;
	}

	// --- Perform Search ---
	console.log( `Searching for: "${text}"` );
	const searchResults = simpleSearch( text, quranData, searchKeys );
	console.log( `Found ${searchResults.length} results.` );

	if ( searchResults.length > 0 )
	{
		const firstResultRefIndex = searchResults[0].refIndex;
		const resultRefIndexes = searchResults.map( r => { return r.refIndex }); // Get all refIndexes

		// User options for the initial message
		const userOptions = {
			actionCode: defaultTranslationCode, // Start with default translation
			lastTranslation: defaultTranslationCode,
			chatId,
			// messageId is not available yet, buttons generated here are for the *new* message
		};

		const messageText = generateMessage( firstResultRefIndex, defaultTranslationCode, quranData, defaultTranslationCode );
		const buttons = await genButtons( firstResultRefIndex, firstResultRefIndex, resultRefIndexes, userOptions, quranData, kvNamespace, defaultTranslationCode );

		await sendTextMessage( chatId, messageText, {
			reply_markup: { inline_keyboard: buttons }
		}, token );
	}
	else
	{
		await sendTextMessage( chatId, normalizeMessage( "نتیجه‌ای برای جستجوی شما یافت نشد." ), {}, token );
	}
}

// --- Callback Query Handler ---

async function handleCallbackQuery ( callbackQuery, token, quranData, kvNamespace, defaultTranslationCode )
{
	const { data } = callbackQuery;
	const chatId = callbackQuery.message.chat.id;
	const messageId = callbackQuery.message.message_id;
	const callbackQueryId = callbackQuery.id;

	// Answer the callback query quickly to remove the loading state on the button
	ctx.waitUntil( answerCallbackQuery( callbackQueryId, {}, token ) );

	const parsedData = parseCallbackData( data );
	if ( !parsedData )
	{
		console.error( "Failed to parse callback data:", data );
		// Optionally send an alert to the user
		await answerCallbackQuery( callbackQueryId, { text: "خطا در پردازش دکمه!", show_alert: true }, token );
		return;
	}

	let { actionCode, previousActionCode, lastTranslation, readStatusCode,
		searchResultIndexes, searchRefIndex, verseRefIndex } = parsedData;

	// Ensure lastTranslation is valid, fallback to default if needed
	lastTranslation = all_translations[lastTranslation] ? lastTranslation : defaultTranslationCode;

	let newText = null;
	let newButtons = null;
	let currentAction = actionCode; // Keep track of the action being processed

	// --- Handle Read Status Toggle ---
	if ( readStatusCode === actionCodes.toggleRead )
	{
		let readType = null;
		if ( actionCodes.tafsirNemooneh.includes( actionCode ) ) readType = "tafsir";
		else if ( actionCodes.khamenei.includes( actionCode ) ) readType = "khamenei";
		// Add other types if needed

		if ( readType )
		{
			const currentStatus = await getReadStatus( kvNamespace, readType, chatId, verseRefIndex );
			if ( currentStatus )
			{
				await deleteReadStatus( kvNamespace, readType, chatId, verseRefIndex );
			}
			else
			{
				await putReadStatus( kvNamespace, readType, chatId, verseRefIndex );
			}
			// No text change needed, just update buttons
			readStatusCode = actionCodes.others; // Reset status code after handling
		}
	}

	// --- Handle Actions ---
	const userOptions = { actionCode: currentAction, lastTranslation, chatId, messageId }; // Pass current action

	if ( all_translations[actionCode] ) // Change Translation / Show Arabic
	{
		newText = generateMessage( verseRefIndex, actionCode, quranData, defaultTranslationCode );
		userOptions.lastTranslation = actionCode; // Update last translation
		newButtons = await genButtons( verseRefIndex, searchRefIndex, searchResultIndexes, userOptions, quranData, kvNamespace, defaultTranslationCode );
	}
	else if ( actionCode === actionCodes.nextVerse )
	{
		const currentVerseInfo = extractInfoByRefIndex( verseRefIndex, quranData );
		if ( verseRefIndex + 1 < quranData.length && quranData[verseRefIndex + 1].surah.number === currentVerseInfo.currentSurahNumber )
		{
			verseRefIndex += 1; // Move to next verse
		}
		// Determine if we were in an interpretation view to stay there
		if ( actionCodes.tafsirNemooneh.includes( previousActionCode ) )
		{
			currentAction = actionCodes.tafsirNemooneh[0]; // Go to first part of next verse's tafsir
			newText = await generateTafsirNemunehMessage( verseRefIndex, 0, quranData, kvNamespace );
		}
		else if ( actionCodes.khamenei.includes( previousActionCode ) )
		{
			currentAction = actionCodes.khamenei[0]; // Go to first part of next verse's fiches
			newText = await generateKhameneiMessage( verseRefIndex, 0, quranData, kvNamespace );
		}
		else if ( previousActionCode === actionCodes.saanNuzul )
		{
			currentAction = actionCodes.saanNuzul;
			newText = await generateSaanNuzulMessage( verseRefIndex, quranData, kvNamespace );
		}
		else
		{ // Stay in main translation view
			currentAction = lastTranslation; // Use the last *selected* translation
			newText = generateMessage( verseRefIndex, currentAction, quranData, defaultTranslationCode );
		}
		userOptions.actionCode = currentAction;
		newButtons = await genButtons( verseRefIndex, searchRefIndex, searchResultIndexes, userOptions, quranData, kvNamespace, defaultTranslationCode );
	}
	else if ( actionCode === actionCodes.prevVerse )
	{
		const currentVerseInfo = extractInfoByRefIndex( verseRefIndex, quranData );
		if ( verseRefIndex - 1 >= 0 && quranData[verseRefIndex - 1].surah.number === currentVerseInfo.currentSurahNumber )
		{
			verseRefIndex -= 1; // Move to previous verse
		}
		// Determine if we were in an interpretation view to stay there
		if ( actionCodes.tafsirNemooneh.includes( previousActionCode ) )
		{
			currentAction = actionCodes.tafsirNemooneh[0];
			newText = await generateTafsirNemunehMessage( verseRefIndex, 0, quranData, kvNamespace );
		}
		else if ( actionCodes.khamenei.includes( previousActionCode ) )
		{
			currentAction = actionCodes.khamenei[0];
			newText = await generateKhameneiMessage( verseRefIndex, 0, quranData, kvNamespace );
		}
		else if ( previousActionCode === actionCodes.saanNuzul )
		{
			currentAction = actionCodes.saanNuzul;
			newText = await generateSaanNuzulMessage( verseRefIndex, quranData, kvNamespace );
		}
		else
		{
			currentAction = lastTranslation;
			newText = generateMessage( verseRefIndex, currentAction, quranData, defaultTranslationCode );
		}
		userOptions.actionCode = currentAction;
		newButtons = await genButtons( verseRefIndex, searchRefIndex, searchResultIndexes, userOptions, quranData, kvNamespace, defaultTranslationCode );
	}
	else if ( actionCode === actionCodes.nextResult )
	{
		const currentIndexInResults = searchResultIndexes.indexOf( searchRefIndex );
		if ( currentIndexInResults !== -1 && currentIndexInResults + 1 < searchResultIndexes.length )
		{
			searchRefIndex = searchResultIndexes[currentIndexInResults + 1]; // Move to next search result index
			verseRefIndex = searchRefIndex; // Display the verse corresponding to the new search result focus
		}
		currentAction = lastTranslation; // Show translation for the new result
		newText = generateMessage( verseRefIndex, currentAction, quranData, defaultTranslationCode );
		userOptions.actionCode = currentAction;
		newButtons = await genButtons( verseRefIndex, searchRefIndex, searchResultIndexes, userOptions, quranData, kvNamespace, defaultTranslationCode );
	}
	else if ( actionCode === actionCodes.prevResult )
	{
		const currentIndexInResults = searchResultIndexes.indexOf( searchRefIndex );
		if ( currentIndexInResults !== -1 && currentIndexInResults - 1 >= 0 )
		{
			searchRefIndex = searchResultIndexes[currentIndexInResults - 1]; // Move to previous search result index
			verseRefIndex = searchRefIndex; // Display the verse corresponding to the new search result focus
		}
		currentAction = lastTranslation; // Show translation for the new result
		newText = generateMessage( verseRefIndex, currentAction, quranData, defaultTranslationCode );
		userOptions.actionCode = currentAction;
		newButtons = await genButtons( verseRefIndex, searchRefIndex, searchResultIndexes, userOptions, quranData, kvNamespace, defaultTranslationCode );
	}
	else if ( actionCodes.tafsirNemooneh.includes( actionCode ) )
	{
		const partIndex = actionCodes.tafsirNemooneh.indexOf( actionCode );
		newText = await generateTafsirNemunehMessage( verseRefIndex, partIndex, quranData, kvNamespace );
		// Buttons need to be regenerated to reflect read status potentially changing
		userOptions.actionCode = actionCode; // Ensure buttons reflect the current part
		newButtons = await genButtons( verseRefIndex, searchRefIndex, searchResultIndexes, userOptions, quranData, kvNamespace, defaultTranslationCode );
	}
	else if ( actionCodes.khamenei.includes( actionCode ) )
	{
		const partIndex = actionCodes.khamenei.indexOf( actionCode );
		newText = await generateKhameneiMessage( verseRefIndex, partIndex, quranData, kvNamespace );
		userOptions.actionCode = actionCode;
		newButtons = await genButtons( verseRefIndex, searchRefIndex, searchResultIndexes, userOptions, quranData, kvNamespace, defaultTranslationCode );
	}
	else if ( actionCode === actionCodes.saanNuzul )
	{
		newText = await generateSaanNuzulMessage( verseRefIndex, quranData, kvNamespace );
		userOptions.actionCode = actionCode;
		newButtons = await genButtons( verseRefIndex, searchRefIndex, searchResultIndexes, userOptions, quranData, kvNamespace, defaultTranslationCode );
	}
	else if ( actionCode === actionCodes.mainPage )
	{
		currentAction = lastTranslation; // Go back to the last used translation
		newText = generateMessage( verseRefIndex, currentAction, quranData, defaultTranslationCode );
		userOptions.actionCode = currentAction;
		newButtons = await genButtons( verseRefIndex, searchRefIndex, searchResultIndexes, userOptions, quranData, kvNamespace, defaultTranslationCode );
	}
	else
	{
		console.warn( "Unhandled action code:", actionCode );
		// Maybe send a message? For now, just don't update.
		return;
	}

	// --- Update the message ---
	if ( newText && newButtons )
	{
		try
		{
			await editMessageText( chatId, messageId, newText, {
				reply_markup: { inline_keyboard: newButtons }
			}, token );
		}
		catch ( error )
		{
			// Log error, but don't crash the worker
			console.error( `Failed to edit message (${chatId}, ${messageId}):`, error );
			// If text edit failed (e.g., "message not modified"), try updating only markup if needed
			if ( error.result && error.result.error_code === 400 && error.result.description.includes( "message is not modified" ) )
			{
				try
				{
					console.log( "Message text not modified, attempting to update reply markup only." );
					await editMessageReplyMarkup( chatId, messageId, { inline_keyboard: newButtons }, token );
				}
				catch ( markupError )
				{
					console.error( `Failed to edit reply markup either (${chatId}, ${messageId}):`, markupError );
				}
			}
		}
	}
	else if ( newButtons )
	{ // Only buttons changed (e.g., read status toggle)
		try
		{
			await editMessageReplyMarkup( chatId, messageId, { inline_keyboard: newButtons }, token );
		}
		catch ( error )
		{
			console.error( `Failed to edit reply markup (${chatId}, ${messageId}):`, error );
		}
	}
}