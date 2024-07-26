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
exports.messageLength = 2000; // Telegram message character limit

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
	mainPage: "x"
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