# تبیان قران - Cloudflare Workers

## Deploy On Cloudflare Workers

```bash
npm install -g wrangler@latest
wrangler telemetry disable

# take bot token from @BotFather for ENV_BOT_TOKEN
# send /token to @BotFather

# take bot secret from https://core.telegram.org/bots/api#setwebhook for ENV_BOT_SECRET
# curl -X POST "https://api.telegram.org/botENV_BOT_TOKEN/setWebhook" \
#   -H "Content-Type: application/json" \
#   -d '{
#         "url": "https://cfw-tebiane.mlibrego.workers.dev/endpoint",
#         "secret_token": "MySecret123"
#       }'

# Storage & Databases -> KV
# create KV Namespace: CFW_TEBIANE
# create a "quran" key in the namespace with the value of the quran.json content
# Copy the ID of KV Namespace
# OR
# wrangler kv namespace create "CFW_TEBIANE"
# wrangler kv key put --binding=CFW_TEBIANE "quran" --path=../quran.json --remote
# wrangler kv key put --binding=CFW_TEBIANE "sources" --path=../sources/sources.txt --remote


nano wrangler.jsonc

"kv_namespaces": [
  {
    "binding": "CFW_TEBIANE",
    "id": "4195093e69a74a46bb405e5f79e2ed95"
  }
],
"vars": {
  "ENV_BOT_TOKEN": "ENV_BOT_TOKEN",
  "ENV_BOT_SECRET": "MySecret123"
},

wrangler deploy
wrangler tail

# Open https://cfw-tebiane.mlibrego.workers.dev/registerWebhook
```
