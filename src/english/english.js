bot.onText( /\/setlang.*/, ( msg, match ) =>
{
	const userInput = msg.text.replace( /^\/setlang\s*/, "" );
	const fromId = msg.from.id
	const chatId = msg.chat.id
	if ( userInput === "fa" || userInput === "en" )
	{
		return setUserLang( bot, fromId, userInput, chatId );
	}
	return bot.sendMessage( chatId, "Choose your language - زبان را انتخاب کنید", setLangButton() );
});

bot.on( "callback_query", ( callbackQuery ) =>
{
	const msg = callbackQuery.message.text;
	const { data } = callbackQuery;
	const fromId = callbackQuery.from.id
	const messageFromId = callbackQuery.message.from.id
	const messageChatId = callbackQuery.message.chat.id
	if ( msg.includes( "Choose your language - زبان را انتخاب کنید" ) )
	{
		return setUserLang( bot, fromId, data, messageChatId );
	}
});

const fuse = new Fuse( quran, {
	isCaseSensitive: false,
	includeScore: true,
	includeMatches: true,
	keys: [ "id", "surah.number", "surah.arabic", "surah.english", "ayah", "verse.english_arberry" ]
});

const { setLangButton, setUserLang } = require( "./utils" )

exports.setUserLang = function setUserLang ( bot, fromId, lang, chatId )
{
	users.addUser( fromId, { lang });
	if ( lang == "fa" )
	{
		bot.sendMessage( chatId, "زبان ربات فارسی تنظیم شد" );
	}
	else
	{
		bot.sendMessage( chatId, "Language set to English" );
	}
}

exports.setLangButton = function setLangButton ( bot, msg )
{
	return {
		// reply_to_message_id: msg.message_id,
		reply_markup: JSON.stringify({
			inline_keyboard: [
				[ { text: "English", callback_data: "en" } ],
				[ { text: "فارسی", callback_data: "fa" } ],
			]
		})
	};
}


// ## Ollama

// 	```bash
// export https_proxy=http://127.0.0.1:2080 http_proxy=http://127.0.0.1:2080 all_proxy=socks5://127.0.0.1:2080
// curl -fsSL https://ollama.com/install.sh | sh

// sudo curl -L https://ollama.com/download/ollama-linux-amd64 -o /usr/bin/ollama
// sudo chmod +x /usr/bin/ollama
// sudo cp /usr/bin/ollama /usr/local/bin/ollama

// <!-- ollama run phi3:mini -->
// ollama pull phi3:mini-128k
// ollama show --modelfile phi3:mini-128k

// ollama run phi3:mini-128k
// /set system "You are a helpful assistant. you always try to find the most reletive surah, ayah and verse based on user's message. and list them to her. Here is your resource: ..."
// ```