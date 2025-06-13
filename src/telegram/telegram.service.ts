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
    this.bot.onText(/\/start/, this.handleCommand.bind(this, 'start'));
    this.bot.onText(/\/profile/, this.handleCommand.bind(this, 'profile'));
    this.bot.onText(/\/channels/, this.handleCommand.bind(this, 'channels'));
    this.bot.onText(/\/add_channel/, this.handleCommand.bind(this, 'add_channel'));
    this.bot.onText(/\/main_menu/, this.handleCommand.bind(this, 'main_menu'));

    // Button text handlers
    this.bot.onText(/^👤 Profile$/, this.handleCommand.bind(this, 'profile'));
    this.bot.onText(/^📋 My Channels$/, this.handleCommand.bind(this, 'channels'));
    this.bot.onText(/^➕ Add Channel$/, this.handleCommand.bind(this, 'add_channel'));
    this.bot.onText(/^📢 Send Message$/, this.handleCommand.bind(this, 'broadcast'));

    // Channel username input handler
    this.bot.onText(/^@([a-zA-Z0-9_]+)$/, this.handleChannelUsernameInput.bind(this));

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

  private async handleCommand(command: string, msg: TelegramBot.Message): Promise<void> {
    if (!msg.from) return;

    const context: TelegramHandlerContext = {
      chatId: msg.chat.id,
      telegramUser: msg.from,
      message: msg,
    };

    try {
      switch (command) {
        case 'start':
          await this.commandHandler.handleStart(this.bot, context);
          break;
        case 'profile':
          await this.commandHandler.handleProfile(this.bot, context);
          break;
        case 'channels':
          await this.channelHandler.handleChannelsList(this.bot, context);
          break;
        case 'add_channel':
          await this.channelHandler.handleAddChannelCommand(this.bot, context);
          break;
        case 'broadcast':
          await this.broadcastHandler.handleBroadcastCommand(this.bot, context);
          break;
        case 'main_menu':
          await this.commandHandler.showMainMenu(this.bot, msg.chat.id);
          break;
        default:
          this.logger.warn(`Unknown command: ${command}`);
      }
    } catch (error) {
      this.logger.error(`Error handling command ${command}:`, error);
      await this.telegramApiService.sendMessage(
        this.bot,
        msg.chat.id,
        "❌ An error occurred. Please try again."
      );
    }
  }

  private async handleChannelUsernameInput(msg: TelegramBot.Message, match: RegExpExecArray): Promise<void> {
    if (!msg.from || !match) return;

    const context: TelegramHandlerContext = {
      chatId: msg.chat.id,
      telegramUser: msg.from,
      message: msg,
    };

    try {
      await this.channelHandler.handleChannelUsernameInput(this.bot, context, match[1]);
    } catch (error) {
      this.logger.error("Error handling channel username input:", error);
      await this.telegramApiService.sendMessage(
        this.bot,
        msg.chat.id,
        "❌ An error occurred while processing the channel username."
      );
    }
  }

  private async handleChatMemberUpdate(update: TelegramBot.ChatMemberUpdated): Promise<void> {
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
        await this.channelHandler.handleBotAddedToChannel(this.bot, chat, update.from);
      }
    } catch (error) {
      this.logger.error("Error handling chat member update:", error);
    }
  }

  private async handleNewChatMembers(msg: TelegramBot.Message): Promise<void> {
    try {
      if (!msg.new_chat_members || !msg.from) return;

      const botInfo = await this.bot.getMe();
      const botAdded = msg.new_chat_members.some(member => member.id === botInfo.id);

      if (botAdded) {
        await this.channelHandler.handleBotAddedToChannel(this.bot, msg.chat, msg.from);
      }
    } catch (error) {
      this.logger.error("Error handling new chat members:", error);
    }
  }

  private async handleCallbackQuery(callbackQuery: TelegramBot.CallbackQuery): Promise<void> {
    try {
      // Check for broadcast confirmations first
      if (callbackQuery.data?.startsWith('broadcast_')) {
        await this.broadcastHandler.handleBroadcastConfirmation(this.bot, callbackQuery);
        return;
      }

      await this.callbackHandler.handleCallbackQuery(this.bot, callbackQuery);
    } catch (error) {
      this.logger.error("Error handling callback query:", error);
      if (callbackQuery.message?.chat.id) {
        await this.telegramApiService.sendMessage(
          this.bot,
          callbackQuery.message.chat.id,
          "❌ An error occurred. Please try again."
        );
      }
    }
  }

  private async handleGeneralMessage(msg: TelegramBot.Message): Promise<void> {
    // Skip if it's a command or button text (already handled by other handlers)
    if (msg.text?.startsWith('/') || 
        msg.text === '👤 Profile' || 
        msg.text === '📋 My Channels' || 
        msg.text === '➕ Add Channel' || 
        msg.text === '📢 Send Message' ||
        msg.text?.startsWith('@')) {
      return;
    }

    // Check if user has an active broadcast session
    if (this.broadcastHandler.hasBroadcastSession(msg.chat.id)) {
      await this.broadcastHandler.handleBroadcastMessage(this.bot, msg);
    }
  }
} 