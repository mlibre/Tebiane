# tetebiane-vercel

```bash

# Create the vercel project: vercel.com
# name: tebiane-vercel
# Create redis database: https://vercel.com/masoud-ghorbanzadehs-projects/tebiane-vercel/stores
# name: TEBIANE-KV

npm i -g vercel

nano .env
BOT_TOKEN=TOKEN
REDIS_URL=REDIS_URL

vercel env add BOT_TOKEN
vercel env add REDIS_URL

# vercel dev
vercel
vercel --prod

https://tetebiane-vercel.vercel.app/api
```
