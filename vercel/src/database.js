
const { createClient } = require( "redis" );
const { redisUrl } = require( "./config" )

class RedisDatabase
{
	constructor ( )
	{
		this.redis = createClient({ url: redisUrl });
		this.redis.on( "error", err => { return console.error( "Redis Client Error", err ) });
		this.connected = false;
	}

	async connect ()
	{
		if ( this.connected ) return;
		try
		{
			if ( this.redis.isReady )
			{
				this.connected = true;
				return;
			}
			await this.redis.connect();
			this.connected = true;
		}
		catch ( e )
		{
			console.error( "Error connecting to Redis:", e );
			this.connected = false;
		}
	}

	async getJson ( key )
	{
		try
		{
			const data = await this.redis.get( key );
			return data ? JSON.parse( data ) : null;
		}
		catch ( e )
		{
			console.error( `Error getting JSON from Redis (${key}):`, e );
			return null;
		}
	}

	async getText ( key )
	{
		try
		{
			return await this.redis.get( key );
		}
		catch ( e )
		{
			console.error( `Error getting text from Redis (${key}):`, e );
			return null;
		}
	}

	async putJson ( key, value, ttl = null )
	{
		try
		{
			const jsonValue = JSON.stringify( value );
			if ( ttl )
			{
				await this.redis.set( key, jsonValue, { EX: ttl });
			}
			else
			{
				await this.redis.set( key, jsonValue );
			}
		}
		catch ( e )
		{
			console.error( `Error putting JSON to Redis (${key}):`, e );
		}
	}

	async putText ( key, value, ttl = null )
	{
		try
		{
			if ( ttl )
			{
				await this.redis.set( key, value, { EX: ttl });
			}
			else
			{
				await this.redis.set( key, value );
			}
		}
		catch ( e )
		{
			console.error( `Error putting text to Redis (${key}):`, e );
		}
	}

	async delete ( key )
	{
		try
		{
			await this.redis.del( key );
		}
		catch ( e )
		{
			console.error( `Error deleting from Redis (${key}):`, e );
		}
	}

	async disconnect ()
	{
		try
		{
			await this.redis.disconnect();
			this.connected = false;
		}
		catch ( e )
		{
			console.error( "Error disconnecting from Redis:", e );
		}
	}
}

module.exports = new RedisDatabase;
