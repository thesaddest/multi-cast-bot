import { Injectable, Logger } from "@nestjs/common";
import * as TelegramBot from "node-telegram-bot-api";
import { BotPermissions, TelegramChatMemberAdministrator } from "../types/telegram.types";

@Injectable()
export class TelegramApiService {
  private readonly logger = new Logger(TelegramApiService.name);

  async getChatInfo(bot: TelegramBot, chatId: number | string): Promise<TelegramBot.Chat> {
    return await bot.getChat(chatId);
  }

  async getChatMemberCount(bot: TelegramBot, chatId: number | string): Promise<number | undefined> {
    try {
      return await bot.getChatMemberCount(chatId);
    } catch (error) {
      this.logger.warn(`Could not get member count for chat ${chatId}`);
      return undefined;
    }
  }

  async getBotPermissions(bot: TelegramBot, chatId: number | string): Promise<BotPermissions> {
    try {
      const botInfo = await bot.getMe();
      const chatMember = await bot.getChatMember(chatId, botInfo.id);
      const isAdmin = chatMember.status === 'administrator' || chatMember.status === 'creator';
      
      let canPost = false;
      if (isAdmin && chatMember.status === 'administrator') {
        const adminMember = chatMember as TelegramChatMemberAdministrator;
        canPost = adminMember.can_post_messages !== false;
      } else if (chatMember.status === 'creator') {
        canPost = true; // Creator can always post
      }
      
      return { isAdmin, canPost };
    } catch (error) {
      this.logger.warn(`Could not check bot permissions in ${chatId}`);
      return { isAdmin: false, canPost: false };
    }
  }

  async sendMessage(
    bot: TelegramBot,
    chatId: number,
    text: string,
    options?: TelegramBot.SendMessageOptions
  ): Promise<TelegramBot.Message> {
    return await bot.sendMessage(chatId, text, options);
  }

  async answerCallbackQuery(
    bot: TelegramBot,
    callbackQueryId: string,
    options?: TelegramBot.AnswerCallbackQueryOptions
  ): Promise<boolean> {
    return await bot.answerCallbackQuery(callbackQueryId, options);
  }

  async editMessageText(
    bot: TelegramBot,
    text: string,
    options: TelegramBot.EditMessageTextOptions
  ): Promise<TelegramBot.Message | boolean> {
    return await bot.editMessageText(text, options);
  }

  createInlineKeyboard(buttons: TelegramBot.InlineKeyboardButton[][]): TelegramBot.InlineKeyboardMarkup {
    return {
      inline_keyboard: buttons
    };
  }

  createReplyKeyboard(
    buttons: TelegramBot.KeyboardButton[][],
    options?: {
      resize_keyboard?: boolean;
      one_time_keyboard?: boolean;
      is_persistent?: boolean;
    }
  ): TelegramBot.ReplyKeyboardMarkup {
    return {
      keyboard: buttons,
      resize_keyboard: options?.resize_keyboard ?? true,
      one_time_keyboard: options?.one_time_keyboard ?? false,
      is_persistent: options?.is_persistent ?? true,
    };
  }
} 