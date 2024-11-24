const cheerio = require( "cheerio" );
const { messageLength, actionCodes, markdownCodes } = require( "../configs" );
const { normalizeMessage, extractInfoByRefIndex } = require( "./text-helpers" );
const { getReadabilityOutput, fetchHtml, cleanHtmlContent } = require( "./web" );
const database = require( "../database" );

exports.generateSaanNuzulMessage = async function ( verseRefIndex )
{
	const { currentSurahTitle, currentSurahTitlePersian, currentSurahNumber,
		currentSurahPersianNumber, currentAyahNumber, currentAyahPersianNumber } = extractInfoByRefIndex( verseRefIndex );

	const url = `https://wiki.ahlolbait.com/آیه_${currentAyahNumber}_سوره_${currentSurahTitlePersian}`;
	const htmlString = await fetchHtml( url );
	const $ = cheerio.load( cleanHtmlContent( htmlString ) );

	const saanNuzulTexts = [];
	const headerTest = `> ${currentSurahTitle} 🕊️ شان نزول 📖 ${currentSurahPersianNumber}:${currentAyahPersianNumber}`;
	saanNuzulTexts.push( normalizeMessage( headerTest ) );

	const nuzulSection = $( ".mw-parser-output" ).find( "h2" ).filter( function ()
	{
		return $( this ).text().trim() === "نزول";
	}).nextUntil( "h2" );

	if ( nuzulSection.length > 0 )
	{
		nuzulSection.each( ( index, element ) =>
		{
			const saanNuzulChunk = $( element ).text();
			saanNuzulTexts.push( normalizeMessage( saanNuzulChunk ) );
		});
	}
	else
	{
		saanNuzulTexts.push( normalizeMessage( "سبب نزولی برای این آیه پیدا نشد." ) );
	}

	saanNuzulTexts.push( `[🔗 لینک به وب سایت اهل البیت](${url})` );
	return saanNuzulTexts.join( "\n\n" );
}

exports.generateTafsirNemunehMessage = async function ( verseRefIndex, part )
{
	const { currentSurahTitle, currentSurahNumber, currentSurahPersianNumber,
		currentAyahNumber, currentAyahPersianNumber } = extractInfoByRefIndex( verseRefIndex );

	const url = `https://quran.makarem.ir/fa/interpretation?sura=${currentSurahNumber}&verse=${currentAyahNumber}`;
	const rdrview = await getReadabilityOutput( url );
	const $ = cheerio.load( cleanHtmlContent( rdrview ) );

	const translationTexts = [];
	let totalMessageLength = 0;
	let limitReached = false;
	const headerTest = `> ${currentSurahTitle} 🕊️ تفسیر نمونه 📖 ${currentSurahPersianNumber}:${currentAyahPersianNumber}`;

	translationTexts.push( normalizeMessage( headerTest ) );
	const element = $( ".page" );

	if ( element.length > 0 )
	{
		const elementsAfterFirstH3 = element.find( "p, h3, h6" );
		elementsAfterFirstH3.each( ( index, element ) =>
		{
			if ( limitReached ) return;
			const tafsirChunk = $( element ).text().trim();
			if ( !tafsirChunk ) return;

			const addMessage = canAddToMessage( totalMessageLength, tafsirChunk, part );
			if ( addMessage === -1 )
			{
				limitReached = true;
				return false;
			}

			if ( addMessage )
			{
				if ( element.name === "p" )
				{
					translationTexts.push( normalizeMessage( tafsirChunk ) );
				}
				else if ( element.name === "h3" || element.name === "h6" )
				{
					translationTexts.push( normalizeMessage( `📝 ${markdownCodes.bold}${tafsirChunk}${markdownCodes.bold}` ) );
				}
				// else if ( element.name == "h5" )
				// {
				// 	translationTexts.push( normalizeMessage( `📓 ${tafsirChunk}` ) );
				// }
			}
			totalMessageLength += tafsirChunk.length;
		});
	}

	if ( translationTexts.length <= 1 )
	{
		translationTexts.push( normalizeMessage( "تفسیری برای این آیه پیدا نشد. معمولا در آیات قبلی یا بعدی تفسیری قرار دارد" ) );
	}

	translationTexts.push( `[🔗 لینک به وب سایت تفسیر](${url})` );
	return translationTexts.join( "\n\n" );
}

exports.generateKhameneiMessage = async function ( verseRefIndex, part )
{
	const { currentSurahNumber, currentAyahNumber, currentSurahTitle,
		currentSurahPersianNumber, currentAyahPersianNumber } = extractInfoByRefIndex( verseRefIndex );

	const url = `https://farsi.khamenei.ir/newspart-index?sid=${currentSurahNumber}&npt=7&aya=${currentAyahNumber}`;
	console.log( url );

	const rdrview = await getReadabilityOutput( url );
	const $ = cheerio.load( cleanHtmlContent( rdrview ) );

	const fishTexts = [];
	const headerText = `> ${currentSurahTitle} 🕊️ فیش های رهبری 📖 ${currentSurahPersianNumber}:${currentAyahPersianNumber}`;
	fishTexts.push( normalizeMessage( headerText ) );

	$( "header" ).before( "<br>BOLDTEXT" );
	$( "p" ).before( "<br>" );
	$( "br" ).replaceWith( "BREAKLINE" );
	$( "hr" ).replaceWith( "FOOTERLINE" );
	const fishChunk = $( "#npTL" ).text().trim();

	if ( fishChunk )
	{
		const startPos = part * messageLength;
		const endPos = ( part + 1 ) * messageLength;
		const partText = fishChunk.substring( startPos, endPos );
		if ( partText )
		{
			// Modify this part to handle headers
			let lines = partText.split( "BREAKLINE" );
			// some lines are empty, so we need to filter them out
			lines = lines.filter( line => { return line.trim() !== "" });
			const processedLines = lines.map( line =>
			{
				line = line.trim();
				if ( line.includes( "BOLDTEXT" ) )
				{
					line = line.replace( "BOLDTEXT", "" );
					return normalizeMessage( `\n📝 ${markdownCodes.bold}${line.trim()}${markdownCodes.bold}\n` );
				}
				else if ( line.includes( "FOOTERLINE" ) )
				{
					return normalizeMessage( "\n🔖 ارجاعات" );
				}
				return normalizeMessage( line );
			});

			fishTexts.push( processedLines.join( "\n" ) );
		}
	}

	if ( fishTexts.length <= 1 )
	{
		fishTexts.push( normalizeMessage( "فیشی برای این آیه پیدا نشد." ) );
	}

	fishTexts.push( `[🔗 لینک به وب سایت](${url})` );
	return fishTexts.join( "\n\n" );
}

exports.calculateTotalTafsirParts = async function ( currentSurahNumber, currentAyahNumber )
{
	const url = `https://quran.makarem.ir/fa/interpretation?sura=${currentSurahNumber}&verse=${currentAyahNumber}`;
	const rdrview = await getReadabilityOutput( url );
	const $ = cheerio.load( cleanHtmlContent( rdrview ) );

	const pageElement = $( ".page" );
	if ( pageElement.length === 0 ) return 0;

	const tafsirElements = pageElement.find( "p, h3, h6" );
	let totalLength = 0;
	tafsirElements.each( ( index, element ) =>
	{
		totalLength += $( element ).text().trim().length;
	});

	return Math.ceil( totalLength / messageLength );
}

exports.calculateTotalKhameneiParts = async function ( currentSurahNumber, currentAyahNumber )
{
	const url = `https://farsi.khamenei.ir/newspart-index?sid=${currentSurahNumber}&npt=7&aya=${currentAyahNumber}`;
	const rdrview = await getReadabilityOutput( url );
	const $ = cheerio.load( cleanHtmlContent( rdrview ) );
	const totalLength = $( "#npTL" ).text().trim().length;
	return Math.ceil( totalLength / messageLength );
}

exports.isTafsirNemunehReadByUser = async function ( chatId, verseRefIndex )
{
	return await database.getTafsir( `${chatId}${verseRefIndex}` );
}

exports.isKhameneiReadByUser = async function ( chatId, verseRefIndex )
{
	return await database.getKhamenei( `${chatId}${verseRefIndex}` );
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