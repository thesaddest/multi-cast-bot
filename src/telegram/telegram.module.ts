import { Logger, Module } from "@nestjs/common";
import { TelegramService } from "./telegram.service";
import { ConfigService } from "../config/config.service";
import { DbService } from "../db/db.service";

// Services
import { UserManagementService } from "./services/user-management.service";
import { ChannelManagementService } from "./services/channel-management.service";
import { TelegramApiService } from "./services/telegram-api.service";

// Handlers
import { CommandHandler } from "./handlers/command.handler";
import { ChannelHandler } from "./handlers/channel.handler";
import { CallbackHandler } from "./handlers/callback.handler";

@Module({
  providers: [
    TelegramService,
    ConfigService,
    DbService,
    Logger,
    // Services
    UserManagementService,
    ChannelManagementService,
    TelegramApiService,
    // Handlers
    CommandHandler,
    ChannelHandler,
    CallbackHandler,
  ],
  exports: [TelegramService],
})
export class TelegramModule {}
