export default class KVNamespace
{
	constructor ( kvNamespace )
	{
		this.kvNamespace = kvNamespace;
	}

	async getJson ( key )
	{
		try
		{
			return await this.kvNamespace.get( key, "json" );
		}
		catch ( e )
		{
			console.error( `Error getting JSON from KV (${key}):`, e );
			return null;
		}
	}

	async getText ( key )
	{
		try
		{
			return await this.kvNamespace.get( key, "text" );
		}
		catch ( e )
		{
			console.error( `Error getting text from KV (${key}):`, e );
			return null;
		}
	}

	async putJson ( key, value, ttl = null )
	{
		try
		{
			const options = ttl ? { expirationTtl: ttl } : {};
			await this.kvNamespace.put( key, JSON.stringify( value ), options );
		}
		catch ( e )
		{
			console.error( `Error putting JSON to KV (${key}):`, e );
		}
	}

	async putText ( key, value, ttl = null )
	{
		try
		{
			const options = ttl ? { expirationTtl: ttl } : {};
			await this.kvNamespace.put( key, value, options );
		}
		catch ( e )
		{
			console.error( `Error putting text to KV (${key}):`, e );
		}
	}

	async delete ( key )
	{
		try
		{
			await this.kvNamespace.delete( key );
		}
		catch ( e )
		{
			console.error( `Error deleting from KV (${key}):`, e );
		}
	}
}
