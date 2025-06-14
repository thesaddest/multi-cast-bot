import * as process from "process";

import * as Joi from "joi";

export const Configuration = () => ({
  app: {
    name: process.env.APP_NAME,
    port: process.env.APP_PORT,
    node_env: process.env.NODE_ENV,
    log_level: process.env.LOG_LEVEL,
    base_url: process.env.BASE_URL,
  },
  db: {
    db_url: process.env.DATABASE_URL,
  },
  tg: {
    api_token: process.env.TELEGRAM_API_TOKEN,
    bot_username: process.env.BOT_USERNAME,
  },
  stripe: {
    secret_key: process.env.STRIPE_SECRET_KEY,
    premium_price_id: process.env.STRIPE_PREMIUM_PRICE_ID,
    webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
  },
});

export const ConfigurationValidationSchema = Joi.object({
  APP_NAME: Joi.string().required(),
  APP_PORT: Joi.number().required(),
  NODE_ENV: Joi.string().required(),
  LOG_LEVEL: Joi.string().required(),
  BASE_URL: Joi.string().required(),
  BOT_USERNAME: Joi.string().required(),

  DATABASE_URL: Joi.string().required(),

  TELEGRAM_API_TOKEN: Joi.string().required(),

  STRIPE_SECRET_KEY: Joi.string().required(),
  STRIPE_PREMIUM_PRICE_ID: Joi.string().required(),
  STRIPE_WEBHOOK_SECRET: Joi.string().required(),
});
