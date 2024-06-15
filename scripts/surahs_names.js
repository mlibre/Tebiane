// source: https://en.wikipedia.org/wiki/List_of_chapters_in_the_Quran

const fs = require( "fs" );
const cheerio = require( "cheerio" );

const htmlString = fs.readFileSync( "./surahs_names.html", "utf8" );

const $ = cheerio.load( htmlString );
const data = [];

$( "tbody > tr" ).each( ( index, element ) =>
{
	const cells = $( element ).find( "td" );
	const rowData = {
		num: $( cells[0] ).text().trim(),
		anglicizedTitle: $( cells[1] ).text().trim(),
		arabicTitle: $( cells[2] ).find( "span:first-child" ).find( "span:first-child" ).text().trim()
	};
	data.push( rowData );
});

const jsonData = JSON.stringify( data, null, 2 );

// Write JSON data to a file
fs.writeFile( "surahs_names.json", jsonData, ( err ) =>
{
	if ( err ) throw err;
	console.log( "Data written to file" );
});
