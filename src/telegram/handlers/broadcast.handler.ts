import { Injectable, Logger } from "@nestjs/common";
import * as TelegramBot from "node-telegram-bot-api";
import { UserManagementService } from "../services/user-management.service";
import { ChannelManagementService } from "../services/channel-management.service";
import { TelegramApiService } from "../services/telegram-api.service";
import { MessageService } from "../services/message.service";
import { TelegramHandlerContext } from "../types/telegram.types";
import { Platform, MessageType, Channel } from "@prisma/client";

interface BroadcastSession {
  userId: string;
  message: string;
  messageId?: number;
  messageType: MessageType;
  mediaUrls?: string[];
  mediaTypes?: string[];
  originalMessage?: TelegramBot.Message; // Store original message for media processing
  mediaGroupId?: string; // For handling media groups (albums)
  mediaGroupMessages?: TelegramBot.Message[]; // Store all messages in media group
  step: "waiting_message" | "confirming" | "broadcasting";
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

  async handleBroadcastCommand(
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

      // Get user's active channels
      const channels = await this.channelManagementService.getUserChannels(
        user.id,
      );
      const activeChannels = channels.filter(
        (channel) => channel.isActive && channel.canPost,
      );

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

Use "📋 My Channels" to manage your channels.`,
        );
        return;
      }

      // Start broadcast session
      this.broadcastSessions.set(chatId, {
        userId: user.id,
        message: "",
        messageType: MessageType.TEXT,
        step: "waiting_message",
      });

      const channelList = activeChannels
        .map(
          (channel, index) =>
            `${index + 1}. ${channel.title} ${this.getChannelTypeEmoji(channel.type)}`,
        )
        .join("\n");

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
        { parse_mode: "Markdown" },
      );
    } catch (error) {
      this.logger.error("Error starting broadcast:", error);
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        "❌ Error starting broadcast. Please try again.",
      );
    }
  }

  async handleBroadcastMessage(
    bot: TelegramBot,
    msg: TelegramBot.Message,
  ): Promise<void> {
    const chatId = msg.chat.id;
    const session = this.broadcastSessions.get(chatId);

    if (!session || session.step !== "waiting_message") {
      return;
    }

    try {
      // Handle cancel command
      if (msg.text === "/cancel") {
        this.broadcastSessions.delete(chatId);
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          "❌ Broadcast cancelled.",
        );
        return;
      }

      // Check if this is part of a media group (album)
      if (msg.media_group_id) {
        await this.handleMediaGroupMessage(bot, msg, session, chatId);
        return;
      }

      // Store the message and detect type for single messages
      session.message = this.extractMessageContent(msg);
      session.messageId = msg.message_id;
      session.messageType = this.detectMessageType(msg);
      session.mediaUrls = this.extractMediaUrls(msg);
      session.mediaTypes = this.extractMediaTypes(msg);
      session.originalMessage = msg; // Store for native message sending
      session.step = "confirming";

      // Show confirmation for single messages
      await this.showBroadcastConfirmation(bot, session, chatId);
    } catch (error) {
      this.logger.error("Error handling broadcast message:", error);
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        "❌ Error processing your message. Please try again.",
      );
    }
  }

  async handleBroadcastConfirmation(
    bot: TelegramBot,
    callbackQuery: TelegramBot.CallbackQuery,
  ): Promise<void> {
    const chatId = callbackQuery.message?.chat.id;
    if (!chatId) return;

    const session = this.broadcastSessions.get(chatId);
    if (!session || session.step !== "confirming") {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "Session expired. Please start again.",
      });
      return;
    }

    try {
      if (callbackQuery.data === "broadcast_cancel") {
        this.broadcastSessions.delete(chatId);
        await bot.editMessageText("❌ Broadcast cancelled.", {
          chat_id: chatId,
          message_id: callbackQuery.message?.message_id,
        });
        await bot.answerCallbackQuery(callbackQuery.id, { text: "Cancelled" });
        return;
      }

      if (callbackQuery.data === "broadcast_confirm") {
        session.step = "broadcasting";

        await bot.editMessageText(
          "📡 Broadcasting message...\n\nPlease wait while we send your message to all channels.",
          {
            chat_id: chatId,
            message_id: callbackQuery.message?.message_id,
          },
        );

        await bot.answerCallbackQuery(callbackQuery.id, {
          text: "Broadcasting...",
        });

        // Start the actual broadcasting
        await this.executeBroadcast(bot, session, chatId);
      }
    } catch (error) {
      this.logger.error("Error handling broadcast confirmation:", error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: "Error occurred",
      });
    }
  }

  private async executeBroadcast(
    bot: TelegramBot,
    session: BroadcastSession,
    chatId: number,
  ): Promise<void> {
    try {
      // Get user's active channels
      const channels = await this.channelManagementService.getUserChannels(
        session.userId,
      );
      const activeChannels = channels.filter(
        (channel) => channel.isActive && channel.canPost,
      );

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

          // Send native message instead of forwarding
          const sentMessage = await this.sendNativeMessage(
            bot,
            channel,
            session,
            chatId,
          );

          // Update message record as sent
          await this.messageService.markMessageAsSent(
            dbMessage.id,
            sentMessage.message_id.toString(),
          );

          successCount++;
          results.push(`✅ ${channel.title}`);

          // Small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          failureCount++;
          results.push(`❌ ${channel.title} - ${error.message}`);
          this.logger.warn(
            `Failed to send to ${channel.title}:`,
            error.message,
          );

          // Update message record as failed if it was created
          if (dbMessage) {
            await this.messageService.markMessageAsFailed(
              dbMessage.id,
              error.message,
            );
          }
        }
      }

      // Send results summary
      const summaryMessage = `📊 Broadcast Complete!

✅ Successfully sent: ${successCount}
❌ Failed: ${failureCount}
📊 Total channels: ${activeChannels.length}

📋 Detailed Results:
${results.join("\n")}

${failureCount > 0 ? "\n💡 Failed channels may have restricted bot permissions or be inactive." : ""}`;

      await this.telegramApiService.sendMessage(bot, chatId, summaryMessage);

      // Clean up session
      this.broadcastSessions.delete(chatId);
    } catch (error) {
      this.logger.error("Error executing broadcast:", error);
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        "❌ Error during broadcast. Some messages may not have been sent.",
      );
      this.broadcastSessions.delete(chatId);
    }
  }

  private async handleMediaGroupMessage(
    bot: TelegramBot,
    msg: TelegramBot.Message,
    session: BroadcastSession,
    chatId: number,
  ): Promise<void> {
    // Initialize media group handling if this is the first message
    if (!session.mediaGroupId) {
      session.mediaGroupId = msg.media_group_id;
      session.mediaGroupMessages = [msg];
      session.message = this.extractMessageContent(msg);
      session.messageType = this.detectMessageType(msg);

      // Wait for more messages in the group (Telegram sends them quickly)
      setTimeout(async () => {
        await this.processMediaGroup(bot, session, chatId);
      }, 1000); // Wait 1 second for all messages in the group

      return;
    }

    // Add to existing media group if same group ID
    if (session.mediaGroupId === msg.media_group_id) {
      session.mediaGroupMessages!.push(msg);
      // Update message content if this message has caption and previous didn't
      if (msg.caption && !session.message) {
        session.message = msg.caption;
      }
    }
  }

  private async processMediaGroup(
    bot: TelegramBot,
    session: BroadcastSession,
    chatId: number,
  ): Promise<void> {
    if (
      !session.mediaGroupMessages ||
      session.mediaGroupMessages.length === 0
    ) {
      return;
    }

    // Extract all media URLs and types from the group
    session.mediaUrls = [];
    session.mediaTypes = [];

    for (const groupMsg of session.mediaGroupMessages) {
      const urls = this.extractMediaUrls(groupMsg);
      const types = this.extractMediaTypes(groupMsg);
      session.mediaUrls.push(...urls);
      session.mediaTypes.push(...types);
    }

    // Set message type based on the first media item
    session.messageType = this.detectMessageType(session.mediaGroupMessages[0]);
    session.originalMessage = session.mediaGroupMessages[0];
    session.step = "confirming";

    // Show confirmation
    await this.showBroadcastConfirmation(bot, session, chatId);
  }

  private async showBroadcastConfirmation(
    bot: TelegramBot,
    session: BroadcastSession,
    chatId: number,
  ): Promise<void> {
    // Get user's active channels for confirmation
    const channels = await this.channelManagementService.getUserChannels(
      session.userId,
    );
    const activeChannels = channels.filter(
      (channel) => channel.isActive && channel.canPost,
    );

    const channelList = activeChannels
      .map(
        (channel, index) =>
          `${index + 1}. ${channel.title} ${this.getChannelTypeEmoji(channel.type)}`,
      )
      .join("\n");

    const mediaInfo =
      session.mediaUrls && session.mediaUrls.length > 1
        ? `\n📎 Media: ${session.mediaUrls.length} files (${session.mediaTypes?.join(", ")})`
        : session.mediaUrls && session.mediaUrls.length === 1
          ? `\n📎 Media: 1 ${session.mediaTypes?.[0] || "file"}`
          : "";

    const messagePreview = session.message
      ? session.message.length > 200
        ? session.message.substring(0, 200) + "..."
        : session.message
      : "[Media message]";

    const confirmationMessage = `📢 Confirm Broadcast

Your message will be sent to ${activeChannels.length} channel(s):

${channelList}

📝 Message Preview:
${messagePreview}${mediaInfo}

Are you sure you want to broadcast this message?`;

    const keyboard: TelegramBot.InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: "✅ Send to All", callback_data: "broadcast_confirm" },
          { text: "❌ Cancel", callback_data: "broadcast_cancel" },
        ],
      ],
    };

    await this.telegramApiService.sendMessage(
      bot,
      chatId,
      confirmationMessage,
      { reply_markup: keyboard },
    );
  }

  private getChannelTypeEmoji(type: string): string {
    switch (type) {
      case "CHANNEL":
        return "📺";
      case "GROUP":
        return "👥";
      case "SUPERGROUP":
        return "🏢";
      default:
        return "📱";
    }
  }

  private extractMessageContent(msg: TelegramBot.Message): string {
    if (msg.text) return msg.text;
    if (msg.caption) return msg.caption;
    return "";
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

    if (msg.photo) types.push("photo");
    if (msg.video) types.push("video");
    if (msg.document) types.push("document");
    if (msg.audio) types.push("audio");
    if (msg.voice) types.push("voice");
    if (msg.animation) types.push("animation");
    if (msg.sticker) types.push("sticker");

    return types;
  }

  private async sendNativeMessage(
    bot: TelegramBot,
    channel: Channel,
    session: BroadcastSession,
    _originalChatId: number,
  ): Promise<TelegramBot.Message> {
    const channelId = parseInt(channel.platformId);

    // If there's no original message or media, send as text
    if (!session.originalMessage || session.messageType === MessageType.TEXT) {
      return await this.telegramApiService.sendMessage(
        bot,
        channelId,
        session.message,
      );
    }

    // For media messages, send native versions instead of forwarding
    try {
      return await this.sendMessageByType(bot, channelId, session);
    } catch (error) {
      this.logger.warn(
        `Failed to send native message, falling back to text: ${error.message}`,
      );
      // Fallback to text message
      return await this.telegramApiService.sendMessage(
        bot,
        channelId,
        session.message,
      );
    }
  }

  private async sendMessageByType(
    bot: TelegramBot,
    channelId: number,
    session: BroadcastSession,
  ): Promise<TelegramBot.Message> {
    const messageText =
      session.message !== "[Media message]" ? session.message : undefined;

    // Handle multiple media files (media group)
    if (session.mediaUrls && session.mediaUrls.length > 1) {
      return await this.sendMediaGroup(bot, channelId, session, messageText);
    }

    // Handle single media file
    if (session.mediaUrls && session.mediaUrls.length === 1) {
      return await this.sendSingleMedia(bot, channelId, session, messageText);
    }

    // Fallback to text message
    return await this.telegramApiService.sendMessage(
      bot,
      channelId,
      session.message,
    );
  }

  private async sendMediaGroup(
    bot: TelegramBot,
    channelId: number,
    session: BroadcastSession,
    caption?: string,
  ): Promise<TelegramBot.Message> {
    if (!session.mediaUrls || !session.mediaTypes) {
      throw new Error("No media URLs or types found for media group");
    }

    // Check if all media can be sent as a group (only photos and videos)
    const supportedGroupTypes = ["photo", "video"];
    const canSendAsGroup = session.mediaTypes.every((type) =>
      supportedGroupTypes.includes(type),
    );

    if (canSendAsGroup) {
      // Send as media group
      const media: TelegramBot.InputMedia[] = [];

      for (let i = 0; i < session.mediaUrls.length; i++) {
        const mediaUrl = session.mediaUrls[i];
        const mediaType = session.mediaTypes[i];

        const inputMedia: TelegramBot.InputMedia = {
          type: mediaType as "photo" | "video",
          media: mediaUrl,
          caption: i === 0 ? caption : undefined, // Only add caption to first item
        };

        media.push(inputMedia);
      }

      // Send media group and return the first message
      const messages = await bot.sendMediaGroup(channelId, media);
      return Array.isArray(messages) ? messages[0] : messages;
    } else {
      // Send multiple individual messages for mixed media types
      let firstMessage: TelegramBot.Message | null = null;

      for (let i = 0; i < session.mediaUrls.length; i++) {
        const mediaUrl = session.mediaUrls[i];
        const mediaType = session.mediaTypes[i];
        const messageCaption = i === 0 ? caption : undefined;

        let sentMessage: TelegramBot.Message;

        switch (mediaType) {
          case "photo":
            sentMessage = await bot.sendPhoto(channelId, mediaUrl, {
              caption: messageCaption,
            });
            break;
          case "video":
            sentMessage = await bot.sendVideo(channelId, mediaUrl, {
              caption: messageCaption,
            });
            break;
          case "document":
            sentMessage = await bot.sendDocument(channelId, mediaUrl, {
              caption: messageCaption,
            });
            break;
          case "audio":
            sentMessage = await bot.sendAudio(channelId, mediaUrl, {
              caption: messageCaption,
            });
            break;
          case "animation":
            sentMessage = await bot.sendAnimation(channelId, mediaUrl, {
              caption: messageCaption,
            });
            break;
          case "sticker":
            sentMessage = await bot.sendSticker(channelId, mediaUrl);
            break;
          default:
            // Fallback to document for unknown types
            sentMessage = await bot.sendDocument(channelId, mediaUrl, {
              caption: messageCaption,
            });
        }

        if (i === 0) {
          firstMessage = sentMessage;
        }

        // Small delay between messages to avoid rate limiting
        if (i < session.mediaUrls.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      return firstMessage!;
    }
  }

  private async sendSingleMedia(
    bot: TelegramBot,
    channelId: number,
    session: BroadcastSession,
    caption?: string,
  ): Promise<TelegramBot.Message> {
    if (!session.mediaUrls || session.mediaUrls.length === 0) {
      throw new Error("No media URL found for single media");
    }

    const mediaUrl = session.mediaUrls[0];

    // Send based on message type
    switch (session.messageType) {
      case MessageType.PHOTO:
        return await bot.sendPhoto(channelId, mediaUrl, { caption });

      case MessageType.VIDEO:
        return await bot.sendVideo(channelId, mediaUrl, { caption });

      case MessageType.DOCUMENT:
        return await bot.sendDocument(channelId, mediaUrl, { caption });

      case MessageType.AUDIO:
        return await bot.sendAudio(channelId, mediaUrl, { caption });

      case MessageType.GIF:
        return await bot.sendAnimation(channelId, mediaUrl, { caption });

      case MessageType.STICKER:
        return await bot.sendSticker(channelId, mediaUrl);

      default:
        // Fallback to photo for unknown types
        return await bot.sendPhoto(channelId, mediaUrl, { caption });
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
