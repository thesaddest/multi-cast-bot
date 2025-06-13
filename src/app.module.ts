import { Module, Logger } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { DbModule } from "./db/db.module";
import { TelegramModule } from "./telegram/telegram.module";

@Module({
  imports: [
    ConfigModule,
    DbModule,
    TelegramModule,
  ],
  controllers: [],
  providers: [Logger],
})
export class AppModule {}
