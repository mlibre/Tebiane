const fs = require( "fs" );
const fsp = require( "fs/promises" );
const path = require( "path" );
const puppeteer = require( "puppeteer" );
const chalk = require( "chalk" );

// --- Configuration ---
const LOCAL_QURAN_FILE = path.join( __dirname, "../sources/quran.json" );
const OUTPUT_QURAN_FILE = path.join( __dirname, "makarem_quran.json" );
const BASE_URL = "https://quran.makarem.ir/fa";
const VERSE_LIMIT = 0; // Set to 0 to run all verses

/**
 * Scrapes a single verse from the website using Puppeteer.
 * (This function is unchanged)
 */
async function scrapeVerse ( page, surah, ayah )
{
	const url = `${BASE_URL}#${surah}:${ayah}`;
	const retries = 5;

	for ( let i = 0; i < retries; i++ )
	{
		try
		{
			await page.goto( url, { waitUntil: "load", timeout: 70000 });
			const verseSelector = `div.verse[data-surah="${surah}"][data-verse="${ayah}"]`;
			await page.waitForSelector( verseSelector, { timeout: 60000 });

			const scrapedData = await page.evaluate( ( selector ) =>
			{
				const verseElement = document.querySelector( selector );
				if ( !verseElement ) return null;
				const arabicEl = verseElement.querySelector( "p.verse-text" );
				const farsiEl = verseElement.querySelector( "p.translate-text[data-lang=\"fa\"]" );
				if ( !arabicEl || !farsiEl ) return null;
				const arabicNodeClone = arabicEl.cloneNode( true );
				const verseNumberSpan = arabicNodeClone.querySelector( "span.verse-number" );
				if ( verseNumberSpan ) verseNumberSpan.remove();
				return {
					arabic_enhanced: arabicNodeClone.textContent.trim(),
					farsi_makarem: farsiEl.textContent.trim(),
				};
			}, verseSelector );

			if ( scrapedData )
			{
				return scrapedData;
			}
		}
		catch ( error )
		{
			console.log( chalk.yellow( `\n[Attempt ${i + 1}/${retries}] Error scraping ${surah}:${ayah}. Retrying...` ) );
			console.log( chalk.gray( `  > ${error.message}` ) );
			if ( i < retries - 1 )
			{
				await new Promise( res => { return setTimeout( res, 2000 ) });
			}
		}
	}

	console.log( chalk.red( `\n[!] Failed to scrape ${surah}:${ayah} after ${retries} attempts.` ) );
	return null;
}

/**
 * --- NEW, ROBUST WRITING FUNCTION ---
 * Appends a verse object to a JSON file, ensuring the file is always a valid JSON array.
 * @param {string} filePath The path to the JSON file.
 * @param {object} verseObject The verse object to append.
 */
async function appendVerseToJsonArray ( filePath, verseObject )
{
	const verseJsonString = JSON.stringify( verseObject, null, 2 );

	try
	{
		// Check if the file exists and is not empty
		const stats = await fsp.stat( filePath );
		if ( stats.size > 2 ) // More than just '[]'
		{
			// File exists, insert before the closing bracket
			const fileHandle = await fsp.open( filePath, "r+" );
			const position = stats.size - 1; // Position of the closing ']'
			const contentToAppend = `,\n${verseJsonString}\n]`;
			await fileHandle.write( contentToAppend, position );
			await fileHandle.close();
		}
		else
		{
			// File is empty or just '[]', so we create the initial array
			await fsp.writeFile( filePath, `[\n${verseJsonString}\n]` );
		}
	}
	catch ( error )
	{
		// If file doesn't exist, create it with the first element
		if ( error.code === "ENOENT" )
		{
			await fsp.writeFile( filePath, `[\n${verseJsonString}\n]` );
		}
		else
		{
			// Re-throw other errors
			throw error;
		}
	}
}


// --- Main Execution ---
async function main ()
{
	console.log( chalk.blue( "[*] Starting Quran validation and incremental creation..." ) );

	// --- Load Source File ---
	let localData;
	try
	{
		console.log( `[*] Loading source file: ${LOCAL_QURAN_FILE}` );
		const fileContent = await fsp.readFile( LOCAL_QURAN_FILE, "utf-8" );
		localData = JSON.parse( fileContent );
	}
	catch ( error )
	{
		console.error( chalk.red( `[!] Failed to load local quran.json: ${error.message}` ) );
		return;
	}

	// --- Logic to resume from last point ---
	let startIndex = 0;
	try
	{
		console.log( `[*] Checking for existing output file to resume: ${OUTPUT_QURAN_FILE}` );
		const content = await fsp.readFile( OUTPUT_QURAN_FILE, "utf-8" );
		const existingData = JSON.parse( content );

		if ( existingData.length > 0 )
		{
			const lastScrapedVerse = existingData[existingData.length - 1];
			const lastId = lastScrapedVerse.id;
			startIndex = localData.findIndex( v => { return v.id === lastId }) + 1;

			if ( startIndex > 0 && startIndex < localData.length )
			{
				console.log( chalk.green( `[+] Found ${existingData.length} existing verses. Resuming from verse #${startIndex + 1} (ID: ${localData[startIndex].id}).` ) );
			}
			else
			{
				console.log( chalk.green( "[+] Output file is already complete. Nothing to do." ) );
				return;
			}
		}
	}
	catch ( error )
	{
		if ( error.code === "ENOENT" )
		{
			console.log( chalk.yellow( "[!] Output file not found. Starting from scratch." ) );
		}
		else
		{
			console.error( chalk.red( `[!] Error reading existing output file: ${error.message}` ) );
			console.error( chalk.red( "[!] Please fix or delete the corrupted file and try again." ) );
			return;
		}
	}

	// --- Setup Browser ---
	console.log( "[*] Launching headless browser..." );
	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	await page.setRequestInterception( true );
	page.on( "request", ( req ) =>
	{
		if ( ["image", "stylesheet", "font"].includes( req.resourceType() ) )
		{
			req.abort();
		}
		else
		{
			req.continue();
		}
	});

	const validationErrors = [];
	const versesToProcess = VERSE_LIMIT > 0 ? localData.slice( 0, VERSE_LIMIT ) : localData;
	const totalVerses = versesToProcess.length;

	try
	{
		console.log( `[*] Starting scraping from verse ${startIndex + 1} of ${totalVerses}...` );
		for ( let i = startIndex; i < totalVerses; i++ )
		{
			const verseObj = versesToProcess[i];
			const surahNum = verseObj?.surah?.number;
			const ayahNum = verseObj?.ayah;

			process.stdout.write( chalk.gray( `[${i + 1}/${totalVerses}] Checking ${surahNum}:${ayahNum}... ` ) );

			if ( surahNum === undefined || ayahNum === undefined )
			{
				validationErrors.push({ type: "MissingData", id: verseObj.id, message: "Verse object is missing surah/ayah number." });
				process.stdout.write( chalk.red( "Missing local data\n" ) );
				continue;
			}

			const scrapedData = await scrapeVerse( page, surahNum, ayahNum );

			if ( !scrapedData )
			{
				validationErrors.push({ type: "ScrapeError", location: `${surahNum}:${ayahNum}`, message: "Could not retrieve data from the website after multiple retries." });
				process.stdout.write( chalk.red( "FATAL SCRAPE FAILED\n" ) );
				console.error( chalk.bold.red( `\n[!!!] Aborting process due to persistent failure at ${surahNum}:${ayahNum}.` ) );
				return; // Exit the main function
			}

			const newVerseObject = {
				id: verseObj.id,
				id_persian: verseObj.id_persian,
				surah: verseObj.surah,
				ayah: verseObj.ayah,
				ayah_persian: verseObj.ayah_persian,
				verse: {
					arabic_enhanced: scrapedData.arabic_enhanced,
					arabic_clean: verseObj.verse?.arabic_clean || "",
					english_arberry: verseObj.verse?.english_arberry || "",
					farsi_makarem: scrapedData.farsi_makarem,
				}
			};

			// --- USE THE NEW ROBUST WRITING FUNCTION ---
			await appendVerseToJsonArray( OUTPUT_QURAN_FILE, newVerseObject );

			// --- Perform Validation ---
			// (This logic is unchanged)
			const localVerse = verseObj.verse || {};
			let hasError = false;
			if ( ( localVerse.arabic_enhanced || "" ).trim() !== scrapedData.arabic_enhanced.trim() )
			{
				validationErrors.push({ type: "Mismatch", field: "arabic_enhanced", location: `${surahNum}:${ayahNum}`, expected: scrapedData.arabic_enhanced, found: localVerse.arabic_enhanced || "" });
				hasError = true;
			}
			if ( ( localVerse.farsi_makarem || "" ).trim() !== scrapedData.farsi_makarem.trim() )
			{
				validationErrors.push({ type: "Mismatch", field: "farsi_makarem", location: `${surahNum}:${ayahNum}`, expected: scrapedData.farsi_makarem, found: localVerse.farsi_makarem || "" });
				hasError = true;
			}
			process.stdout.write( hasError ? chalk.red( "Mismatch found\n" ) : chalk.green( "OK\n" ) );
		}

		console.log( chalk.green( "\n[*] Successfully completed scraping all verses." ) );

	}
	finally
	{
		// This block ALWAYS runs to ensure cleanup
		console.log( "\n[*] Closing browser..." );
		await browser.close();
	}

	// --- Print Validation Report ---
	// (This logic is unchanged)
	console.log( chalk.bold( "\n--- Validation Report ---" ) );
	console.log( `Total verses checked in this run: ${totalVerses - startIndex}` );
	if ( validationErrors.length === 0 )
	{
		console.log( chalk.green( "\n✅ Success! No validation errors in this run." ) );
	}
	else
	{
		console.log( chalk.red( `\n❌ Found ${validationErrors.length} validation errors.` ) );
		validationErrors.forEach( ( error, i ) =>
		{
			console.log( chalk.bold.yellow( `\n--- Error #${i + 1} ---` ) );
			console.log( `  Type: ${error.type}` );
			console.log( `  Location (Surah:Ayah): ${error.location || "N/A"}` );
			if ( error.type === "Mismatch" )
			{
				console.log( `  Field: ${chalk.cyan( error.field )}` );
				console.log( `  ${chalk.green( "Expected" )}: '${error.expected}'` );
				console.log( `  ${chalk.red( "Found" )}:    '${error.found}'` );
			}
			else
			{
				console.log( `  Message: ${error.message}` );
			}
		});
		console.log( chalk.bold( "\n--- End of Report ---" ) );
	}
}

main();