const isNetworkError = ( error ) =>
{
	return error.message.includes( "socket hang up" ) ||
         error.message.includes( "network socket disconnected" )
}

const sleep = async ( ms ) =>
{
	await new Promise( resolve => { return setTimeout( resolve, ms ) })
}

const withRetry = async ( operation, options, retries = 10, delay = 50 ) =>
{
	for ( let i = 0; i < retries; i++ )
	{
		try
		{
			await operation( options )
			break
		}
		catch ( error )
		{
			if ( isNetworkError( error ) )
			{
				console.log( `Retrying... Attempts left: ${retries - i - 1}` )
				await sleep( delay )
			}
			else
			{
				throw error
			}
		}
	}
}

exports.sendMessageWithRetry = async ( bot, chatId, message, options ) =>
{
	await withRetry(
		( opts ) => { return bot.sendMessage( chatId, message, opts ) },
		options
	)
}

exports.editMessageWithRetry = async ( bot, message, options ) =>
{
	await withRetry(
		( opts ) => { return bot.editMessageText( message, opts ) },
		options
	)
}