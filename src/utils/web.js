
const { JSDOM } = require( "jsdom" );
const { Readability } = require( "@mozilla/readability" );
const axios = require( "axios" );

exports.getReadabilityOutput = async function ( url )
{
	const dom = await JSDOM.fromURL( url );
	const reader = new Readability( dom.window.document );
	const article = reader.parse();
	return article.content;
}

exports.fetchHtml = async function ( url )
{
	const response = await axios.get( url, {
		responseType: "text/html",
		headers: {
			"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
		}
	});
	return response.data;
}

exports.cleanHtmlContent = function ( htmlString )
{
	return htmlString.replace( /\s+/g, " " ).trim();
}

exports.handleRequestError = function ( error )
{
	const errorMessage = error.response
		? `HTTP Error: ${error.response.status} - ${error.response.statusText}`
		: `Network Error: ${error.message}`;

	console.error( `Request failed: ${errorMessage}` );
	return errorMessage;
}
