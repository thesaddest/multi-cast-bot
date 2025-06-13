import { Injectable, Logger } from "@nestjs/common";
import * as TelegramBot from "node-telegram-bot-api";
import { UserManagementService } from "../services/user-management.service";
import { ChannelManagementService } from "../services/channel-management.service";
import { TelegramApiService } from "../services/telegram-api.service";
import { TelegramHandlerContext, ChannelWithMetadata } from "../types/telegram.types";

interface BroadcastSession {
  userId: string;
  message: string;
  messageId?: number;
  step: 'waiting_message' | 'confirming' | 'broadcasting';
}

@Injectable()
export class BroadcastHandler {
  private readonly logger = new Logger(BroadcastHandler.name);
  private broadcastSessions = new Map<number, BroadcastSession>();

  constructor(
    private userManagementService: UserManagementService,
    private channelManagementService: ChannelManagementService,
    private telegramApiService: TelegramApiService,
  ) {}

  async handleBroadcastCommand(bot: TelegramBot, context: TelegramHandlerContext): Promise<void> {
    const { chatId, telegramUser } = context;

    try {
      const user = await this.userManagementService.findUserByTelegramId(telegramUser.id.toString());
      if (!user) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          "❌ User not found. Please use /start to create an account."
        );
        return;
      }

      // Get user's active channels
      const channels = await this.channelManagementService.getUserChannels(user.id);
      const activeChannels = channels.filter(channel => channel.isActive && channel.canPost);

      if (activeChannels.length === 0) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          `📢 No Active Channels

You don't have any active channels where you can post messages.

To broadcast messages, you need to:
1️⃣ Add channels using "➕ Add Channel"
2️⃣ Make sure the bot has posting permissions
3️⃣ Activate the channels you want to use

Use "📋 My Channels" to manage your channels.`
        );
        return;
      }

      // Start broadcast session
      this.broadcastSessions.set(chatId, {
        userId: user.id,
        message: '',
        step: 'waiting_message'
      });

      const channelList = activeChannels
        .map((channel, index) => `${index + 1}. ${channel.title} ${this.getChannelTypeEmoji(channel.type)}`)
        .join('\n');

      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        `📢 Broadcast Message

You have ${activeChannels.length} active channel(s) ready for broadcasting:

${channelList}

📝 Please type your message that you want to send to all these channels:

💡 Tips:
• You can send text, photos, videos, or documents
• Use formatting: *bold*, _italic_, \`code\`
• Type /cancel to cancel broadcasting`,
        { parse_mode: 'Markdown' }
      );

    } catch (error) {
      this.logger.error("Error starting broadcast:", error);
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        "❌ Error starting broadcast. Please try again."
      );
    }
  }

  async handleBroadcastMessage(bot: TelegramBot, msg: TelegramBot.Message): Promise<void> {
    const chatId = msg.chat.id;
    const session = this.broadcastSessions.get(chatId);

    if (!session || session.step !== 'waiting_message') {
      return;
    }

    try {
      // Handle cancel command
      if (msg.text === '/cancel') {
        this.broadcastSessions.delete(chatId);
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          "❌ Broadcast cancelled."
        );
        return;
      }

      // Store the message
      session.message = msg.text || '[Media message]';
      session.messageId = msg.message_id;
      session.step = 'confirming';

      // Get user's active channels for confirmation
      const channels = await this.channelManagementService.getUserChannels(session.userId);
      const activeChannels = channels.filter(channel => channel.isActive && channel.canPost);

      const channelList = activeChannels
        .map((channel, index) => `${index + 1}. ${channel.title} ${this.getChannelTypeEmoji(channel.type)}`)
        .join('\n');

      const confirmationMessage = `📢 Confirm Broadcast

Your message will be sent to ${activeChannels.length} channel(s):

${channelList}

📝 Message Preview:
${session.message.length > 200 ? session.message.substring(0, 200) + '...' : session.message}

Are you sure you want to broadcast this message?`;

      const keyboard: TelegramBot.InlineKeyboardMarkup = {
        inline_keyboard: [
          [
            { text: "✅ Send to All", callback_data: "broadcast_confirm" },
            { text: "❌ Cancel", callback_data: "broadcast_cancel" }
          ]
        ]
      };

      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        confirmationMessage,
        { reply_markup: keyboard }
      );

    } catch (error) {
      this.logger.error("Error handling broadcast message:", error);
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        "❌ Error processing your message. Please try again."
      );
    }
  }

  async handleBroadcastConfirmation(bot: TelegramBot, callbackQuery: TelegramBot.CallbackQuery): Promise<void> {
    const chatId = callbackQuery.message?.chat.id;
    if (!chatId) return;

    const session = this.broadcastSessions.get(chatId);
    if (!session || session.step !== 'confirming') {
      await bot.answerCallbackQuery(callbackQuery.id, { text: "Session expired. Please start again." });
      return;
    }

    try {
      if (callbackQuery.data === 'broadcast_cancel') {
        this.broadcastSessions.delete(chatId);
        await bot.editMessageText(
          "❌ Broadcast cancelled.",
          {
            chat_id: chatId,
            message_id: callbackQuery.message?.message_id
          }
        );
        await bot.answerCallbackQuery(callbackQuery.id, { text: "Cancelled" });
        return;
      }

      if (callbackQuery.data === 'broadcast_confirm') {
        session.step = 'broadcasting';
        
        await bot.editMessageText(
          "📡 Broadcasting message...\n\nPlease wait while we send your message to all channels.",
          {
            chat_id: chatId,
            message_id: callbackQuery.message?.message_id
          }
        );

        await bot.answerCallbackQuery(callbackQuery.id, { text: "Broadcasting..." });

        // Start the actual broadcasting
        await this.executeBroadcast(bot, session, chatId);
      }

    } catch (error) {
      this.logger.error("Error handling broadcast confirmation:", error);
      await bot.answerCallbackQuery(callbackQuery.id, { text: "Error occurred" });
    }
  }

  private async executeBroadcast(bot: TelegramBot, session: BroadcastSession, chatId: number): Promise<void> {
    try {
      // Get user's active channels
      const channels = await this.channelManagementService.getUserChannels(session.userId);
      const activeChannels = channels.filter(channel => channel.isActive && channel.canPost);

      let successCount = 0;
      let failureCount = 0;
      const results: string[] = [];

      // Send to each channel
      for (const channel of activeChannels) {
        try {
          if (session.messageId) {
            // Forward the original message
            await bot.forwardMessage(
              parseInt(channel.platformId),
              chatId,
              session.messageId
            );
          } else {
            // Send as text
            await this.telegramApiService.sendMessage(
              bot,
              parseInt(channel.platformId),
              session.message
            );
          }

          successCount++;
          results.push(`✅ ${channel.title}`);
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          failureCount++;
          results.push(`❌ ${channel.title} - ${error.message}`);
          this.logger.warn(`Failed to send to ${channel.title}:`, error.message);
        }
      }

      // Send results summary
      const summaryMessage = `📊 Broadcast Complete!

✅ Successfully sent: ${successCount}
❌ Failed: ${failureCount}
📊 Total channels: ${activeChannels.length}

📋 Detailed Results:
${results.join('\n')}

${failureCount > 0 ? '\n💡 Failed channels may have restricted bot permissions or be inactive.' : ''}`;

      await this.telegramApiService.sendMessage(bot, chatId, summaryMessage);

      // Clean up session
      this.broadcastSessions.delete(chatId);

    } catch (error) {
      this.logger.error("Error executing broadcast:", error);
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        "❌ Error during broadcast. Some messages may not have been sent."
      );
      this.broadcastSessions.delete(chatId);
    }
  }

  private getChannelTypeEmoji(type: string): string {
    switch (type) {
      case 'CHANNEL': return '📺';
      case 'GROUP': return '👥';
      case 'SUPERGROUP': return '🏢';
      default: return '📱';
    }
  }

  // Check if user has an active broadcast session
  hasBroadcastSession(chatId: number): boolean {
    return this.broadcastSessions.has(chatId);
  }

  // Get broadcast session
  getBroadcastSession(chatId: number): BroadcastSession | undefined {
    return this.broadcastSessions.get(chatId);
  }

  // Cancel broadcast session
  cancelBroadcastSession(chatId: number): void {
    this.broadcastSessions.delete(chatId);
  }
} 