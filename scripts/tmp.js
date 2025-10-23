const fsp = require( "fs/promises" );
const path = require( "path" );
const chalk = require( "chalk" );

// --- Configuration ---
// The original file with all translations
const INPUT_QURAN_FILE = path.join( __dirname, "../sources/quran.json" );
// The new file that will be created with the simplified structure
const OUTPUT_QURAN_FILE = path.join( __dirname, "../sources/quran_lean_for_comparison.json" );

/**
 * This script reads a comprehensive Quran JSON file and converts it to a "lean"
 * format, keeping only the fields necessary for comparison with the scraped data.
 */
async function main ()
{
	console.log( chalk.blue( "[*] Starting conversion to lean Quran format..." ) );

	try
	{
		// 1. Read the original source file
		console.log( `[*] Reading input file: ${chalk.cyan( INPUT_QURAN_FILE )}` );
		const fileContent = await fsp.readFile( INPUT_QURAN_FILE, "utf-8" );

		// 2. Parse the JSON data
		console.log( "[*] Parsing JSON data..." );
		const originalData = JSON.parse( fileContent );

		if ( !Array.isArray( originalData ) )
		{
			throw new Error( "Input file does not contain a valid JSON array." );
		}
		console.log( `[*] Found ${originalData.length} verses to process.` );


		// 3. Transform the data into the new, lean format
		console.log( "[*] Transforming data structure..." );
		const leanData = originalData.map( ( verseObj ) =>
		{
			// For each verse, create a new object with the desired structure.
			// We use optional chaining (?.) and nullish coalescing (|| '') to prevent
			// errors if a verse object is missing properties.
			return {
				id: verseObj.id,
				id_persian: verseObj.id_persian,
				surah: verseObj.surah,
				ayah: verseObj.ayah,
				ayah_persian: verseObj.ayah_persian,
				verse: {
					arabic_enhanced: verseObj.verse?.arabic_enhanced || "",
					english_arberry: verseObj.verse?.english_arberry || "",
					arabic_clean: verseObj.verse?.arabic_clean || "",
					farsi_makarem: verseObj.verse?.farsi_makarem || "",
				}
			};
		});

		// 4. Stringify the new data with pretty-printing
		console.log( "[*] Formatting new JSON for output..." );
		const outputJsonString = JSON.stringify( leanData, null, 2 );

		// 5. Write the new data to the output file
		console.log( `[*] Writing to output file: ${chalk.cyan( OUTPUT_QURAN_FILE )}` );
		await fsp.writeFile( OUTPUT_QURAN_FILE, outputJsonString );

		console.log( chalk.green( "\n✅ Success! Conversion complete." ) );
		console.log( chalk.green( `   - Total verses processed: ${leanData.length}` ) );
		console.log( chalk.green( `   - Output saved to: ${OUTPUT_QURAN_FILE}` ) );

	}
	catch ( error )
	{
		console.error( chalk.red( "\n[!!!] An error occurred during the conversion process." ) );
		console.error( chalk.red( `  > ${error.message}` ) );
	}
}

// Run the main function
main();