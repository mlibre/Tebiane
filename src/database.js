const { Level } = require( "level" );
const { storagePath, CACHE_EXPIRATION } = require( "./configs" );
class LevelDatabase
{
	constructor ( )
	{
		this.db = new Level( storagePath, { valueEncoding: "json" });
		this.tafsirNemooneh = this.db.sublevel( "tafsirNemooneh", { valueEncoding: "json" });
		this.khamenei = this.db.sublevel( "khamenei", { valueEncoding: "json" });
		this.htmlCache = this.db.sublevel( "htmlCache", { valueEncoding: "json" });
	}

	async put ( key, value )
	{
		await this.db.put( key, value );
	}

	async get ( key )
	{
		try
		{
			const result = await this.db.get( key );
			return result;
		}
		catch ( error )
		{
			return false;
		}
	}

	async delete ( key )
	{
		await this.db.del( key );
	}

	async batch ( batch )
	{
		if ( batch.length === 0 )
		{
			return;
		}
		await this.db.batch( batch );
	}

	async clear ()
	{
		await this.db.clear();
		return;
	}

	async close ()
	{
		await this.db.close();
	}

	async getAll ( )
	{
		const result = [];
		for await ( const value of this.db.iterator() )
		{
			result.push( value );
		}
		return result;
	}

	async putTafsir ( key, value )
	{
		await this.tafsirNemooneh.put( key, value );
	}

	async getTafsir ( key )
	{
		try
		{
			const result = await this.tafsirNemooneh.get( key );
			return result;
		}
		catch ( error )
		{
			return false;
		}
	}

	async deleteTafsir ( key )
	{
		await this.tafsirNemooneh.del( key );
	}

	async putKhamenei ( key, value )
	{
		await this.khamenei.put( key, value );
	}

	async getKhamenei ( key )
	{
		try
		{
			const result = await this.khamenei.get( key );
			return result;
		}
		catch ( error )
		{
			return false;
		}
	}

	async deleteKhamenei ( key )
	{
		await this.khamenei.del( key );
	}

	// HTML Cache Methods
	async putHtmlCache ( key, value )
	{
		await this.htmlCache.put( key, {
			content: value,
			timestamp: Date.now()
		});
	}

	async getHtmlCache ( key )
	{
		try
		{
			const cachedData = await this.htmlCache.get( key );

			if ( Date.now() - cachedData.timestamp < CACHE_EXPIRATION )
			{
				return cachedData.content;
			}

			await this.htmlCache.del( key );
			return false;
		}
		catch ( error )
		{
			return false;
		}
	}

	async deleteHtmlCache ( key )
	{
		await this.htmlCache.del( key );
	}
}
module.exports = new LevelDatabase();