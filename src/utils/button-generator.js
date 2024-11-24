const { perian_translations, actionCodes } = require( "../configs" );
const { extractInfoByRefIndex } = require( "./text-helpers" );
const { calculateTotalTafsirParts, calculateTotalKhameneiParts,
	isTafsirNemunehReadByUser, isKhameneiReadByUser } = require( "./interpretations" );

exports.genButtons = async function genButtons (
	verseRefIndex, searchRefIndex, refResults,
	{ actionCode, lastTranslaction, chatId, messageId }
)
{
	const refIndexesStr = refResults.map( index =>
	{
		return index === searchRefIndex ? `@${index}` : index
	}).join( "," );
	const toggle_verse_ref = `${actionCode}${lastTranslaction}${actionCodes.toggleRead}${verseRefIndex}_${refIndexesStr}`;
	const verse_ref = `${actionCode}${lastTranslaction}${actionCodes.others}${verseRefIndex}_${refIndexesStr}`;

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
			[{
				text: "تفسیر نمونه",
				callback_data: `${actionCodes.tafsirNemooneh[0]}${verse_ref}`
			}],
			...tafsirButtonsLines,
			[{ text: "صفحه ی اصلی", callback_data: `${actionCodes.mainPage}${verse_ref}` }]
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

	return [
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
