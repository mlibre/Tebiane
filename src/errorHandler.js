module.exports = function botErrors ( bot )
{
	bot.on( "error", ( error ) =>
	{
		console.error( "error", error );
	});

	bot.on( "webhook_error", ( error ) =>
	{
		console.error( "webhook_error", error );
	});

	bot.on( "polling_error", ( error ) =>
	{
		if ( error?.message )
		{
			console.error( "polling_error", error.message );
		}
		else
		{
			console.error( "polling_error", error );
		}
	});
}

process.on( "uncaughtException", function ( error )
{
	console.error( "uncaughtException: ", error );
});
process.on( "unhandledRejection", function ( error, p )
{
	if ( error?.response?.body )
	{
		console.error( "unhandledRejection: ", error.response.body );
	}
	else if ( error?.message )
	{
		console.error( "unhandledRejection: ", error?.message );
	}
	else
	{
		console.error( "unhandledRejection: ", error );
	}
});
