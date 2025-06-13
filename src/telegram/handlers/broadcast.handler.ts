import { Injectable, Logger } from "@nestjs/common";
import * as TelegramBot from "node-telegram-bot-api";
import { UserManagementService } from "../services/user-management.service";
import { ChannelManagementService } from "../services/channel-management.service";
import { TelegramApiService } from "../services/telegram-api.service";
import { MessageService } from "../services/message.service";
import { TelegramHandlerContext, ChannelWithMetadata } from "../types/telegram.types";
import { Platform, MessageType, MessageStatus } from "@prisma/client";

interface BroadcastSession {
  userId: string;
  message: string;
  messageId?: number;
  messageType: MessageType;
  mediaUrls?: string[];
  mediaTypes?: string[];
  originalMessage?: TelegramBot.Message; // Store original message for media processing
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
    private messageService: MessageService,
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
        messageType: MessageType.TEXT,
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
• Media files will be posted natively (not forwarded)
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

      // Store the message and detect type
      session.message = this.extractMessageContent(msg);
      session.messageId = msg.message_id;
      session.messageType = this.detectMessageType(msg);
      session.mediaUrls = this.extractMediaUrls(msg);
      session.mediaTypes = this.extractMediaTypes(msg);
      session.originalMessage = msg; // Store for native message sending
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
        let dbMessage;
        try {
          // Create message record in database
          dbMessage = await this.messageService.createMessage({
            content: session.message,
            messageType: session.messageType,
            platform: Platform.TELEGRAM,
            userId: session.userId,
            channelId: channel.id,
            mediaUrls: session.mediaUrls || [],
            mediaTypes: session.mediaTypes || [],
            metadata: {
              originalMessageId: session.messageId,
              broadcastSession: true,
            },
          });

          let sentMessage;
          // Send native message instead of forwarding
          sentMessage = await this.sendNativeMessage(bot, channel, session, chatId);

          // Update message record as sent
          await this.messageService.markMessageAsSent(dbMessage.id, sentMessage.message_id.toString());

          successCount++;
          results.push(`✅ ${channel.title}`);
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          failureCount++;
          results.push(`❌ ${channel.title} - ${error.message}`);
          this.logger.warn(`Failed to send to ${channel.title}:`, error.message);

          // Update message record as failed if it was created
          if (dbMessage) {
            await this.messageService.markMessageAsFailed(dbMessage.id, error.message);
          }
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

  private getMessageTypeFromTelegramMessage(messageId?: number): MessageType {
    // Since we don't have access to the original message object here,
    // we'll default to TEXT. For more accurate typing, you could pass
    // the original message object to the broadcast session
    return MessageType.TEXT;
  }

  private extractMessageContent(msg: TelegramBot.Message): string {
    if (msg.text) return msg.text;
    if (msg.caption) return msg.caption;
    if (msg.photo) return '[Photo]';
    if (msg.video) return '[Video]';
    if (msg.document) return '[Document]';
    if (msg.audio) return '[Audio]';
    if (msg.voice) return '[Voice]';
    if (msg.sticker) return '[Sticker]';
    if (msg.animation) return '[GIF]';
    if (msg.poll) return '[Poll]';
    if (msg.location) return '[Location]';
    return '[Media message]';
  }

  private detectMessageType(msg: TelegramBot.Message): MessageType {
    if (msg.photo) return MessageType.PHOTO;
    if (msg.video) return MessageType.VIDEO;
    if (msg.document) return MessageType.DOCUMENT;
    if (msg.audio || msg.voice) return MessageType.AUDIO;
    if (msg.animation) return MessageType.GIF;
    if (msg.sticker) return MessageType.STICKER;
    if (msg.poll) return MessageType.POLL;
    if (msg.location) return MessageType.LOCATION;
    return MessageType.TEXT;
  }

  private extractMediaUrls(msg: TelegramBot.Message): string[] {
    const urls: string[] = [];
    
    if (msg.photo && msg.photo.length > 0) {
      // Get the highest resolution photo
      const photo = msg.photo[msg.photo.length - 1];
      urls.push(photo.file_id);
    }
    
    if (msg.video) {
      urls.push(msg.video.file_id);
    }
    
    if (msg.document) {
      urls.push(msg.document.file_id);
    }
    
    if (msg.audio) {
      urls.push(msg.audio.file_id);
    }
    
    if (msg.voice) {
      urls.push(msg.voice.file_id);
    }
    
    if (msg.animation) {
      urls.push(msg.animation.file_id);
    }
    
    if (msg.sticker) {
      urls.push(msg.sticker.file_id);
    }
    
    return urls;
  }

  private extractMediaTypes(msg: TelegramBot.Message): string[] {
    const types: string[] = [];
    
    if (msg.photo) types.push('photo');
    if (msg.video) types.push('video');
    if (msg.document) types.push('document');
    if (msg.audio) types.push('audio');
    if (msg.voice) types.push('voice');
    if (msg.animation) types.push('animation');
    if (msg.sticker) types.push('sticker');
    
    return types;
  }

  private async sendNativeMessage(
    bot: TelegramBot, 
    channel: any, 
    session: BroadcastSession, 
    originalChatId: number
  ): Promise<TelegramBot.Message> {
    const channelId = parseInt(channel.platformId);
    
    // If there's no original message or media, send as text
    if (!session.originalMessage || session.messageType === MessageType.TEXT) {
      return await this.telegramApiService.sendMessage(
        bot,
        channelId,
        session.message
      );
    }

    // For media messages, send native versions instead of forwarding
    try {
      return await this.sendMessageByType(bot, channelId, session);
    } catch (error) {
      this.logger.warn(`Failed to send native message, falling back to text: ${error.message}`);
      // Fallback to text message
      return await this.telegramApiService.sendMessage(
        bot,
        channelId,
        session.message
      );
    }
  }



  private async sendMessageByType(
    bot: TelegramBot,
    channelId: number,
    session: BroadcastSession
  ): Promise<TelegramBot.Message> {
    const messageText = session.message !== '[Media message]' ? session.message : undefined;
    
    // Send based on message type
    switch (session.messageType) {
      case MessageType.PHOTO:
        if (session.mediaUrls && session.mediaUrls.length > 0) {
          return await bot.sendPhoto(channelId, session.mediaUrls[0], {
            caption: messageText
          });
        }
        break;
        
      case MessageType.VIDEO:
        if (session.mediaUrls && session.mediaUrls.length > 0) {
          return await bot.sendVideo(channelId, session.mediaUrls[0], {
            caption: messageText
          });
        }
        break;
        
      case MessageType.DOCUMENT:
        if (session.mediaUrls && session.mediaUrls.length > 0) {
          return await bot.sendDocument(channelId, session.mediaUrls[0], {
            caption: messageText
          });
        }
        break;
        
      case MessageType.AUDIO:
        if (session.mediaUrls && session.mediaUrls.length > 0) {
          return await bot.sendAudio(channelId, session.mediaUrls[0], {
            caption: messageText
          });
        }
        break;
        
      case MessageType.GIF:
        if (session.mediaUrls && session.mediaUrls.length > 0) {
          return await bot.sendAnimation(channelId, session.mediaUrls[0], {
            caption: messageText
          });
        }
        break;
        
      case MessageType.STICKER:
        if (session.mediaUrls && session.mediaUrls.length > 0) {
          return await bot.sendSticker(channelId, session.mediaUrls[0]);
        }
        break;
        
      default:
        // Fallback to text for any unhandled types
        return await this.telegramApiService.sendMessage(bot, channelId, session.message);
    }
    
    // If we get here, something went wrong, send as text
    return await this.telegramApiService.sendMessage(bot, channelId, session.message);
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