import { Module, Logger } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { DbModule } from "./db/db.module";
import { TelegramModule } from "./telegram/telegram.module";
import { StripeModule } from "./stripe/stripe.module";

@Module({
  imports: [ConfigModule, DbModule, TelegramModule, StripeModule],
  controllers: [],
  providers: [Logger],
})
export class AppModule {}
