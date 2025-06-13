import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "../config/config.service";
import * as TelegramBot from "node-telegram-bot-api";
import { DbService } from "../db/db.service";
import { Platform, ChannelType } from "@prisma/client";

  @Injectable()
  export class TelegramService implements OnModuleInit {
    private bot: TelegramBot;
    private readonly logger = new Logger(TelegramService.name);

    constructor(
      private configService: ConfigService,
      private dbService: DbService,
    ) {}

    onModuleInit() {
      const token = this.configService.get<string>("tg.api_token");
      if (!token) {
        this.logger.error("Telegram API token not found");
        return;
      }

      this.bot = new TelegramBot(token, { polling: true });
      this.setupBotHandlers();
      this.logger.log("Telegram bot initialized");
    }

    private setupBotHandlers() {
      // Start command - Initialize user
      this.bot.onText(/\/start/, this.handleStart.bind(this));

      // Profile command - Show user info
      this.bot.onText(/\/profile/, (msg) => {
        if (msg.from) {
          this.handleProfile(msg.chat.id, msg.from);
        }
      });

      this.bot.onText(/^👤 Profile$/, (msg) => {
        if (msg.from) {
          this.handleProfile(msg.chat.id, msg.from);
        }
      });

      // Main menu command
      this.bot.onText(/\/main_menu/, (msg) => {
        if (msg.chat.id) {
          this.showMainMenu(msg.chat.id);
        }
      });

      this.bot.on("callback_query", this.handleCallbackQuery.bind(this));

      // Error handling
      this.bot.on("error", (error) => {
        this.logger.error("Telegram bot error:", error);
      });

      this.logger.log("Telegram bot handlers set up");
    }

    private async handleStart(msg: TelegramBot.Message) {
      const chatId = msg.chat.id;
      const telegramUser = msg.from;

      if (!telegramUser) {
        await this.bot.sendMessage(chatId, "❌ Unable to get user information");
        return;
      }

      try {
        // Check if user already exists
        let user = await this.dbService.user.findFirst({
          where: {
            accounts: {
              some: {
                platform: Platform.TELEGRAM,
                platformId: telegramUser.id.toString(),
              },
            },
          },
          include: {
            accounts: true,
          },
        });

        if (user) {
          await this.bot.sendMessage(
            chatId,
            `🎉 Welcome back, ${telegramUser.first_name}!\n\nYou're already registered in our system.`,
          );
          await this.showMainMenu(chatId);
          return;
        }

        // Create new user with Telegram account
        user = await this.dbService.user.create({
          data: {
            username: telegramUser.username,
            primaryPlatform: Platform.TELEGRAM,
            accounts: {
              create: {
                platform: Platform.TELEGRAM,
                platformId: telegramUser.id.toString(),
                username: telegramUser.username,
                displayName:
                  `${telegramUser.first_name} ${telegramUser.last_name || ""}`.trim(),
                firstName: telegramUser.first_name,
                lastName: telegramUser.last_name,
              },
            },
          },
          include: {
            accounts: true,
          },
        });

        const welcomeMessage = `
  🚀 Welcome to Multi-Platform Bot, ${telegramUser.first_name}!

  ✅ Your account has been created successfully!
  🆔 User ID: ${user.id}
  📱 Connected Platform: Telegram

  What you can do:
  • Connect other social platforms (Discord, Twitter, VK)
  • Send messages across all platforms
  • Schedule messages for later
  • Manage your channels and groups

  Use /help to see all available commands.
        `;

        await this.bot.sendMessage(chatId, welcomeMessage);
        await this.showMainMenu(chatId);

        this.logger.log(
          `New user created: ${user.id} (Telegram: ${telegramUser.id})`,
        );
      } catch (error) {
        this.logger.error("Error creating user:", error);
        await this.bot.sendMessage(
          chatId,
          "❌ Sorry, there was an error setting up your account. Please try again later.",
        );
      }
    }
    private async showMainMenu(chatId: number) {
      const menuMessage = `
  🎛️ Main Menu

  Choose what you'd like to do:
    `;

      await this.bot.sendMessage(chatId, menuMessage, {
        reply_markup: {
          keyboard: [[{ text: "👤 Profile" }]],
          resize_keyboard: true, // Makes keyboard compact
          one_time_keyboard: false, // Keyboard stays visible
          is_persistent: true, // Keyboard persists across app restarts
        },
      });
    }

    private async handleProfile(chatId: number, telegramUser: TelegramBot.User) {
      try {
        const user = await this.dbService.user.findFirst({
          where: {
            accounts: {
              some: {
                platform: Platform.TELEGRAM,
                platformId: telegramUser.id.toString(),
              },
            },
          },
          include: {
            accounts: {
              where: { isActive: true },
            },
            channels: {
              where: { isActive: true },
            },
            _count: {
              select: {
                messages: true,
                messageQueue: true,
              },
            },
          },
        });

        if (!user) {
          await this.bot.sendMessage(
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

        const profileMessage = `
  👤 Your Profile

  🆔 User ID: ${user.id}
  📧 Email: ${user.email || "Not set"}
  👤 Username: ${user.username || "Not set"}
  📅 Member since: ${user.createdAt.toDateString()}

  🔗 Connected Platforms (${user.accounts.length}):
  ${platformList || "None"}

  📺 Active Channels: ${user.channels.length}
  📤 Messages Sent: ${user._count.messages}
  ⏰ Scheduled Messages: ${user._count.messageQueue}
      `;

        await this.bot.sendMessage(chatId, profileMessage);
      } catch (error) {
        this.logger.error("Error fetching profile:", error);
        await this.bot.sendMessage(
          chatId,
          "❌ Error fetching your profile. Please try again.",
        );
      }
    }

    private async handleCallbackQuery(callbackQuery: TelegramBot.CallbackQuery) {
      const chatId = callbackQuery.message?.chat.id;
      const data = callbackQuery.data;
      const telegramUser = callbackQuery.from;

      if (!chatId || !data) {
        this.logger.error("Missing chatId or data, returning");
        return;
      }

      this.logger.debug(
        `Received callback query: ${data} from user: ${telegramUser.id}`,
      );

      // Answer the callback query to remove loading state
      await this.bot.answerCallbackQuery(callbackQuery.id);

      try {
        switch (data) {
          case "profile":
            await this.handleProfile(chatId, telegramUser);
            break;

          case "main_menu":
            await this.showMainMenu(chatId);
            break;

          default:
            this.logger.error("Unknown callback data:", data);
            await this.bot.sendMessage(chatId, "❌ Unknown action");
        }
      } catch (error) {
        this.logger.error("Error handling callback query:", error);
        await this.bot.sendMessage(
          chatId,
          "❌ An error occurred. Please try again.",
        );
      }
    }
  }
