import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "../config/config.service";
import * as TelegramBot from "node-telegram-bot-api";

// Handlers
import { CommandHandler } from "./handlers/command.handler";
import { ChannelHandler } from "./handlers/channel.handler";
import { CallbackHandler } from "./handlers/callback.handler";
import { BroadcastHandler } from "./handlers/broadcast.handler";

// Services
import { TelegramApiService } from "./services/telegram-api.service";
import { I18nService } from "./services/i18n.service";

// Types
import { TelegramHandlerContext } from "./types/telegram.types";

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: TelegramBot;
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    private configService: ConfigService,
    private commandHandler: CommandHandler,
    private channelHandler: ChannelHandler,
    private callbackHandler: CallbackHandler,
    private broadcastHandler: BroadcastHandler,
    private telegramApiService: TelegramApiService,
    private i18nService: I18nService,
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
    // Command handlers
    this.bot.onText(/\/start/, this.handleCommand.bind(this, "start"));
    this.bot.onText(/\/profile/, this.handleCommand.bind(this, "profile"));
    this.bot.onText(/\/channels/, this.handleCommand.bind(this, "channels"));
    this.bot.onText(
      /\/add_channel/,
      this.handleCommand.bind(this, "add_channel"),
    );
    this.bot.onText(/\/messages/, this.handleCommand.bind(this, "messages"));
    this.bot.onText(/\/menu/, this.handleCommand.bind(this, "menu"));
    this.bot.onText(/\/subscribe/, this.handleCommand.bind(this, "subscribe"));
    this.bot.onText(
      /\/cancel_subscription/,
      this.handleCommand.bind(this, "cancel_subscription"),
    );

    // Button text handlers (English)
    this.bot.onText(/^👤 Profile$/, this.handleCommand.bind(this, "profile"));
    this.bot.onText(
      /^📋 My Channels$/,
      this.handleCommand.bind(this, "channels"),
    );
    this.bot.onText(
      /^➕ Add Channel$/,
      this.handleCommand.bind(this, "add_channel"),
    );
    this.bot.onText(
      /^📢 Send Message$/,
      this.handleCommand.bind(this, "broadcast"),
    );
    this.bot.onText(
      /^📜 Message History$/,
      this.handleCommand.bind(this, "messages"),
    );
    this.bot.onText(/^🌐 Language$/, this.handleCommand.bind(this, "language"));
    this.bot.onText(/^💎 Subscription$/, this.handleCommand.bind(this, "subscription_management"));

    // Button text handlers (Russian)
    this.bot.onText(/^👤 Профиль$/, this.handleCommand.bind(this, "profile"));
    this.bot.onText(
      /^📋 Мои каналы$/,
      this.handleCommand.bind(this, "channels"),
    );
    this.bot.onText(
      /^➕ Добавить канал$/,
      this.handleCommand.bind(this, "add_channel"),
    );
    this.bot.onText(
      /^📢 Отправить сообщение$/,
      this.handleCommand.bind(this, "broadcast"),
    );
    this.bot.onText(
      /^📜 История сообщений$/,
      this.handleCommand.bind(this, "messages"),
    );
    this.bot.onText(/^💎 Подписка$/, this.handleCommand.bind(this, "subscription_management"));
    this.bot.onText(/^🌐 Язык$/, this.handleCommand.bind(this, "language"));

    // Channel username input handler
    this.bot.onText(
      /^@([a-zA-Z0-9_]+)$/,
      this.handleChannelUsernameInput.bind(this),
    );

    // General message handler for broadcast sessions
    this.bot.on("message", this.handleGeneralMessage.bind(this));

    // Auto-detect when bot is added to channels/groups
    this.bot.on("my_chat_member", this.handleChatMemberUpdate.bind(this));
    this.bot.on("new_chat_members", this.handleNewChatMembers.bind(this));

    // Callback query handler
    this.bot.on("callback_query", this.handleCallbackQuery.bind(this));

    // Error handling
    this.bot.on("error", (error) => {
      this.logger.error("Telegram bot error:", error);
    });

    this.logger.log("Telegram bot handlers set up");
  }

  private async handleCommand(
    command: string,
    msg: TelegramBot.Message,
  ): Promise<void> {
    if (!msg.from) return;

    const context: TelegramHandlerContext = {
      chatId: msg.chat.id,
      telegramUser: msg.from,
      message: msg,
    };

    try {
      switch (command) {
        case "start":
          await this.commandHandler.handleStart(this.bot, context);
          break;
        case "profile":
          await this.commandHandler.handleProfile(this.bot, context);
          break;
        case "channels":
          await this.channelHandler.handleChannelsList(this.bot, context);
          break;
        case "add_channel":
          await this.channelHandler.handleAddChannelCommand(this.bot, context);
          break;
        case "broadcast":
          await this.broadcastHandler.handleBroadcastCommand(this.bot, context);
          break;
        case "messages":
          await this.commandHandler.handleMessageHistory(this.bot, context);
          break;
        case "menu":
          await this.commandHandler.showMainMenu(
            this.bot,
            context.chatId,
            context.telegramUser.id.toString(),
          );
          break;
        case "language":
          await this.commandHandler.handleLanguageSettings(this.bot, context);
          break;
        case "subscribe":
          await this.commandHandler.handleSubscribe(this.bot, context);
          break;
        case "cancel_subscription":
          await this.commandHandler.handleCancelSubscription(this.bot, context);
          break;
        case "subscription_management":
          await this.commandHandler.handleSubscriptionManagement(this.bot, context);
          break;
        default:
          this.logger.warn(`Unknown command: ${command}`);
      }
    } catch (error) {
      this.logger.error(`Error handling command ${command}:`, error);
      await this.telegramApiService.sendMessage(
        this.bot,
        msg.chat.id,
        "❌ An error occurred. Please try again.",
      );
    }
  }

  private async handleChannelUsernameInput(
    msg: TelegramBot.Message,
    match: RegExpExecArray,
  ): Promise<void> {
    if (!msg.from || !match) return;

    const context: TelegramHandlerContext = {
      chatId: msg.chat.id,
      telegramUser: msg.from,
      message: msg,
    };

    try {
      await this.channelHandler.handleChannelUsernameInput(
        this.bot,
        context,
        match[1],
      );
    } catch (error) {
      this.logger.error("Error handling channel username input:", error);
      await this.telegramApiService.sendMessage(
        this.bot,
        msg.chat.id,
        "❌ An error occurred while processing the channel username.",
      );
    }
  }

  private async handleChatMemberUpdate(
    update: TelegramBot.ChatMemberUpdated,
  ): Promise<void> {
    try {
      const chat = update.chat;
      const newMember = update.new_chat_member;
      const oldMember = update.old_chat_member;

      // Check if our bot was added as admin
      if (
        newMember.user.id === (await this.bot.getMe()).id &&
        newMember.status === "administrator" &&
        oldMember.status !== "administrator"
      ) {
        await this.channelHandler.handleBotAddedToChannel(
          this.bot,
          chat,
          update.from,
        );
      }
    } catch (error) {
      this.logger.error("Error handling chat member update:", error);
    }
  }

  private async handleNewChatMembers(msg: TelegramBot.Message): Promise<void> {
    try {
      if (!msg.new_chat_members || !msg.from) return;

      const botInfo = await this.bot.getMe();
      const botAdded = msg.new_chat_members.some(
        (member) => member.id === botInfo.id,
      );

      if (botAdded) {
        await this.channelHandler.handleBotAddedToChannel(
          this.bot,
          msg.chat,
          msg.from,
        );
      }
    } catch (error) {
      this.logger.error("Error handling new chat members:", error);
    }
  }

  private async handleCallbackQuery(
    callbackQuery: TelegramBot.CallbackQuery,
  ): Promise<void> {
    try {
      // Check for broadcast confirmations first
      if (callbackQuery.data?.startsWith("broadcast_")) {
        await this.broadcastHandler.handleBroadcastConfirmation(
          this.bot,
          callbackQuery,
        );
        return;
      }

      await this.callbackHandler.handleCallbackQuery(this.bot, callbackQuery);
    } catch (error) {
      this.logger.error("Error handling callback query:", error);
      if (callbackQuery.message?.chat.id) {
        await this.telegramApiService.sendMessage(
          this.bot,
          callbackQuery.message.chat.id,
          "❌ An error occurred. Please try again.",
        );
      }
    }
  }

  private async handleGeneralMessage(msg: TelegramBot.Message): Promise<void> {
    // Skip if it's a command or button text (already handled by other handlers)
    if (
      msg.text?.startsWith("/") ||
      msg.text === "👤 Profile" ||
      msg.text === "📋 My Channels" ||
      msg.text === "➕ Add Channel" ||
      msg.text === "📢 Send Message" ||
      msg.text === "📜 Message History" ||
      msg.text?.startsWith("@")
    ) {
      return;
    }

    // Check if user has an active broadcast session
    if (this.broadcastHandler.hasBroadcastSession(msg.chat.id)) {
      await this.broadcastHandler.handleBroadcastMessage(this.bot, msg);
    }
  }

  // Public method to send notifications from other services
  async sendSubscriptionSuccessNotification(
    chatId: number,
    userDisplayName?: string,
  ): Promise<void> {
    try {
      // Get user language for proper translations
      const userLanguage = await this.i18nService.getUserLanguage(chatId.toString());
      const messages = this.i18nService.getMessages(userLanguage);
      
      // Send success notification with translated content
      const successMessage = `${messages.messages.subscription.premiumActivatedTitle}

${messages.messages.subscription.premiumActivatedMessage}

${messages.messages.subscription.premiumActivatedAccess}
${messages.messages.subscription.premiumActivatedFeatures.unlimitedMessages}
${messages.messages.subscription.premiumActivatedFeatures.prioritySupport}
${messages.messages.subscription.premiumActivatedFeatures.advancedScheduling}
${messages.messages.subscription.premiumActivatedFeatures.analyticsDashboard}
${messages.messages.subscription.premiumActivatedFeatures.customBranding}

${messages.messages.subscription.premiumActivatedThanks}`;

      await this.telegramApiService.sendMessage(
        this.bot,
        chatId,
        successMessage,
      );

      // Show updated profile after a short delay
      try {
        const context = {
          chatId,
          telegramUser: {
            id: chatId,
            is_bot: false,
            first_name: userDisplayName || "User",
            username: undefined,
          } as any,
          message: {} as any,
        };

        await this.commandHandler.handleProfile(this.bot, context);
      } catch (error) {
        this.logger.error(
          "Error showing profile after subscription success:",
          error,
        );
      }
    } catch (error) {
      this.logger.error(
        "Error sending subscription success notification:",
        error,
      );
    }
  }
}
