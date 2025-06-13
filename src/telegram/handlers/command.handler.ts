import { Injectable, Logger } from "@nestjs/common";
import * as TelegramBot from "node-telegram-bot-api";
import { UserManagementService } from "../services/user-management.service";
import { TelegramApiService } from "../services/telegram-api.service";
import { MessageService } from "../services/message.service";
import { SubscriptionService } from "../../stripe/subscription.service";
import { TelegramHandlerContext } from "../types/telegram.types";

@Injectable()
export class CommandHandler {
  private readonly logger = new Logger(CommandHandler.name);

  constructor(
    private userManagementService: UserManagementService,
    private telegramApiService: TelegramApiService,
    private messageService: MessageService,
    private subscriptionService: SubscriptionService,
  ) {}

  async handleStart(
    bot: TelegramBot,
    context: TelegramHandlerContext,
  ): Promise<void> {
    const { chatId, telegramUser } = context;

    if (!telegramUser) {
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        "❌ Unable to get user information",
      );
      return;
    }

    try {
      // Check if user already exists
      let user = await this.userManagementService.findUserByTelegramId(
        telegramUser.id.toString(),
      );

      if (user) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          `🎉 Welcome back, ${telegramUser.first_name}!\n\nYou're already registered in our system.`,
        );
        await this.showMainMenu(bot, chatId);
        return;
      }

      // Create new user
      user =
        await this.userManagementService.createUserWithTelegramAccount(
          telegramUser,
        );

      const welcomeMessage = `🚀 Welcome to Multi-Platform Bot, ${telegramUser.first_name}!

✅ Your account has been created successfully!
🆔 User ID: ${user.id}
📱 Connected Platform: Telegram

What you can do:
• Connect other social platforms (Discord, Twitter, VK)
• Send messages across all platforms
• Schedule messages for later
• Manage your channels and groups`;

      await this.telegramApiService.sendMessage(bot, chatId, welcomeMessage);
      await this.showMainMenu(bot, chatId);
    } catch (error) {
      this.logger.error("Error creating user:", error);
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        "❌ Sorry, there was an error setting up your account. Please try again later.",
      );
    }
  }

  async showMainMenu(bot: TelegramBot, chatId: number): Promise<void> {
    const menuMessage = `🎛️ Main Menu

Choose what you'd like to do:`;

    const keyboard = this.telegramApiService.createReplyKeyboard(
      [
        [{ text: "👤 Profile" }, { text: "📋 My Channels" }],
        [{ text: "➕ Add Channel" }, { text: "📢 Send Message" }],
        [{ text: "📜 Message History" }, { text: "📊 Statistics" }],
      ],
      {
        resize_keyboard: true,
        one_time_keyboard: false,
        is_persistent: true,
      },
    );

    await this.telegramApiService.sendMessage(bot, chatId, menuMessage, {
      reply_markup: keyboard,
    });
  }

  async handleProfile(
    bot: TelegramBot,
    context: TelegramHandlerContext,
  ): Promise<void> {
    const { chatId, telegramUser } = context;

    try {
      const user = await this.userManagementService.findUserWithStats(
        telegramUser.id.toString(),
      );

      if (!user) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          "❌ User not found. Please use /start to create an account.",
        );
        return;
      }

      const platformList = user.accounts
        .map(
          (account) =>
            `• ${account.platform}: @${account.username || account.displayName}`,
        )
        .join("\n");

      // Get subscription info
      const subscriptionInfo =
        await this.subscriptionService.getUserSubscriptionInfo(user.id);

      const subscriptionText =
        subscriptionInfo.subscriptionPlan === "PREMIUM"
          ? `💎 Premium ($10/month) - Active`
          : `🆓 Free Plan - ${subscriptionInfo.freeMessagesRemaining}/3 messages remaining`;

      const profileMessage = `👤 Your Profile

🆔 User ID: ${user.id}
📧 Email: ${user.email || "Not set"}
👤 Username: ${user.username || "Not set"}
📅 Member since: ${user.createdAt.toDateString()}

💰 Subscription: ${subscriptionText}

🔗 Connected Platforms (${user.accounts.length}):
${platformList || "None"}

📺 Active Channels: ${user.channels.length}
📤 Messages Sent: ${subscriptionInfo.totalMessages}
⏰ Scheduled Messages: ${user._count?.messageQueue || 0}`;

      await this.telegramApiService.sendMessage(bot, chatId, profileMessage);
    } catch (error) {
      this.logger.error("Error fetching profile:", error);
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        "❌ Error fetching your profile. Please try again.",
      );
    }
  }

  async handleMessageHistory(
    bot: TelegramBot,
    context: TelegramHandlerContext,
  ): Promise<void> {
    const { chatId, telegramUser } = context;

    try {
      const user = await this.userManagementService.findUserByTelegramId(
        telegramUser.id.toString(),
      );
      if (!user) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          "❌ User not found. Please use /start to create an account.",
        );
        return;
      }

      const messages = await this.messageService.getMessagesByUser(user.id, 10);

      if (messages.length === 0) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          "📭 No messages found.\n\nYou haven't sent any messages yet. Use '📢 Send Message' to broadcast your first message!",
        );
        return;
      }

      const messageList = messages
        .map((msg, index) => {
          const status = this.getStatusEmoji(msg.status);
          const type = this.getMessageTypeEmoji(msg.messageType);
          const date = msg.sentAt
            ? msg.sentAt.toLocaleDateString()
            : msg.createdAt.toLocaleDateString();
          const content =
            msg.content.length > 50
              ? msg.content.substring(0, 50) + "..."
              : msg.content;
          const channelTitle = (msg as any).channel?.title || "Unknown Channel";

          return `${index + 1}. ${status} ${type} ${channelTitle}\n   "${content}"\n   📅 ${date}`;
        })
        .join("\n\n");

      const historyMessage = `📜 Message History (Last 10)

${messageList}

Legend:
✅ Sent  ❌ Failed  ⏳ Pending  📤 Scheduled

Use /messages_detailed for more information about specific messages.`;

      await this.telegramApiService.sendMessage(bot, chatId, historyMessage);
    } catch (error) {
      this.logger.error("Error fetching message history:", error);
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        "❌ Error fetching message history. Please try again.",
      );
    }
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case "SENT":
        return "✅";
      case "FAILED":
        return "❌";
      case "PENDING":
        return "⏳";
      case "SCHEDULED":
        return "📤";
      case "CANCELLED":
        return "🚫";
      default:
        return "❓";
    }
  }

  private getMessageTypeEmoji(type: string): string {
    switch (type) {
      case "TEXT":
        return "💬";
      case "PHOTO":
        return "📷";
      case "VIDEO":
        return "🎥";
      case "DOCUMENT":
        return "📄";
      case "AUDIO":
        return "🎵";
      case "GIF":
        return "🎬";
      case "STICKER":
        return "😀";
      case "POLL":
        return "📊";
      case "LOCATION":
        return "📍";
      default:
        return "💬";
    }
  }

  async handleSubscribe(
    bot: TelegramBot,
    context: TelegramHandlerContext,
  ): Promise<void> {
    const { chatId, telegramUser } = context;

    try {
      const user = await this.userManagementService.findUserByTelegramId(
        telegramUser.id.toString(),
      );
      if (!user) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          "❌ User not found. Please use /start to create an account.",
        );
        return;
      }

      const subscriptionInfo =
        await this.subscriptionService.getUserSubscriptionInfo(user.id);

      if (subscriptionInfo.subscriptionPlan === "PREMIUM") {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          `💎 Premium Subscription Active!

You already have an active premium subscription.

📊 Your Stats:
• Total messages sent: ${subscriptionInfo.totalMessages}
• Subscription status: ${subscriptionInfo.subscriptionStatus}

Use /cancel_subscription if you want to cancel your subscription.`,
        );
        return;
      }

      const subscribeMessage = `💎 Upgrade to Premium

🆓 Your Free Plan:
• Free messages used: ${subscriptionInfo.freeMessagesUsed}/3
• Remaining: ${subscriptionInfo.freeMessagesRemaining}

💎 Premium Plan - $10/month:
• ✅ Unlimited messages
• ✅ Priority support
• ✅ Advanced scheduling
• ✅ Analytics dashboard
• ✅ Custom branding

Click the button below to upgrade:`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "💎 Upgrade to Premium",
              callback_data: "upgrade_premium",
            },
          ],
          [
            {
              text: "❌ Cancel",
              callback_data: "cancel_subscription_flow",
            },
          ],
        ],
      };

      await this.telegramApiService.sendMessage(bot, chatId, subscribeMessage, {
        reply_markup: keyboard,
      });
    } catch (error) {
      this.logger.error("Error handling subscribe command:", error);
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        "❌ Error loading subscription information. Please try again.",
      );
    }
  }

  async handleCancelSubscription(
    bot: TelegramBot,
    context: TelegramHandlerContext,
  ): Promise<void> {
    const { chatId, telegramUser } = context;

    try {
      const user = await this.userManagementService.findUserByTelegramId(
        telegramUser.id.toString(),
      );
      if (!user) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          "❌ User not found. Please use /start to create an account.",
        );
        return;
      }

      const subscriptionInfo =
        await this.subscriptionService.getUserSubscriptionInfo(user.id);

      if (subscriptionInfo.subscriptionPlan !== "PREMIUM") {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          "❌ You don't have an active premium subscription to cancel.",
        );
        return;
      }

      const cancelMessage = `🚫 Cancel Premium Subscription

Are you sure you want to cancel your premium subscription?

❌ You will lose:
• Unlimited messages
• Priority support
• Advanced features

✅ You will keep:
• 3 free messages per month
• Basic functionality
• Your data and channels

Your subscription will remain active until the end of the current billing period.`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: "🚫 Yes, Cancel Subscription",
              callback_data: "confirm_cancel_subscription",
            },
          ],
          [
            {
              text: "❌ No, Keep Premium",
              callback_data: "keep_subscription",
            },
          ],
        ],
      };

      await this.telegramApiService.sendMessage(bot, chatId, cancelMessage, {
        reply_markup: keyboard,
      });
    } catch (error) {
      this.logger.error("Error handling cancel subscription command:", error);
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        "❌ Error loading subscription information. Please try again.",
      );
    }
  }
}
