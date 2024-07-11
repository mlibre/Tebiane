const quran = require( "../sources/quran.json" );
const axios = require( "axios" );
const cheerio = require( "cheerio" );
const _ = require( "lodash" );

const perian_translations = {
	"c": {
		farsi: "انصاریان",
		key: "farsi_ansarian"
	},
	"d": {
		farsi: "فولادوند",
		key: "farsi_fooladvand"
	},
	"e": {
		farsi: "مجتبوی",
		key: "farsi_mojtabavi"
	},
	"f": {
		farsi: "مکارم شیرازی",
		key: "farsi_makarem"
	}
};

const arabic_texts = {
	"g": {
		farsi: "عربی ساده",
		key: "arabic_clean"
	},
	"h": {
		farsi: "عربی با اعراب",
		key: "arabic_enhanced"
	}
}

const all_translations = { ...perian_translations, ...arabic_texts };
exports.all_translations = all_translations;

exports.generateMessage = function generateMessage ( refIndex, transaltionCode = "f" )
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
		prevAyah ? `${prevAyah.verse[translator.key]} ۝ ${toPersian( currentAyahNumber - 1 )}\n` : ""}
		${currentAyah.verse[translator.key]} ۝ ${currentAyahPersianNumber}\n
		${nextAyah ? `${nextAyah.verse[translator.key]} ۝ ${toPersian( currentAyahNumber + 1 )}` : ""}`;

	message = normalizeMessage( message );
	return message;
}

exports.generateTafsirNemunehMessage = async function generateTafsirNemunehMessage ( verseRefIndex )
{
	const { currentSurahTitle, currentSurahNumber, currentSurahPersianNumber,
		currentAyahNumber, currentAyahPersianNumber } = extractInfoByRefIndex( verseRefIndex );

	const url = `https://quran.makarem.ir/fa/interpretation?sura=${currentSurahNumber}&verse=${currentAyahNumber}`;

	const response = await axios.get( url, { responseType: "text/html" });
	let htmlString = response.data;
	htmlString = htmlString.replace( /\s+/g, " " ).trim();
	const $ = cheerio.load( htmlString );

	const translationTexts = [];
	let headerTest = `> ${currentSurahTitle} 🕊️ تفسیر نمونه 📖 ${currentSurahPersianNumber}:${currentAyahPersianNumber}`
	$( ".interpretation-text" ).each( ( index, element ) =>
	{
		const firstH3 = $( element ).find( "h3:first" );
		if ( firstH3.text() != "" )
		{
			headerTest += `\n\n 📝 ${ firstH3.text()}`;
		}
		translationTexts.push( normalizeMessage( headerTest ) );
		const psAfterFirstH3 = firstH3.nextAll( "p" );
		psAfterFirstH3.each( ( index, element ) =>
		{
			const tafsirText = $( element ).text()
			translationTexts.push( normalizeMessage( tafsirText ) );
		});
	});
	if ( translationTexts.length <= 1 )
	{
		translationTexts.push( normalizeMessage( "تفسیری برای این آیه پیدا نشد. معمولا در آیات قبلی یا بعدی تفسیری قرار دارد" ) );
	}
	translationTexts.push( `[🔗 لینک به وب سایت تفسیر](${url})` );
	return translationTexts.join( "\n\n" );
}

exports.buttons = function buttons ( verseRefIndex, refIndex, refIndexes )
{
	const refIndexesStr = refIndexes.map( index => { return index === refIndex ? `@${index}` : index }).join( "," );
	const verseAndRef = `${verseRefIndex}_${refIndexesStr}`;
	const buttons = [
		[{ text: "نتیجه بعد ⬅️", callback_data: `a${verseAndRef}` }, { text: "➡️ نتیجه قبل", callback_data: `b${verseAndRef}` }],
		Object.entries( perian_translations ).map( ( [key, value] ) => { return { text: value.farsi, callback_data: `${key}${verseAndRef}` } }),
		[{
			text: "عربی",
			callback_data: `h${verseAndRef}`,
		}],
		[{ text: "آیه ی بعد", callback_data: `i${verseAndRef}` }, { text: "آیه ی قبل", callback_data: `j${verseAndRef}` }],
		[{ text: "تفسیر نمونه", callback_data: `k${verseAndRef}` }]
	];
	return buttons;
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
				await sleep( 100 )
			}
			else
			{
				throw error;
			}
		}
	}
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
				await sleep( 100 )
			}
			else
			{
				throw error;
			}
		}
	}
}

exports.parseCallbackData = function parseCallbackData ( input )
{
	const action = input[0];
	const [verseRefIndexStr, refIndexesStr] = input.slice( 1 ).split( "_" );
	let refIndex = -1;
	const refIndexes = refIndexesStr.split( "," ).map( ( num, index ) =>
	{
		const tmp = parseInt( num.replace( "@", "" ), 10 );
		if ( num.includes( "@" ) )
		{
			refIndex = tmp;
		}
		return tmp;
	});
	return { action, refIndexes, refIndex, verseRefIndex: parseInt( verseRefIndexStr ) };
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

function normalizeMessage ( message )
{
	return message.replace( /!/g, "\\!" ).replace( /\./g, "\\." )
	.replace( /-/g, "\\-" ).replace( /\(/g, "\\(" ).replace( /\)/g, "\\)" )
	.replace( /\]/g, "\\]" ).replace( /\[/g, "\\[" ).replace( /_/g, "\\_" )
	.replace( /\*/g, "\\*" ) // commenting this will cause problem if message contains opening start but not closed like: *something
	// message must be like this in MarkdownV2 format: *something*
	.replace( /\{/g, "\\{" ).replace( /\}/g, "\\}" )
	.replace( /\=/g, "\\=" );
}

isNetworkError = function isNetworkError ( error )
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
	const chars = number.toString().split( "" ).map( char => { return persian_numbers_map[char] });
	return chars.join( "" );
}