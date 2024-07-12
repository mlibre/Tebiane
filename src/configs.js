const actionCodes = {
	nextVerse: "i",
	prevVerse: "j",
	tafsirNemooneh: "k",
	arabicText: "g",
	arabicIrabText: "h",
	nextResult: "a",
	prevResult: "b"
};

const perian_translations = {
	"c": {
		farsi: "انصاریان",
		key: "farsi_ansarian"
	},
	"d": {
		farsi: "فولادوند",
		key: "farsi_fooladvand"
	},
	"e": {
		farsi: "مجتبوی",
		key: "farsi_mojtabavi"
	},
	"f": {
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