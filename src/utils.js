const { execSync } = require( "child_process" );
const axios = require( "axios" );
var { Readability } = require( "@mozilla/readability" );
var { JSDOM } = require( "jsdom" );
const cheerio = require( "cheerio" );
const _ = require( "lodash" );
const database = require( "./database" );
const quran = require( "../sources/quran.json" );
const { all_translations, perian_translations, actionCodes, messageLength, markdownCodes } = require( "./configs" )

exports.generateSaanNuzulMessage = async function generateSaanNuzulMessage ( verseRefIndex )
{
	const { currentSurahTitle, currentSurahTitlePersian, currentSurahNumber,
		currentSurahPersianNumber,	currentAyahNumber, currentAyahPersianNumber } = extractInfoByRefIndex( verseRefIndex );

	const url = `https://wiki.ahlolbait.com/آیه_${currentAyahNumber}_سوره_${currentSurahTitlePersian}`;
	const response = await axios.get( url, { responseType: "text/html" });
	let htmlString = response.data;
	htmlString = htmlString.replace( /\s+/g, " " ).trim();
	const $ = cheerio.load( htmlString );

	const saanNuzulTexts = [];
	let headerTest = `> ${currentSurahTitle} 🕊️ شان نزول 📖 ${currentSurahPersianNumber}:${currentAyahPersianNumber}`;
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
	const result = saanNuzulTexts.join( "\n\n" );
	return result;
}

exports.generateTafsirNemunehMessage = async function generateTafsirNemunehMessage ( verseRefIndex, part )
{
	const { currentSurahTitle, currentSurahNumber, currentSurahPersianNumber,
		currentAyahNumber, currentAyahPersianNumber } = extractInfoByRefIndex( verseRefIndex );

	const url = `https://quran.makarem.ir/fa/interpretation?sura=${currentSurahNumber}&verse=${currentAyahNumber}`;
	const rdrview = await getReadabilityOutput( url )
	rdrviewTrim = rdrview.replace( /\s+/g, " " ).trim();
	const $ = cheerio.load( rdrviewTrim );

	const translationTexts = [];
	let totalMessageLength = 0;
	let limitReached = false;
	let headerTest = `> ${currentSurahTitle} 🕊️ تفسیر نمونه 📖 ${currentSurahPersianNumber}:${currentAyahPersianNumber}`
	const element = $( ".page" );
	if ( element.length > 1 )
	{
		console.error( `Found more than one interpretation text for ${currentSurahTitle} ${currentAyahNumber}` );
	}
	if ( element.length > 0 )
	{
		translationTexts.push( normalizeMessage( headerTest ) );
		const elementsAfterFirstH3 = element.find( "p, h3, h6" );
		elementsAfterFirstH3.each( ( index, element ) =>
		{
			if ( limitReached ) return;
			const tafsirChunk = $( element ).text().trim()
			if ( !tafsirChunk ) return
			const addMessage = canAddToMessage( totalMessageLength, tafsirChunk, part )
			if ( addMessage == -1 )
			{
				limitReached = true;
				return false;
			}
			if ( addMessage )
			{
				if ( element.name == "p" )
				{
					translationTexts.push( normalizeMessage( tafsirChunk ) );
				}
				else if ( element.name == "h3" || element.name == "h6" )
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
	};
	if ( translationTexts.length <= 1 )
	{
		translationTexts.push( normalizeMessage( "تفسیری برای این آیه پیدا نشد. معمولا در آیات قبلی یا بعدی تفسیری قرار دارد" ) );
	}
	translationTexts.push( `[🔗 لینک به وب سایت تفسیر](${url})` );
	const result = translationTexts.join( "\n\n" );
	return result;
}

exports.generateMessage = function generateMessage ( refIndex, transaltionCode = actionCodes.makarem )
{
	const {
		currentSurahTitle,
		currentSurahNumber,
		currentSurahPersianNumber,
		currentAyahNumber,
		currentAyahPersianNumber
	} = extractInfoByRefIndex( refIndex );

	const currentAyah = quran[refIndex];
	let prevAyah = null;
	let nextAyah = null;

	if ( refIndex - 1 >= 0 && quran[refIndex - 1].surah.number === currentSurahNumber )
	{
		prevAyah = quran[refIndex - 1];
	}

	if ( refIndex + 1 < quran.length && quran[refIndex + 1].surah.number === currentSurahNumber )
	{
		nextAyah = quran[refIndex + 1];
	}

	const translator = all_translations[transaltionCode];
	const arabicTranslator = all_translations[actionCodes.arabicIrabText];

	if ( !translator )
	{
		throw new Error( `Invalid translation code: ${transaltionCode}` );
	}

	let translatorWord = "ترجمه";
	if ( transaltionCode === "h" )
	{
		translatorWord = "متن";
	}

	let prevAyahText = "";
	if ( prevAyah )
	{
		if ( perian_translations[transaltionCode] )
		{
			prevAyahText = `${prevAyah.verse[arabicTranslator.key]} ۝ ${currentAyahNumber - 1}
${prevAyah.verse[translator.key]}\n`;
		}
		else
		{
			prevAyahText = `${prevAyah.verse[translator.key]} ۝ ${currentAyahNumber - 1}\n`;
		}
	}

	let currentAyahText = "";
	if ( perian_translations[transaltionCode] )
	{
		currentAyahText = `${currentAyah.verse[arabicTranslator.key]} ۝ ${currentAyahPersianNumber}
${currentAyah.verse[translator.key]}\n`;
	}
	else
	{
		currentAyahText = `${currentAyah.verse[translator.key]} ۝ ${currentAyahPersianNumber}\n`;
	}

	let nextAyahText = "";
	if ( nextAyah )
	{
		if ( perian_translations[transaltionCode] )
		{
			nextAyahText = `${nextAyah.verse[arabicTranslator.key]} ۝ ${currentAyahNumber + 1}
${nextAyah.verse[translator.key]}`;
		}
		else
		{
			nextAyahText = `${nextAyah.verse[translator.key]} ۝ ${currentAyahNumber + 1}`;
		}
	}

	let message = `> ${currentSurahTitle} 🕊️ ${translatorWord} ${translator.farsi} 📖 ${currentSurahPersianNumber}:${currentAyahPersianNumber}\n\n${prevAyahText}
${currentAyahText}
${nextAyahText}`;
	return normalizeMessage( message );
}

exports.genButtons = async function genButtons (
	verseRefIndex, searchRefIndex, refResults,
	{ actionCode, lastTranslaction, chatId, messageId }
)
{
	const refIndexesStr = refResults.map( index =>
	{
		return index === searchRefIndex ? `@${index}` : index
	}).join( "," );
	const toggle_verse_ref = `${actionCode}${lastTranslaction}${actionCodes.toggleRead}${verseRefIndex}_${refIndexesStr}`; // i1475_@1463,6155,106,1053,2000,6149,392,592
	const verse_ref = `${actionCode}${lastTranslaction}${actionCodes.others}${verseRefIndex}_${refIndexesStr}`; // iy1475_@1463,6155,106,1053,2000,6149,392,592
	if ( actionCodes.tafsirNemooneh.includes( actionCode ) )
	{
		const { currentSurahNumber, currentAyahNumber } = extractInfoByRefIndex( verseRefIndex );
		const totalParts = await calculateTotalTafsirParts( currentSurahNumber, currentAyahNumber );
		const tafsirButtons = [];
		for ( let index = 0; index < totalParts; index++ )
		{
			const code = actionCodes.tafsirNemooneh[index]
			tafsirButtons.push({
				text: code === actionCode ? `✅ ${index + 1}` : `${index + 1}`,
				callback_data: `${code}${verse_ref}`
			})
		}
		tafsirButtons.reverse()
		const tafsirButtonsLines = [];
		for ( let i = 0; i < tafsirButtons.length; i += 5 )
		{
			tafsirButtonsLines.push( tafsirButtons.slice( i, i + 5 ) );
		}
		tafsirButtonsLines.reverse()
		const isRead = await isTafsirNemunehReadByUser( chatId, verseRefIndex )
		tafsirButtonsLines.push( [{
			text: isRead === true ? "مطالعه شده ✅" : "مطالعه نشده",
			callback_data: `${actionCode}${toggle_verse_ref}`
		}] )
		return [
			[
				{
					text: "تفسیر نمونه",
					callback_data: `${actionCodes.tafsirNemooneh[0]}${verse_ref}`
				}
			],
			...tafsirButtonsLines,
			[
				{ text: "صفحه ی اصلی", callback_data: `${actionCodes.mainPage}${verse_ref}` }
			]
		];
	}
	if ( actionCodes.khamenei.includes( actionCode ) )
	{
		const { currentSurahNumber, currentAyahNumber } = extractInfoByRefIndex( verseRefIndex );
		const totalParts = await calculateTotalKhameneiParts( currentSurahNumber, currentAyahNumber );
		const khameneiButtons = [];

		for ( let index = 0; index < totalParts; index++ )
		{
			const code = actionCodes.khamenei[index]
			khameneiButtons.push({
				text: code === actionCode ? `✅ ${index + 1}` : `${index + 1}`,
				callback_data: `${code}${verse_ref}`
			})
		}

		khameneiButtons.reverse()
		const buttonLines = [];
		for ( let i = 0; i < khameneiButtons.length; i += 5 )
		{
			buttonLines.push( khameneiButtons.slice( i, i + 5 ) );
		}
		buttonLines.reverse()

		const isRead = await isKhameneiReadByUser( chatId, verseRefIndex )

		buttonLines.push( [{
			text: isRead === true ? "مطالعه شده ✅" : "مطالعه نشده",
			callback_data: `${actionCode}${toggle_verse_ref}`
		}] )

		return [
			[{
				text: "فیش های رهبری",
				callback_data: `${actionCodes.khamenei[0]}${verse_ref}`
			}],
			...buttonLines,
			[{ text: "صفحه ی اصلی", callback_data: `${actionCodes.mainPage}${verse_ref}` }]
		];
	}

	return buttons = [
		[
			{ text: "آیه ی بعد ⬅️", callback_data: `${actionCodes.nextVerse}${verse_ref}` },
			{ text: "➡️ آیه ی قبل", callback_data: `${actionCodes.prevVerse}${verse_ref}` }
		],
		Object.entries( perian_translations ).map( ( [key, value] ) => { return { text: value.farsi, callback_data: `${key}${verse_ref}` } }),
		[
			{ text: "تفسیر نمونه", callback_data: `${actionCodes.tafsirNemooneh[0]}${verse_ref}` },
			{ text: "فیش های رهبری", callback_data: `${actionCodes.khamenei[0]}${verse_ref}` },
			{
				text: "شان نزول",
				callback_data: `${actionCodes.saanNuzul}${verse_ref}`
			}
		],
		[
			{ text: "نتیجه بعد 🔍", callback_data: `${actionCodes.nextResult}${verse_ref}` },
			{ text: "🔎 نتیجه قبل", callback_data: `${actionCodes.prevResult}${verse_ref}` }
		]
	];
}

exports.sendMessageWithRetry = async function sendMessageWithRetry ( bot, chatId, message, options, retries = 10 )
{
	for ( let i = 0; i < retries; i++ )
	{
		try
		{
			await bot.sendMessage( chatId, message, options );
			break;
		}
		catch ( error )
		{
			if ( isNetworkError( error ) )
			{
				console.log( `Retrying due to socket hang up... Attempts left: ${retries - i - 1}` );
				await sleep( 50 )
			}
			else
			{
				throw error;
			}
		}
	}
}

exports.editMessageWithRetry = async function editMessageWithRetry ( bot, message, options, retries = 10 )
{
	for ( let i = 0; i < retries; i++ )
	{
		try
		{
			await bot.editMessageText( message, options );
			break;
		}
		catch ( error )
		{
			if ( isNetworkError( error ) )
			{
				console.log( `Retrying due to socket hang up... Attempts left: ${retries - i - 1}` );
				await sleep( 50 )
			}
			else
			{
				throw error;
			}
		}
	}
}

exports.editMessageReplyMarkupWithRetry = async function editMessageReplyMarkupWithRetry ( bot, replyMerkup, options, retries = 10 )
{
	for ( let i = 0; i < retries; i++ )
	{
		try
		{
			await bot.editMessageReplyMarkup( replyMerkup, options );
			break;
		}
		catch ( error )
		{
			if ( isNetworkError( error ) )
			{
				console.log( `Retrying due to socket hang up... Attempts left: ${retries - i - 1}` );
				await sleep( 50 )
			}
			else
			{
				throw error;
			}
		}
	}
}

exports.generateKhameneiMessage = async function generateKhameneiMessage ( verseRefIndex, part )
{
	const { currentSurahNumber, currentAyahNumber, currentSurahTitle,
		currentSurahPersianNumber, currentAyahPersianNumber } = extractInfoByRefIndex( verseRefIndex );

	const url = `https://farsi.khamenei.ir/newspart-index?sid=${currentSurahNumber}&npt=7&aya=${currentAyahNumber}`;
	const rdrview = await getReadabilityOutput( url );
	const rdrviewTrim = rdrview.replace( /\s+/g, " " ).trim();
	const $ = cheerio.load( rdrviewTrim );

	const fishTexts = [];
	let headerText = `> ${currentSurahTitle} 🕊️ فیش های رهبری 📖 ${currentSurahPersianNumber}:${currentAyahPersianNumber}`;
	fishTexts.push( normalizeMessage( headerText ) );
	$( "article" ).before( "<br>" );
	$( "br" ).replaceWith( "\n\n" );
	const $content = $( "#npTL" );
	const fishChunk = $( "#npTL" ).text().trim();
	if ( fishChunk )
	{
		const startPos = part * messageLength;
		const endPos = ( part + 1 ) * messageLength;
		const partText = fishChunk.substring( startPos, endPos );
		if ( partText )
		{
			fishTexts.push( normalizeMessage( partText ) );
		}
	}

	if ( fishTexts.length <= 1 )
	{
		fishTexts.push( normalizeMessage( "فیشی برای این آیه پیدا نشد." ) );
	}

	fishTexts.push( `[🔗 لینک به وب سایت](${url})` );
	return fishTexts.join( "\n\n" );
}

async function isTafsirNemunehReadByUser ( chatId, verseRefIndex )
{
	return await database.getTafsir( `${chatId}${verseRefIndex}` );
}

async function isKhameneiReadByUser ( chatId, verseRefIndex )
{
	return await database.getKhamenei( `${chatId}${verseRefIndex}` );
}

async function calculateTotalTafsirParts ( currentSurahNumber, currentAyahNumber )
{
	const url = `https://quran.makarem.ir/fa/interpretation?sura=${currentSurahNumber}&verse=${currentAyahNumber}`;
	const rdrview = await getReadabilityOutput( url );
	const rdrviewTrim = rdrview.replace( /\s+/g, " " ).trim();
	const $ = cheerio.load( rdrviewTrim );
	const pageElement = $( ".page" );
	if ( pageElement.length === 0 )
	{
		console.error( `No interpretation text found for Surah ${currentSurahNumber}, Ayah ${currentAyahNumber}` );
		return 0;
	}
	const tafsirElements = pageElement.find( "p, h3, h6" );
	let totalLength = 0;
	tafsirElements.each( ( index, element ) =>
	{
		totalLength += $( element ).text().trim().length;
	});
	return Math.ceil( totalLength / messageLength );
};

async function calculateTotalKhameneiParts ( currentSurahNumber, currentAyahNumber )
{
	const url = `https://farsi.khamenei.ir/newspart-index?sid=${currentSurahNumber}&npt=7&aya=${currentAyahNumber}`;
	const rdrview = await getReadabilityOutput( url );
	const rdrviewTrim = rdrview.replace( /\s+/g, " " ).trim();
	const $ = cheerio.load( rdrviewTrim );

	const totalLength = $( "#npTL" ).text().trim().length;
	return Math.ceil( totalLength / messageLength );
}

function extractInfoByRefIndex ( refIndex )
{
	const currentSurahTitle = quran[refIndex].surah.arabic;
	const currentSurahTitlePersian = quran[refIndex].surah.farsi;
	const currentSurahNumber = quran[refIndex].surah.number;
	const currentSurahPersianNumber = quran[refIndex].surah.persian_number;
	const currentAyahNumber = quran[refIndex].ayah;
	const currentAyahPersianNumber = quran[refIndex].ayah_persian;
	return { currentSurahTitle, currentSurahTitlePersian, currentSurahNumber, currentSurahPersianNumber, currentAyahNumber, currentAyahPersianNumber };
}

function canAddToMessage ( totalLength, newText, part )
{
	if ( totalLength + newText.length > ( part + 1 ) * messageLength )
	{
		return -1;
	}
	return (
		totalLength + newText.length >= part * messageLength &&
		totalLength + newText.length <= ( part + 1 ) * messageLength
	);
}

function normalizeMessage ( message )
{
	return toPersian( message.replace( /!/g, "\\!" ).replace( /\./g, "\\." )
	.replace( /-/g, "\\-" ).replace( /\(/g, "\\(" ).replace( /\)/g, "\\)" )
	.replace( /\]/g, "\\]" ).replace( /\[/g, "\\[" ).replace( /_/g, "\\_" )
	.replace( /\*/g, "\\*" ) // commenting this will cause problem if message contains opening start but not closed like: *something
	// message must be like this in MarkdownV2 format: *something*
	.replace( /\{/g, "\\{" ).replace( /\}/g, "\\}" )
	.replace( /\=/g, "\\=" )
	.replace( new RegExp( `${markdownCodes.bold}(.*?)${markdownCodes.bold}`, "g" ), ( match, p1 ) => { return `*${p1}*` }) );
}

async function getReadabilityOutput ( url )
{
	try
	{
		const dom = await JSDOM.fromURL( url );
		const reader = new Readability( dom.window.document );
		const article = reader.parse();
		return article.content;
	}
	catch ( error )
	{
		return `Error executing command: ${error.message}`;
	}
}

function isNetworkError ( error )
{
	return error.message.includes( "socket hang up" ) || error.message.includes( "network socket disconnected" );
}

async function sleep ( time )
{
	await new Promise( resolve => { return setTimeout( resolve, time ) });
}

const persian_numbers_map = {
	"0": "۰",
	"1": "۱",
	"2": "۲",
	"3": "۳",
	"4": "۴",
	"5": "۵",
	"6": "۶",
	"7": "۷",
	"8": "۸",
	"9": "۹"
}

function toPersian ( number )
{
	return number.toString().split( "" ).map( char => { return persian_numbers_map[char] || char }).join( "" );
}
