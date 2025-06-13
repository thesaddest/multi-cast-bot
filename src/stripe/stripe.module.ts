import { Module } from "@nestjs/common";
import { StripeService } from "./stripe.service";
import { SubscriptionService } from "./subscription.service";
import { StripeController } from "./stripe.controller";
import { DbModule } from "../db/db.module";
import { ConfigModule } from "../config/config.module";
import { TelegramModule } from "../telegram/telegram.module";
import { UserManagementService } from "../telegram/services/user-management.service";

@Module({
  imports: [DbModule, ConfigModule, TelegramModule],
  providers: [StripeService, SubscriptionService, UserManagementService],
  controllers: [StripeController],
  exports: [StripeService, SubscriptionService],
})
export class StripeModule {}
