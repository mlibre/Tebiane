# Tebiane Render

## Deployment on Render.com

1. **Create the Render project**: Go to [render.com](https://render.com) and create a new "Web Service".
2. **Connect your repository**: Link your GitHub account and select the repository for this project.
3. **Configure the service**:
    * **Name**: `Tebiane`
    * **Root Directory**: `render`
    * **Build Command**: `npm install`
    * **Start Command**: `npm start`
4. **Add Environment Variables**:
    * `TELEGRAM_BOT_TOKEN`: Your Telegram bot token. (from `https://t.me/BotFather`)
    * `REDIS_URL`: The connection string for your Redis instance. (from `https://cloud.redis.io` )
    * `RENDER_URL`: The public URL of your Render service (e.g., `https://tebiane.onrender.com/`).
5. **Deploy**: Click "Create Web Service" to deploy the bot.
6. **Register Webhook**: Once the deployment is complete, open your browser and navigate to <https://tebiane.onrender.com/register_webhook> to set up the Telegram webhook.  

 ```bash
 curl "https://tebiane.onrender.com/register_webhook"
 ```
