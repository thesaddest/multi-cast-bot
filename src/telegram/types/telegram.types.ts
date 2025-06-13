import * as TelegramBot from "node-telegram-bot-api";
import { User, Channel, Account, Platform, ChannelType } from "@prisma/client";

export type TelegramAccount = Account & {
  platform: Platform;
};

export interface TelegramUserWithChannels extends User {
  accounts: TelegramAccount[];
  channels: Channel[];
  _count?: {
    messages: number;
    messageQueue: number;
  };
}

export interface TelegramHandlerContext {
  chatId: number;
  telegramUser: TelegramBot.User;
  message?: TelegramBot.Message;
  callbackQuery?: TelegramBot.CallbackQuery;
}

export interface ChannelMetadata {
  chatType?: string;
  inviteLink?: string;
  lastUpdated?: string;
  botPermissions?: {
    canPost: boolean;
    canDelete: boolean;
    canPin: boolean;
  };
}

export type ChannelWithMetadata = Channel & {
  metadata?: ChannelMetadata;
};

export interface CreateChannelData {
  userId: string;
  platformId: string;
  title: string;
  type: ChannelType;
  username?: string;
  description?: string;
  memberCount?: number;
  canPost?: boolean;
  metadata?: ChannelMetadata;
}

export interface BotPermissions {
  isAdmin: boolean;
  canPost: boolean;
}

// Extended Telegram types for better type safety
export interface TelegramChatMemberAdministrator
  extends TelegramBot.ChatMember {
  status: "administrator";
  can_post_messages?: boolean;
  can_edit_messages?: boolean;
  can_delete_messages?: boolean;
  can_pin_messages?: boolean;
}

export interface BotCommandHandler {
  command: string | RegExp;
  handler: (context: TelegramHandlerContext) => Promise<void>;
}

export interface CallbackHandler {
  pattern: string;
  handler: (context: TelegramHandlerContext, data: string) => Promise<void>;
}
