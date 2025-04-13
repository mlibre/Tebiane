import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { CACHE_TTL_SECONDS } from "./config.js";


// Helper functions for KV cache operations
async function getHtmlCache ( url )
{
	return await globalThis.kvNamespace.getText( `cache_${url}` );
}

async function putHtmlCache ( url, html )
{
	return await globalThis.kvNamespace.putText( `cache_${url}`, html, CACHE_TTL_SECONDS );
}

/**
 * Fetches HTML content from a URL with caching
 * @param {string} url - The URL to fetch
 * @returns {Promise<string>} - The HTML content
 */
export async function fetchHtmlWithCache ( url )
{
	const cachedHtml = await getHtmlCache( url );
	if ( cachedHtml )
	{
		// console.log(`Cache hit for: ${url}`);
		return cleanHtmlContent( cachedHtml );
	}

	// console.log(`Cache miss, fetching: ${url}`);
	try
	{
		const response = await fetch( url, {
			headers: { // Add a user-agent to look less like a bot
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
			}
		});

		if ( !response.ok )
		{
			throw new Error( `HTTP error! status: ${response.status} for ${url}` );
		}

		const htmlContent = await response.text();

		// Store in cache
		await putHtmlCache( url, htmlContent );

		return cleanHtmlContent( htmlContent );
	}
	catch ( error )
	{
		console.error( `Error fetching HTML from ${url}:`, error );
		throw error; // Re-throw to be handled by caller
	}
}

/**
 * Gets readable content from a URL using Readability
 * @param {string} url - The URL to process
 * @returns {Promise<string>} - The processed HTML content
 */
export async function getReadabilityOutput ( url )
{
	// Check if we have a cached version first
	const cacheKey = `readability_${url}`;
	const cachedContent = await globalThis.kvNamespace.getText( cacheKey );

	if ( cachedContent )
	{
		return cleanHtmlContent( cachedContent );
	}

	try
	{
		// First fetch the HTML
		const htmlContent = await fetchHtmlWithCache( url );

		// Create a DOM from the HTML
		// TODO ✘ [ERROR]   Error: [unenv] whatwg-url.parseURL is not implemented yet!
		const dom = new JSDOM( htmlContent, { url });
		const reader = new Readability( dom.window.document );
		const article = reader.parse();

		if ( !article || !article.content )
		{
			throw new Error( `Failed to parse content from ${url}` );
		}

		// Store the parsed content in cache
		await globalThis.kvNamespace.putText( cacheKey, article.content, CACHE_TTL_SECONDS );

		return cleanHtmlContent( article.content );
	}
	catch ( error )
	{
		console.error( `Error getting Readability output from ${url}:`, error );
		throw error;
	}
}

/**
 * Cleans HTML content by removing excess whitespace
 * @param {string} htmlString - The HTML string to clean
 * @returns {string} - The cleaned HTML string
 */
function cleanHtmlContent ( htmlString )
{
	return htmlString.replace( /\s+/g, " " ).trim();
}
