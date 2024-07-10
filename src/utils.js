const quran = require( "../sources/quran.json" );
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
	const currentSurahTitle = quran[refIndex].surah.arabic;
	const currentSurahNumber = quran[refIndex].surah.number;
	const currentSurahPersianNumber = quran[refIndex].surah.persian_number;
	const currentAyahNumber = quran[refIndex].ayah;
	const currentAyahPersianNumber = quran[refIndex].ayah_persian;

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
	let message = `> ${currentSurahTitle} - ${translator.farsi} - ${currentSurahPersianNumber}:${currentAyahPersianNumber}\n\n${
		prevAyah ? `${prevAyah.verse[translator.key]} ۝ ${toPersian( currentAyahNumber - 1 )}\n` : ""}
		${currentAyah.verse[translator.key]} ۝ ${currentAyahPersianNumber}\n
		${nextAyah ? `${nextAyah.verse[translator.key]} ۝ ${toPersian( currentAyahNumber + 1 )}` : ""}`;

	message = message.replace( /!/g, "\\!" ).replace( /\./g, "\\." )
	.replace( /-/g, "\\-" ).replace( /\(/g, "\\(" ).replace( /\)/g, "\\)" )
	.replace( /\]/g, "\\]" ).replace( /\[/g, "\\[" ).replace( /_/g, "\\_" )
	.replace( /\*/g, "\\*" ).replace( /\{/g, "\\{" ).replace( /\}/g, "\\}" )
	.replace( /\=/g, "\\=" );

	return message;
}

exports.buttons = function buttons ( verseRefIndex, refIndex, refIndexes )
{
	const refIndexesStr = refIndexes.map( index => { return index === refIndex ? `@${index}` : index }).join( "," );
	const verseAndRef = `${verseRefIndex}_${refIndexesStr}`;
	const buttons = [
		[{ text: "⬅️", callback_data: `a${verseAndRef}` }, { text: "➡️", callback_data: `b${verseAndRef}` }],
		Object.entries( perian_translations ).map( ( [key, value] ) => { return { text: value.farsi, callback_data: `${key}${verseAndRef}` } }),
		[{
			text: "عربی",
			callback_data: `h${verseAndRef}`,
		}],
		[{ text: "آیه ی بعد", callback_data: `i${verseAndRef}` }, { text: "آیه ی قبل", callback_data: `j${verseAndRef}` }]
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