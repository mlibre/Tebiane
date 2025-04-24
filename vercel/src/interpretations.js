const { actionCodes, markdownCodes, messageLength } = require( "./config.js" );
const { normalizeMessage, extractInfoByRefIndex } = require( "./text-helpers.js" );
const { getReadabilityOutput, fetchHtmlWithCache } = require( "./web.js" );
const { JSDOM } = require( "jsdom" );
const database = require( "./database.js" );

async function generateSaanNuzulMessage ( verseRefIndex )
{
	const {
		currentSurahTitle,
		currentSurahTitlePersian,
		currentSurahNumber,
		currentSurahPersianNumber,
		currentAyahNumber,
		currentAyahPersianNumber
	} = extractInfoByRefIndex( verseRefIndex );

	const url = `https://wiki.ahlolbait.com/آیه_${currentAyahNumber}_سوره_${currentSurahTitlePersian}`;
	const htmlString = await fetchHtmlWithCache( url );

	// Use JSDOM instead of DOMParser
	const dom = new JSDOM( htmlString );
	const doc = dom.window.document;

	const saanNuzulTexts = [];
	const headerTest = `> ${currentSurahTitle} 🕊️ شان نزول 📖 ${currentSurahPersianNumber}:${currentAyahPersianNumber}`;
	saanNuzulTexts.push( normalizeMessage( headerTest ) );

	// Find the nuzul section
	const headers = Array.from( doc.querySelectorAll( ".mw-parser-output h2" ) );
	const nuzulHeader = headers.find( h => { return h.textContent.trim() === "نزول" });

	if ( nuzulHeader )
	{
		let currentElement = nuzulHeader.nextElementSibling;
		while ( currentElement && currentElement.tagName !== "H2" )
		{
			if ( currentElement.textContent.trim() )
			{
				saanNuzulTexts.push( normalizeMessage( currentElement.textContent.trim() ) );
			}
			currentElement = currentElement.nextElementSibling;
		}
	}
	else
	{
		saanNuzulTexts.push( normalizeMessage( "شان نزولی برای این آیه پیدا نشد." ) );
	}

	saanNuzulTexts.push( `[🔗 لینک به وب سایت اهل البیت](${url})` );
	return saanNuzulTexts.join( "\n\n" );
}

async function generateTafsirNemunehMessage ( verseRefIndex, part )
{
	const {
		currentSurahTitle,
		currentSurahNumber,
		currentSurahPersianNumber,
		currentAyahNumber,
		currentAyahPersianNumber
	} = extractInfoByRefIndex( verseRefIndex );

	const url = `https://quran.makarem.ir/fa/interpretation?sura=${currentSurahNumber}&verse=${currentAyahNumber}`;
	const rdrview = await getReadabilityOutput( url );

	// Use JSDOM instead of DOMParser
	const dom = new JSDOM( rdrview );
	const doc = dom.window.document;

	const translationTexts = [];
	let totalMessageLength = 0;
	let limitReached = false;
	const headerTest = `> ${currentSurahTitle} 🕊️ تفسیر نمونه 📖 ${currentSurahPersianNumber}:${currentAyahPersianNumber}`;

	translationTexts.push( normalizeMessage( headerTest ) );
	const element = doc.querySelector( ".page" );

	if ( element )
	{
		const elementsAfterFirstH3 = element.querySelectorAll( "p, h3, h6" );
		for ( const element of elementsAfterFirstH3 )
		{
			if ( limitReached ) break;

			const tafsirChunk = element.textContent.trim();
			if ( !tafsirChunk ) continue;

			const addMessage = canAddToMessage( totalMessageLength, tafsirChunk, part );
			if ( addMessage === -1 )
			{
				limitReached = true;
				break;
			}

			if ( addMessage )
			{
				if ( element.tagName === "P" )
				{
					translationTexts.push( normalizeMessage( tafsirChunk ) );
				}
				else if ( element.tagName === "H3" || element.tagName === "H6" )
				{
					translationTexts.push( normalizeMessage( `📝 ${markdownCodes.bold}${tafsirChunk}${markdownCodes.bold}` ) );
				}
			}
			totalMessageLength += tafsirChunk.length;
		}
	}

	if ( translationTexts.length <= 1 )
	{
		translationTexts.push( normalizeMessage( "تفسیری برای این آیه پیدا نشد. معمولا در آیات قبلی یا بعدی تفسیری قرار دارد" ) );
	}

	translationTexts.push( `[🔗 لینک به وب سایت تفسیر](${url})` );
	return translationTexts.join( "\n\n" );
}

async function generateKhameneiMessage ( verseRefIndex, part )
{
	const {
		currentSurahNumber,
		currentAyahNumber,
		currentSurahTitle,
		currentSurahPersianNumber,
		currentAyahPersianNumber
	} = extractInfoByRefIndex( verseRefIndex );

	const url = `https://farsi.khamenei.ir/newspart-index?sid=${currentSurahNumber}&npt=7&aya=${currentAyahNumber}`;
	console.log( url );

	const rdrview = await getReadabilityOutput( url );

	// Use JSDOM instead of DOMParser
	const dom = new JSDOM( rdrview );
	const doc = dom.window.document;

	const fishTexts = [];
	const headerText = `> ${currentSurahTitle} 🕊️ فیش های رهبری 📖 ${currentSurahPersianNumber}:${currentAyahPersianNumber}`;
	fishTexts.push( normalizeMessage( headerText ) );

	// Find all articles in the document
	const articles = doc.querySelectorAll( "#npTL article" );

	if ( articles && articles.length > 0 )
	{
		let allContent = "";

		// Process each article
		articles.forEach( article =>
		{
			// Get the header text
			const header = article.querySelector( "header" );
			if ( header )
			{
				allContent += `\n📝 ${markdownCodes.bold}${header.textContent.trim()}${markdownCodes.bold}\n\n`;
			}

			// Get the article body
			const body = article.querySelector( "[itemprop='articleBody']" );
			if ( body )
			{
				allContent += `${body.textContent.trim() }\n\n`;
			}

			// Get the references section (after the hr)
			const hr = article.querySelector( "hr" );
			if ( hr )
			{
				allContent += "\n🔖 ارجاعات\n\n";
				const references = hr.parentNode.querySelectorAll( "p" );
				references.forEach( ref =>
				{
					allContent += `${ref.textContent.trim() }\n\n`;
				});
			}
		});

		// Split the content based on the part requested
		const startPos = part * messageLength;
		const endPos = ( part + 1 ) * messageLength;
		const partText = allContent.substring( startPos, endPos );

		if ( partText.trim() )
		{
			fishTexts.push( normalizeMessage( partText.trim() ) );
		}
	}

	if ( fishTexts.length <= 1 )
	{
		fishTexts.push( normalizeMessage( "فیشی برای این آیه پیدا نشد." ) );
	}

	fishTexts.push( `[🔗 لینک به وب سایت](${url})` );
	return fishTexts.join( "\n\n" );
}

async function calculateTotalKhameneiParts ( currentSurahNumber, currentAyahNumber )
{
	const url = `https://farsi.khamenei.ir/newspart-index?sid=${currentSurahNumber}&npt=7&aya=${currentAyahNumber}`;
	const rdrview = await getReadabilityOutput( url );

	// Use JSDOM instead of DOMParser
	const dom = new JSDOM( rdrview );
	const doc = dom.window.document;

	// Find all articles in the document
	const articles = doc.querySelectorAll( "#npTL article" );

	if ( !articles || articles.length === 0 ) return 0;

	let allContent = "";

	// Process each article
	articles.forEach( article =>
	{
		// Get the header text
		const header = article.querySelector( "header" );
		if ( header )
		{
			allContent += `\n📝 ${header.textContent.trim()}\n\n`;
		}

		// Get the article body
		const body = article.querySelector( "[itemprop='articleBody']" );
		if ( body )
		{
			allContent += `${body.textContent.trim() }\n\n`;
		}

		// Get the references section (after the hr)
		const hr = article.querySelector( "hr" );
		if ( hr )
		{
			allContent += "\n🔖 ارجاعات\n\n";
			const references = hr.parentNode.querySelectorAll( "p" );
			references.forEach( ref =>
			{
				allContent += `${ref.textContent.trim() }\n\n`;
			});
		}
	});

	return Math.ceil( allContent.length / messageLength );
}

async function calculateTotalTafsirParts ( currentSurahNumber, currentAyahNumber )
{
	const url = `https://quran.makarem.ir/fa/interpretation?sura=${currentSurahNumber}&verse=${currentAyahNumber}`;
	const rdrview = await getReadabilityOutput( url );

	// Use JSDOM instead of DOMParser
	const dom = new JSDOM( rdrview );
	const doc = dom.window.document;

	const pageElement = doc.querySelector( ".page" );
	if ( !pageElement ) return 0;

	const tafsirElements = pageElement.querySelectorAll( "p, h3, h6" );
	let totalLength = 0;

	tafsirElements.forEach( element =>
	{
		totalLength += element.textContent.trim().length;
	});

	return Math.ceil( totalLength / messageLength );
}

async function isTafsirNemunehReadByUser ( chatId, verseRefIndex )
{
	await database.connect();
	return await database.getJson( `tafsir_read_${chatId}_${verseRefIndex}` );
}

async function isKhameneiReadByUser ( chatId, verseRefIndex )
{
	await database.connect();
	return await database.getJson( `khamenei_read_${chatId}_${verseRefIndex}` );
}

async function markTafsirNemunehAsRead ( chatId, verseRefIndex )
{
	await database.connect();
	return await database.putJson( `tafsir_read_${chatId}_${verseRefIndex}`, true );
}

async function markKhameneiAsRead ( chatId, verseRefIndex )
{
	await database.connect();
	return await database.putJson( `khamenei_read_${chatId}_${verseRefIndex}`, true );
}

async function markTafsirNemunehAsUnread ( chatId, verseRefIndex )
{
	await database.connect();
	return await database.delete( `tafsir_read_${chatId}_${verseRefIndex}` );
}

async function markKhameneiAsUnread ( chatId, verseRefIndex )
{
	await database.connect();
	return await database.delete( `khamenei_read_${chatId}_${verseRefIndex}` );
}

function canAddToMessage ( totalLength, newText, part )
{
	const start = part * messageLength;
	const end = ( part + 1 ) * messageLength;

	if ( totalLength + newText.length > end )
	{
		return -1;
	}

	return totalLength + newText.length >= start &&
         totalLength + newText.length <= end;
}

module.exports = {
	generateSaanNuzulMessage,
	generateTafsirNemunehMessage,
	generateKhameneiMessage,
	calculateTotalTafsirParts,
	calculateTotalKhameneiParts,
	isTafsirNemunehReadByUser,
	isKhameneiReadByUser,
	markTafsirNemunehAsRead,
	markKhameneiAsUnread
}