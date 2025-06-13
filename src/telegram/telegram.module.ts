import { Logger, Module } from "@nestjs/common";
import { TelegramService } from "./telegram.service";
import { ConfigService } from "../config/config.service";
import { DbService } from "../db/db.service";

// Services
import { UserManagementService } from "./services/user-management.service";
import { ChannelManagementService } from "./services/channel-management.service";
import { TelegramApiService } from "./services/telegram-api.service";
import { MessageService } from "./services/message.service";
import { SubscriptionService } from "../stripe/subscription.service";
import { StripeService } from "../stripe/stripe.service";

// Handlers
import { CommandHandler } from "./handlers/command.handler";
import { ChannelHandler } from "./handlers/channel.handler";
import { CallbackHandler } from "./handlers/callback.handler";
import { BroadcastHandler } from "./handlers/broadcast.handler";

@Module({
  imports: [],
  providers: [
    TelegramService,
    ConfigService,
    DbService,
    Logger,
    // Services
    UserManagementService,
    ChannelManagementService,
    TelegramApiService,
    MessageService,
    SubscriptionService,
    StripeService,
    // Handlers
    CommandHandler,
    ChannelHandler,
    CallbackHandler,
    BroadcastHandler,
  ],
  exports: [TelegramService],
})
export class TelegramModule {}
