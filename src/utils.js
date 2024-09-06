const axios = require( "axios" );
const cheerio = require( "cheerio" );
const _ = require( "lodash" );
const database = require( "./database" );
const quran = require( "../sources/quran.json" );
const { all_translations, perian_translations, actionCodes, messageLength, markdownCodes } = require( "./configs" )

exports.generateMessage = function generateMessage ( refIndex, transaltionCode = actionCodes.makarem )
{
	const { currentSurahTitle, currentSurahNumber, currentSurahPersianNumber,
		currentAyahNumber, currentAyahPersianNumber } = extractInfoByRefIndex( refIndex );

	let prevAyah = null;
	if ( refIndex - 1 >= 0 && quran[refIndex - 1].surah.number === currentSurahNumber )
	{
		prevAyah = quran[refIndex - 1];
	}
	const currentAyah = quran[refIndex];

	let nextAyah = null;
	if ( refIndex + 1 < quran.length && quran[refIndex + 1].surah.number === currentSurahNumber )
	{
		nextAyah = quran[refIndex + 1];
	}

	const translator = all_translations[transaltionCode]
	if ( !translator )
	{
		throw new Error( `Invalid translation code: ${transaltionCode}` );
	}
	let message = `> ${currentSurahTitle} 🕊️ ترجمه ${translator.farsi} 📖 ${currentSurahPersianNumber}:${currentAyahPersianNumber}\n\n${
		prevAyah ? `${prevAyah.verse[translator.key]} ۝ ${currentAyahNumber - 1}\n` : ""}
		${currentAyah.verse[translator.key]} ۝ ${currentAyahPersianNumber}\n
		${nextAyah ? `${nextAyah.verse[translator.key]} ۝ ${currentAyahNumber + 1}` : ""}`;

	message = normalizeMessage( message );
	return message;
}

exports.generateTafsirNemunehMessage = async function generateTafsirNemunehMessage ( verseRefIndex, part )
{
	const { currentSurahTitle, currentSurahNumber, currentSurahPersianNumber,
		currentAyahNumber, currentAyahPersianNumber } = extractInfoByRefIndex( verseRefIndex );

	const url = `https://quran.makarem.ir/fa/interpretation?sura=${currentSurahNumber}&verse=${currentAyahNumber}`;
	const response = await axios.get( url, { responseType: "text/html" });
	let htmlString = response.data;
	htmlString = htmlString.replace( /\s+/g, " " ).trim();
	const $ = cheerio.load( htmlString );

	const translationTexts = [];
	let totalMessageLength = 0;
	let limitReached = false;
	let headerTest = `> ${currentSurahTitle} 🕊️ تفسیر نمونه 📖 ${currentSurahPersianNumber}:${currentAyahPersianNumber}`
	const element = $( ".interpretation-text" );
	if ( element.length > 1 )
	{
		console.error( `Found more than one interpretation text for ${currentSurahTitle} ${currentAyahNumber}` );
	}
	if ( element.length > 0 )
	{
		let firstH = $( element ).find( "h3:first" );
		if ( firstH.length === 0 )
		{
			firstH = $( element ).find( "h6:first" );
		}
		if ( firstH.text() != "" && part == 0 )
		{
			headerTest += `\n\n 📝 ${markdownCodes.bold}${ firstH.text()}${markdownCodes.bold}`;
		}
		translationTexts.push( normalizeMessage( headerTest ) );
		const elementsAfterFirstH3 = firstH.nextAll( "p, h3, h6" );
		elementsAfterFirstH3.each( ( index, element ) =>
		{
			if ( limitReached ) return;
			const tafsirChunk = $( element ).text()
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

exports.genButtons = async function genButtons (
	verseRefIndex, searchRefIndex, refResults,
	{ actionCode, lastTranslaction, chatId, messageId }
)
{
	const refIndexesStr = refResults.map( index =>
	{
		return index === searchRefIndex ? `@${index}` : index
	}).join( "," );
	const verse_ref = `${actionCode}${lastTranslaction}${verseRefIndex}_${refIndexesStr}`; // i1475_@1463,6155,106,1053,2000,6149,392,592
	const read_verse_ref = `${actionCode}${lastTranslaction}${actionCodes.others}${verseRefIndex}_${refIndexesStr}`; // iy1475_@1463,6155,106,1053,2000,6149,392,592
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
				callback_data: `${code}${read_verse_ref}`
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
			callback_data: `${actionCode}${actionCodes.toggleRead}${verse_ref}`
		}] )
		return [
			[{
				text: "تفسیر نمونه",
				callback_data: `${actionCodes.tafsirNemooneh[0]}${read_verse_ref}`
			}],
			...tafsirButtonsLines,
			[
				{ text: "صفحه ی اصلی", callback_data: `${actionCodes.mainPage}${read_verse_ref}` }
			]
		];
	}
	return buttons = [
		[
			{ text: "آیه ی بعد ⬅️", callback_data: `${actionCodes.nextVerse}${read_verse_ref}` },
			{
				text: "🇸🇦 متن عربی 🇸🇦",
				callback_data: `${actionCodes.arabicIrabText}${read_verse_ref}`,
			},
			{ text: "➡️ آیه ی قبل", callback_data: `${actionCodes.prevVerse}${read_verse_ref}` }
		],
		Object.entries( perian_translations ).map( ( [key, value] ) => { return { text: value.farsi, callback_data: `${key}${read_verse_ref}` } }),
		[
			{ text: "تفسیر نمونه", callback_data: `${actionCodes.tafsirNemooneh[0]}${read_verse_ref}` }
		],
		// [{
		// 	text: "سایر",
		// 	callback_data: `${actionCodes.others}${verseAndRef}`,
		// }],
		[
			{ text: "نتیجه بعد 🔍", callback_data: `${actionCodes.nextResult}${read_verse_ref}` },
			{ text: "🔎 نتیجه قبل", callback_data: `${actionCodes.prevResult}${read_verse_ref}` }
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

async function isTafsirNemunehReadByUser ( chatId, verseRefIndex )
{
	return await database.getTafsir( `${chatId}${verseRefIndex}` );
}

async function calculateTotalTafsirParts ( currentSurahNumber, currentAyahNumber )
{
	const url = `https://quran.makarem.ir/fa/interpretation?sura=${currentSurahNumber}&verse=${currentAyahNumber}`;
	const response = await axios.get( url, { responseType: "text/html" });
	let htmlString = response.data;
	htmlString = htmlString.replace( /\s+/g, " " ).trim();
	const $ = cheerio.load( htmlString );

	const elementsAfterFirstH3 = $( ".interpretation-text" ).find( "h3:first, h6:first" ).nextAll( "p, h3, h6" );
	let totalLength = 0;
	elementsAfterFirstH3.each( ( index, element ) =>
	{
		totalLength += $( element ).text().length;
	});

	return Math.ceil( totalLength / messageLength );
}

function extractInfoByRefIndex ( refIndex )
{
	const currentSurahTitle = quran[refIndex].surah.arabic;
	const currentSurahNumber = quran[refIndex].surah.number;
	const currentSurahPersianNumber = quran[refIndex].surah.persian_number;
	const currentAyahNumber = quran[refIndex].ayah;
	const currentAyahPersianNumber = quran[refIndex].ayah_persian;
	return { currentSurahTitle, currentSurahNumber, currentSurahPersianNumber, currentAyahNumber, currentAyahPersianNumber };
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