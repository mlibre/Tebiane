const quran = require( "../../sources/quran.json" )
const { markdownCodes, messageLength } = require( "../configs" )

const PERSIAN_NUMBERS = {
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

function extractInfoByRefIndex ( refIndex )
{
	const verse = quran[refIndex]
	return {
		currentSurahTitle: verse.surah.arabic,
		currentSurahTitlePersian: verse.surah.farsi,
		currentSurahNumber: verse.surah.number,
		currentSurahPersianNumber: verse.surah.persian_number,
		currentAyahNumber: verse.ayah,
		currentAyahPersianNumber: verse.ayah_persian
	}
}

function normalizeMessage ( message )
{
	const escapedMessage = message
	.replace( /[!._*\[\](){}=-]/g, char => { return `\\${char}` })

	return toPersian( escapedMessage.replace(
		new RegExp( `${markdownCodes.bold}(.*?)${markdownCodes.bold}`, "g" ),
		( _, text ) => { return `*${text}*` }
	) )
}

function toPersian ( text )
{
	return text
	.split( "" )
	.map( char => { return PERSIAN_NUMBERS[char] || char })
	.join( "" )
}

module.exports = {
	extractInfoByRefIndex,
	normalizeMessage
}