const quran = require( "../../sources/quran.json" );
const { all_translations, perian_translations, actionCodes } = require( "../configs" );
const { normalizeMessage, extractInfoByRefIndex } = require( "./text-helpers" );

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
