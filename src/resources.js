const fs = require( "fs" );
const path = require( "path" );
const { sendMessageWithRetry } = require( "./utils" );
const resources = fs.readFileSync( path.join( __dirname, "../sources/sources.txt" ) );

module.exports = async function all ( bot, msg, match )
{
	const chatId = msg.chat.id;
	const userInput = match[1];
	const resourcesMessage = `\`\`\`text\n${ resources }\`\`\``;
	await sendMessageWithRetry( bot, chatId, resourcesMessage, { parse_mode: "MarkdownV2" });
}