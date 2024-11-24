
const { JSDOM } = require( "jsdom" );
const { Readability } = require( "@mozilla/readability" );
const axios = require( "axios" );
const database = require( "../database" );

async function fetchHtml ( url )
{
	// Check cache first
	const cachedHtml = await database.getHtmlCache( url );
	if ( cachedHtml )
	{
		return cachedHtml;
	}

	try
	{
		const response = await axios.get( url );
		const htmlContent = response.data;

		// Store in cache
		await database.putHtmlCache( url, htmlContent );

		return htmlContent;
	}
	catch ( error )
	{
		console.error( `Error fetching HTML from ${url}:`, error );
		throw error;
	}
}

async function getReadabilityOutput ( url )
{
	// Check cache first
	const cachedHtml = await database.getHtmlCache( url );
	if ( cachedHtml )
	{
		return cachedHtml;
	}

	try
	{
		const response = await axios.get( url );
		const htmlContent = response.data;

		// Store in cache
		await database.putHtmlCache( url, htmlContent );

		return htmlContent;
	}
	catch ( error )
	{
		console.error( `Error fetching Readability output from ${url}:`, error );
		throw error;
	}
}

function cleanHtmlContent ( htmlString )
{
	return htmlString.replace( /\s+/g, " " ).trim();
}

module.exports = {
	fetchHtml,
	getReadabilityOutput,
	cleanHtmlContent
};