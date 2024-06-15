const fs = require( "fs" );
const json1 = require( "../sources/fa.makarem.json" );
const json2 = require( "../sources/fa.ansarian.json" );
const json3 = require( "../sources/fa.fooladvand.json" );
const json4 = require( "../sources/fa.mojtabavi.json" );
const json5 = require( "../sources/en.arberry.json" );
const json6 = require( "../sources/quran-simple-clean.json" );
const json7 = require( "../sources/quran-simple-enhanced.json" );
const surahsNames = require( "../sources/surahs_names.json" );

function findSurahDetails ( surahNumber )
{
	return surahsNames.find( surah => { return surah.num === surahNumber.toString() });
}

function mergeVersesToArray ( ...jsons )
{
	const merged = [];

	jsons.forEach( json =>
	{
		for ( const translator in json.quran )
		{
			for ( const id in json.quran[translator] )
			{
				const verse = json.quran[translator][id];
				const surahDetails = findSurahDetails( verse.surah );
				if ( !merged.some( item => { return item.id === parseInt( id ) }) )
				{
					merged.push({
						id: parseInt( id ),
						surah: {
							number: verse.surah,
							arabic: surahDetails.arabicTitle,
							english: surahDetails.englishTitle,
							farsi: surahDetails.farsiTitle
						},
						ayah: verse.ayah,
						verse: {}
					});
				}
				const index = merged.findIndex( item => { return item.id === parseInt( id ) });
				merged[index].verse[`${translator}`] = verse.verse;
			}
		}
	});

	return merged;
}

const mergedJsonArray = mergeVersesToArray( json1, json2, json3, json4, json5, json6, json7 );
fs.writeFileSync( "./quran.json", JSON.stringify( mergedJsonArray, null, 2 ) );
