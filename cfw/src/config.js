// Search configuration
export const fuseKeys = [
	{ name: "surah.number", weight: 1 }, // 1
	{ name: "surah.persian_number", weight: 1 }, // ۱
	{ name: "surah.arabic", weight: 1.2 }, // ٱلْفَاتِحَة
	{ name: "surah.farsi", weight: 1.2 }, // فاتحه
	{ name: "ayah", weight: 1.2 }, // 1
	{ name: "ayah_persian", weight: 1.2 }, // ۱
	{ name: "verse.farsi_makarem", weight: 1 },
	{ name: "verse.farsi_ansarian", weight: 1 },
	{ name: "verse.farsi_fooladvand", weight: 1 },
	{ name: "verse.farsi_mojtabavi", weight: 1 },
	{ name: "verse.arabic_clean", weight: 1 }, // بسم الله الرحمن الرحيم
	{ name: "verse.arabic_enhanced", weight: 1 }, // بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
	{ name: "id", weight: 0.05 }, // 1
	{ name: "id_persian", weight: 0.05 }, // ۱
];

// Markdown formatting codes
export const markdownCodes = {
	bold: "booold@",
	italic: "italic@",
	underline: "underline@",
	strikethrough: "strikethrough@",
	code: "code@",
	spoiler: "spoiler@"
};

// Action codes for callback queries
export const actionCodes = {
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

// Persian translation options
export const perian_translations = {
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
		farsi: "مکارم",
		key: "farsi_makarem"
	}
};

// Arabic text options
export const arabic_texts = {
	[actionCodes.arabicText]: {
		farsi: "عربی ساده",
		key: "arabic_clean"
	},
	[actionCodes.arabicIrabText]: {
		farsi: "عربی با اعراب",
		key: "arabic_enhanced"
	}
};

// Combined translations
export const all_translations = { ...perian_translations, ...arabic_texts };

// App constants
export const MESSAGE_LENGTH_LIMIT = 2100;
export const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days for HTML cache
export const KV_QURAN_KEY = "quran"; // Key for Quran data in KV
export const WEBHOOK = "/endpoint";
export const SECRET = "MySecret123";
