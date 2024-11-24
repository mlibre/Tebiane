require( "dotenv" ).config()

const proxy = process.env.PROXY;
const botOptions = {
	polling: true
};
if ( proxy )
{
	botOptions.request = {
		proxy
	};
}
exports.botOptions = botOptions;
exports.token = process.env.TELEGRAM_BOT_TOKEN;
exports.messageLength = 2100; // Telegram message character limit
exports.storagePath = process.env.STORAGE_PATH;
exports.markdownCodes = {
	bold: "booold@",
	italic: "italic@",
	underline: "underline@",
	strikethrough: "strikethrough@",
	code: "code@",
	spoiler: "spoiler@"
};

const actionCodes = {
	nextResult: "a",
	prevResult: "b",
	ansarian: "c",
	fooladvand: "d",
	mojtabavi: "e",
	makarem: "f",
	arabicText: "g",
	arabicIrabText: "h",
	nextVerse: "i",
	prevVerse: "j",
	tafsirNemooneh: ["k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w"],
	mainPage: "x",
	hasRead: "y",
	hasNotRead: "z",
	toggleRead: "A",
	others: "B",
	saanNuzul: "C",
	khamenei: ["D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q"],
};

const perian_translations = {
	[actionCodes.ansarian]: {
		farsi: "انصاریان",
		key: "farsi_ansarian"
	},
	[actionCodes.fooladvand]: {
		farsi: "فولادوند",
		key: "farsi_fooladvand"
	},
	[actionCodes.mojtabavi]: {
		farsi: "مجتبوی",
		key: "farsi_mojtabavi"
	},
	[actionCodes.makarem]: {
		farsi: "مکارم شیرازی",
		key: "farsi_makarem"
	}
};

const arabic_texts = {
	[actionCodes.arabicText]: {
		farsi: "عربی ساده",
		key: "arabic_clean"
	},
	[actionCodes.arabicIrabText]: {
		farsi: "عربی با اعراب",
		key: "arabic_enhanced"
	}
}
exports.perian_translations = perian_translations;
exports.all_translations = { ...perian_translations, ...arabic_texts };
exports.actionCodes = actionCodes;
exports.CACHE_EXPIRATION = 30 * 24 * 60 * 60 * 1000; // 30 days * 24 hours * 60 minutes * 60 seconds * 1000 milliseconds