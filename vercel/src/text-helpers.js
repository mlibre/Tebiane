const { markdownCodes, quranData } = require( "./config.js" );


const PERSIAN_NUMBERS = {
	"0": "۰", "1": "۱", "2": "۲", "3": "۳", "4": "۴",
	"5": "۵", "6": "۶", "7": "۷", "8": "۸", "9": "۹"
};

function extractInfoByRefIndex ( refIndex )
{
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

function normalizeMessage ( message )
{
	if ( typeof message !== "string" )
	{
		console.warn( "normalizeMessage received non-string input:", message );
		message = String( message ); // Attempt to convert
	}
	const escapedMessage = message
	.replace( /[!._*\[\](){}=-]/g, char => { return `\\${char}` });

	return toPersian( escapedMessage.replace(
		new RegExp( `${markdownCodes.bold}(.*?)${markdownCodes.bold}`, "g" ),
		( _, text ) => { return `*${text}*` }
	) );
}

function toPersian ( text )
{
	if ( typeof text !== "string" )
	{
		return ""; // Return empty string for non-string input
	}
	return text
	.split( "" )
	.map( char => { return PERSIAN_NUMBERS[char] || char })
	.join( "" );
}

module.exports = {
	extractInfoByRefIndex,
	normalizeMessage,
	toPersian,
	PERSIAN_NUMBERS
};