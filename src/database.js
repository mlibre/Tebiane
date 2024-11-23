const { Level } = require( "level" );

class LevelDatabase
{
	constructor ( )
	{
		this.db = new Level( "users_history", { valueEncoding: "json" });
		this.tafsirNemooneh = this.db.sublevel( "tafsirNemooneh", { valueEncoding: "json" });
		this.khamenei = this.db.sublevel( "khamenei", { valueEncoding: "json" });
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

	async put ( key, value )
	{
		await this.db.put( key, value );
	}

	async putTafsir ( key, value )
	{
		await this.tafsirNemooneh.put( key, value );
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

	async delete ( key )
	{
		await this.db.del( key );
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

}

module.exports = new LevelDatabase();