const Fuse = require( "fuse.js" );

import KVNamespace from "./kvNamespace.js";
import TelegramClient from "./telegram-api.js";
import {
	fuseKeys,
	markdownCodes,
	actionCodes,
	perian_translations,
	arabic_texts,
	all_translations,
	MESSAGE_LENGTH_LIMIT,
	CACHE_TTL_SECONDS,
	KV_QURAN_KEY,
	WEBHOOK,
	SECRET
} from "./config.js";

export default {
	async fetch ( request, env, ctx )
	{
		const kvNamespace = new KVNamespace( env.CFW_TEBIANE ); // Instantiate KVNamespace
		const token = env.ENV_BOT_TOKEN;

		if ( !token )
		{
			return new Response( "Bot token not configured", { status: 500 });
		}
		globalThis.token = token;

		if ( !kvNamespace )
		{
			return new Response( "KV Namespace not configured", { status: 500 });
		}
		globalThis.kvNamespace = kvNamespace;

		// Load Quran data once per worker instance (or fetch if not loaded)
		if ( !globalThis.quranData )
		{
			globalThis.quranData = await kvNamespace.getJson( KV_QURAN_KEY );
			if ( !globalThis.quranData )
			{
				console.error( "Failed to load Quran data from KV!" );
				return new Response( "Failed to load Quran data", { status: 500 });
			}
			console.log( `Quran data loaded successfully (${globalThis.quranData.length} verses)` );
		}
		if ( !globalThis.sources )
		{
			globalThis.sources = await kvNamespace.getText( "sources" );
			if ( !globalThis.sources )
			{
				console.error( "Failed to load sources data from KV!" );
				return new Response( "Failed to load sources data", { status: 500 });
			}
		}
		const { quranData, sources } = globalThis;

		const fuseIndex = Fuse.createIndex( fuseKeys, quranData )
		const fuse = new Fuse( quranData, {
			isCaseSensitive: false,
			includeScore: false,
			includeMatches: false,
			useExtendedSearch: false,
			ignoreLocation: true,
			threshold: 0.8,
			keys: fuseKeys
		}, fuseIndex );

		const telegramClient = new TelegramClient({ token, secretToken: SECRET, fuse, sources });

		const url = new URL( request.url );
		if ( url.pathname === WEBHOOK )
		{
			return handleWebhook( request, ctx, telegramClient );
		}
		else if ( url.pathname === "/registerWebhook" )
		{
			const success = await telegramClient.registerWebhook( url, WEBHOOK );
			return new Response( success );
		}
		else if ( url.pathname === "/unRegisterWebhook" )
		{
			const success = await telegramClient.unRegisterWebhook();
			return new Response( success );
		}
		else
		{
			return new Response( "No handler for this request" );
		}
	},
};

async function handleWebhook ( request, ctx, telegramClient )
{
	const secretHeader = request.headers.get( "X-Telegram-Bot-Api-Secret-Token" );
	if ( !telegramClient.validateWebhookRequest( secretHeader ) )
	{
		return new Response( "Unauthorized", { status: 403 });
	}

	const update = await request.json();
	ctx.waitUntil( telegramClient.handleUpdate( update ) );
	return new Response( true );
}