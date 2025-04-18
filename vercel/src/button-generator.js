const { perian_translations, actionCodes } = require( "./config.js" );
const { extractInfoByRefIndex } = require( "./text-helpers.js" );
const {
	calculateTotalTafsirParts,
	calculateTotalKhameneiParts,
	isTafsirNemunehReadByUser,
	isKhameneiReadByUser
} = require( "./interpretations.js" );

// Generic function to create paginated buttons
async function createPaginatedButtons ({
	verseRefIndex,
	searchRefIndex,
	refResults,
	userOptions,
	buttonConfig
})
{
	const {
		actionCode,
		lastTranslaction,
		chatId
	} = userOptions;

	const refIndexesStr = refResults.map( index =>
	{ return index === searchRefIndex ? `@${index}` : index }).join( "," );

	const toggle_verse_ref = `${actionCode}${lastTranslaction}${actionCodes.toggleRead}${verseRefIndex}_${refIndexesStr}`;
	const verse_ref = `${actionCode}${lastTranslaction}${actionCodes.others}${verseRefIndex}_${refIndexesStr}`;

	const {
		calculateTotalParts,
		isReadByUser,
		mainButtonText,
		mainButtonActionCode,
		actionCodes: buttonActionCodes
	} = buttonConfig;

	const { currentSurahNumber, currentAyahNumber } = extractInfoByRefIndex( verseRefIndex );
	const totalParts = await calculateTotalParts( currentSurahNumber, currentAyahNumber );

	const buttons = [];
	for ( let index = 0; index < totalParts; index++ )
	{
		const code = buttonActionCodes[index];
		buttons.push({
			text: code === actionCode ? `✅ ${index + 1}` : `${index + 1}`,
			callback_data: `${code}${verse_ref}`
		});
	}

	buttons.reverse();
	const buttonLines = [];
	for ( let i = 0; i < buttons.length; i += 5 )
	{
		buttonLines.push( buttons.slice( i, i + 5 ) );
	}
	buttonLines.reverse();

	const isRead = await isReadByUser( chatId, verseRefIndex );
	buttonLines.push( [{
		text: isRead === true ? "مطالعه شده ✅" : "مطالعه نشده",
		callback_data: `${actionCode}${toggle_verse_ref}`
	}] );

	return [
		[{
			text: mainButtonText,
			callback_data: `${mainButtonActionCode}${verse_ref}`
		}],
		...buttonLines,
		[{ text: "صفحه ی اصلی", callback_data: `${actionCodes.mainPage}${verse_ref}` }]
	];
}

async function genButtons (
	verseRefIndex, searchRefIndex, refResults,
	{ actionCode, lastTranslaction, chatId, messageId }
)
{
	const refIndexesStr = refResults.map( index =>
	{ return index === searchRefIndex ? `@${index}` : index }).join( "," );
	const verse_ref = `${actionCode}${lastTranslaction}${actionCodes.others}${verseRefIndex}_${refIndexesStr}`;

	// Tafsir Nemooneh specific configuration
	if ( actionCodes.tafsirNemooneh.includes( actionCode ) )
	{
		return await createPaginatedButtons({
			verseRefIndex,
			searchRefIndex,
			refResults,
			userOptions: { actionCode, lastTranslaction, chatId },
			buttonConfig: {
				calculateTotalParts: calculateTotalTafsirParts,
				isReadByUser: isTafsirNemunehReadByUser,
				mainButtonText: "تفسیر نمونه",
				mainButtonActionCode: actionCodes.tafsirNemooneh[0],
				actionCodes: actionCodes.tafsirNemooneh
			}
		});
	}

	// Khamenei specific configuration
	if ( actionCodes.khamenei.includes( actionCode ) )
	{
		return await createPaginatedButtons({
			verseRefIndex,
			searchRefIndex,
			refResults,
			userOptions: { actionCode, lastTranslaction, chatId },
			buttonConfig: {
				calculateTotalParts: calculateTotalKhameneiParts,
				isReadByUser: isKhameneiReadByUser,
				mainButtonText: "فیش های رهبری",
				mainButtonActionCode: actionCodes.khamenei[0],
				actionCodes: actionCodes.khamenei
			}
		});
	}

	// Default buttons when no specific pagination is needed
	return [
		[
			{ text: "آیه ی بعد ⬅️", callback_data: `${actionCodes.nextVerse}${verse_ref}` },
			{ text: "➡️ آیه ی قبل", callback_data: `${actionCodes.prevVerse}${verse_ref}` }
		],
		Object.entries( perian_translations ).map( ( [key, value] ) =>
		{
			const isCurrentTranslation = key === lastTranslaction;
			return {
				text: isCurrentTranslation ? `${value.farsi} ✅` : value.farsi,
				callback_data: `${key}${verse_ref}`
			};
		}),
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

module.exports = {
	genButtons
};
