import { Injectable, Logger } from "@nestjs/common";
import * as TelegramBot from "node-telegram-bot-api";
import { UserManagementService } from "../services/user-management.service";
import { TelegramApiService } from "../services/telegram-api.service";
import { TelegramHandlerContext } from "../types/telegram.types";

@Injectable()
export class CommandHandler {
  private readonly logger = new Logger(CommandHandler.name);

  constructor(
    private userManagementService: UserManagementService,
    private telegramApiService: TelegramApiService,
  ) {}

  async handleStart(bot: TelegramBot, context: TelegramHandlerContext): Promise<void> {
    const { chatId, telegramUser } = context;

    if (!telegramUser) {
      await this.telegramApiService.sendMessage(bot, chatId, "❌ Unable to get user information");
      return;
    }

    try {
      // Check if user already exists
      let user = await this.userManagementService.findUserByTelegramId(telegramUser.id.toString());

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
      user = await this.userManagementService.createUserWithTelegramAccount(telegramUser);

      const welcomeMessage = `🚀 Welcome to Multi-Platform Bot, ${telegramUser.first_name}!

✅ Your account has been created successfully!
🆔 User ID: ${user.id}
📱 Connected Platform: Telegram

What you can do:
• Connect other social platforms (Discord, Twitter, VK)
• Send messages across all platforms
• Schedule messages for later
• Manage your channels and groups

Use /help to see all available commands.`;

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

  async handleProfile(bot: TelegramBot, context: TelegramHandlerContext): Promise<void> {
    const { chatId, telegramUser } = context;

    try {
      const user = await this.userManagementService.findUserWithStats(telegramUser.id.toString());

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

      const profileMessage = `👤 Your Profile

🆔 User ID: ${user.id}
📧 Email: ${user.email || "Not set"}
👤 Username: ${user.username || "Not set"}
📅 Member since: ${user.createdAt.toDateString()}

🔗 Connected Platforms (${user.accounts.length}):
${platformList || "None"}

📺 Active Channels: ${user.channels.length}
📤 Messages Sent: ${user._count?.messages || 0}
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

  async showMainMenu(bot: TelegramBot, chatId: number): Promise<void> {
    const menuMessage = `🎛️ Main Menu

Choose what you'd like to do:`;

    const keyboard = this.telegramApiService.createReplyKeyboard([
      [{ text: "👤 Profile" }, { text: "📋 My Channels" }],
      [{ text: "➕ Add Channel" }, { text: "📢 Send Message" }],
      [{ text: "⏰ Schedule Message" }, { text: "📊 Statistics" }]
    ]);

    await this.telegramApiService.sendMessage(bot, chatId, menuMessage, {
      reply_markup: keyboard,
    });
  }
} 