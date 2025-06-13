import { Module, Logger } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { DbModule } from "./db/db.module";
import { BullModule } from "@nestjs/bull";
import { ConfigService } from "./config/config.service";
import { TelegramModule } from "./telegram/telegram.module";

@Module({
  imports: [
    ConfigModule,
    DbModule,
    TelegramModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        url: configService.get<string>("redis.url"),
      }),
    }),
  ],
  controllers: [],
  providers: [Logger],
})
export class AppModule {}
