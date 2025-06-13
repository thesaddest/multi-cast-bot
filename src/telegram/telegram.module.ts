import { Logger, Module } from "@nestjs/common";
import { TelegramService } from "./telegram.service";
import { ConfigService } from "../config/config.service";
import { DbService } from "../db/db.service";

@Module({
  providers: [TelegramService, ConfigService, DbService, Logger],
  exports: [TelegramService],
})
export class TelegramModule {}
