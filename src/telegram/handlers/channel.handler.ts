import { Injectable, Logger } from "@nestjs/common";
import * as TelegramBot from "node-telegram-bot-api";
import { Channel, ChannelType } from "@prisma/client";
import { UserManagementService } from "../services/user-management.service";
import { ChannelManagementService } from "../services/channel-management.service";
import { TelegramApiService } from "../services/telegram-api.service";
import { TelegramHandlerContext, TelegramUserWithChannels, TelegramAccount } from "../types/telegram.types";

@Injectable()
export class ChannelHandler {
  private readonly logger = new Logger(ChannelHandler.name);

  constructor(
    private userManagementService: UserManagementService,
    private channelManagementService: ChannelManagementService,
    private telegramApiService: TelegramApiService,
  ) {}

  async handleChannelsList(bot: TelegramBot, context: TelegramHandlerContext): Promise<void> {
    const { chatId, telegramUser } = context;

    try {
      const user = await this.userManagementService.findUserByTelegramId(telegramUser.id.toString());
      if (!user) {
        await this.telegramApiService.sendMessage(bot, chatId, "❌ User not found. Please use /start to create an account.");
        return;
      }

      const channels = await this.channelManagementService.getUserChannels(user.id);

      if (channels.length === 0) {
        await this.showNoChannelsMessage(bot, chatId);
        return;
      }

      const channelsList = this.channelManagementService.formatChannelsList(channels);
      const channelsMessage = `📋 My Channels (${channels.length})

${channelsList}

Legend:
✅ - Active and ready to broadcast
⚠️ - Active but limited permissions
🔴 - Inactive (won't receive broadcasts)

Use the buttons below to manage your channels.`;

      // Create inline keyboard for channel management
      const keyboard = this.createChannelManagementKeyboard(channels);

      await this.telegramApiService.sendMessage(bot, chatId, channelsMessage, {
        reply_markup: this.telegramApiService.createInlineKeyboard(keyboard),
      });

    } catch (error) {
      this.logger.error("Error fetching channels list:", error);
      await this.telegramApiService.sendMessage(bot, chatId, "❌ Error fetching your channels. Please try again.");
    }
  }

  async handleAddChannelCommand(bot: TelegramBot, context: TelegramHandlerContext): Promise<void> {
    const { chatId } = context;

    const instructionsMessage = `➕ Add Channel/Group

Method 1: Auto-Detection (Recommended)
1. Add this bot to your channel/group
2. Make sure the bot has admin permissions
3. The bot will automatically detect and add the channel

Method 2: Manual Addition
Send me the channel username in this format:
@channelname

Examples:
• @mychannel - for public channels
• @mygroup - for public groups

Note: For private channels/groups, use Method 1 (auto-detection) by adding the bot directly.`;

    const keyboard = [
      [{ text: "📋 My Channels", callback_data: "channels_list" }],
    ];

    await this.telegramApiService.sendMessage(bot, chatId, instructionsMessage, {
      reply_markup: this.telegramApiService.createInlineKeyboard(keyboard),
    });
  }

  async handleChannelUsernameInput(bot: TelegramBot, context: TelegramHandlerContext, username: string): Promise<void> {
    const { chatId, telegramUser } = context;

    try {
      const user = await this.userManagementService.findUserByTelegramId(telegramUser.id.toString());
      if (!user) {
        await this.telegramApiService.sendMessage(bot, chatId, "❌ User not found. Please use /start to create an account.");
        return;
      }

      await this.telegramApiService.sendMessage(bot, chatId, "🔍 Checking channel... Please wait.");

      // Try to get chat info
      let chat: TelegramBot.Chat;
      try {
        chat = await this.telegramApiService.getChatInfo(bot, `@${username}`);
      } catch (error) {
        await this.telegramApiService.sendMessage(bot, chatId, `❌ Channel @${username} not found or not accessible. Make sure:
• The channel is public
• The username is correct
• The bot has access to the channel`);
        return;
      }

      // Check if channel already exists
      const existingChannel = await this.channelManagementService.findChannelByPlatformId(chat.id.toString(), user.id);

      if (existingChannel) {
        await this.telegramApiService.sendMessage(bot, chatId, `✅ Channel "${chat.title}" is already in your list!`);
        return;
      }

      // Check bot permissions
      const { isAdmin, canPost } = await this.telegramApiService.getBotPermissions(bot, chat.id);

      if (!isAdmin) {
        await this.telegramApiService.sendMessage(bot, chatId, `⚠️ Found channel "${chat.title}", but the bot is not an admin.

Please add the bot as an administrator to this channel, then try again.`);
        return;
      }

      // Get additional info
      const memberCount = await this.telegramApiService.getChatMemberCount(bot, chat.id);

      // Create channel record
      const channelType = this.channelManagementService.getChannelType(chat.type);
      const channel = await this.channelManagementService.createChannel({
        userId: user.id,
        platformId: chat.id.toString(),
        title: chat.title || username,
        type: channelType,
        username: chat.username,
        description: chat.description,
        memberCount,
        canPost,
        metadata: {
          chatType: chat.type,
          inviteLink: chat.invite_link,
        },
      });

      const successMessage = `✅ Channel Added Successfully!

📺 ${channel.title}
🆔 Type: ${this.channelManagementService.getChannelTypeDisplay(channelType)}
👥 Members: ${memberCount || 'Unknown'}
🔗 Username: @${username}
${canPost ? '✅ Ready for broadcasting' : '⚠️ Limited posting permissions'}

You can now send messages to this channel!`;

      const keyboard = [
        [{ text: "📋 View All Channels", callback_data: "channels_list" }],
        [{ text: "📢 Send Message", callback_data: "send_message" }],
      ];

      await this.telegramApiService.sendMessage(bot, chatId, successMessage, {
        reply_markup: this.telegramApiService.createInlineKeyboard(keyboard),
      });

    } catch (error) {
      this.logger.error("Error adding channel by username:", error);
      await this.telegramApiService.sendMessage(bot, chatId, "❌ An error occurred while adding the channel. Please try again.");
    }
  }

  async handleBotAddedToChannel(bot: TelegramBot, chat: TelegramBot.Chat, addedBy: TelegramBot.User): Promise<void> {
    try {
      // Find the user who added the bot
      const user = await this.userManagementService.findUserByTelegramId(addedBy.id.toString());
      if (!user) {
        this.logger.warn(`Bot added by unknown user: ${addedBy.id}`);
        return;
      }

      // Check if channel already exists or reactivate
      const wasReactivated = await this.channelManagementService.reactivateChannelIfExists(chat.id.toString(), user.id);
      if (wasReactivated) {
        return;
      }

      // Check if channel already exists
      const existingChannel = await this.channelManagementService.findChannelByPlatformId(chat.id.toString(), user.id);
      if (existingChannel) {
        return;
      }

      // Get additional channel info
      const memberCount = await this.telegramApiService.getChatMemberCount(bot, chat.id);
      const channelType = this.channelManagementService.getChannelType(chat.type);

      // Create new channel record
      const channel = await this.channelManagementService.createChannel({
        userId: user.id,
        platformId: chat.id.toString(),
        title: chat.title || `${chat.first_name} ${chat.last_name || ''}`.trim() || 'Private Chat',
        type: channelType,
        username: chat.username,
        description: chat.description,
        memberCount,
        metadata: {
          chatType: chat.type,
          inviteLink: chat.invite_link,
        },
      });

      // Send confirmation to user's private chat
      await this.sendChannelAddedConfirmation(bot, user, channel, channelType, memberCount, chat);

    } catch (error) {
      this.logger.error("Error handling bot added to channel:", error);
    }
  }

  private async showNoChannelsMessage(bot: TelegramBot, chatId: number): Promise<void> {
    const noChannelsMessage = `📋 My Channels

You haven't connected any channels yet!

How to add channels:
1. Add this bot to your channel/group as an admin
2. Or use /add_channel and send the channel username
3. Or click "➕ Add Channel" button below

The bot will automatically detect when you add it to channels.`;

    const keyboard = [
      [{ text: "➕ Add Channel", callback_data: "add_channel" }],
    ];

    await this.telegramApiService.sendMessage(bot, chatId, noChannelsMessage, {
      reply_markup: this.telegramApiService.createInlineKeyboard(keyboard),
    });
  }

  private createChannelManagementKeyboard(channels: Channel[]): TelegramBot.InlineKeyboardButton[][] {
    const keyboard = [];
    
    // Add channel management buttons in rows of 2
    for (let i = 0; i < channels.length; i += 2) {
      const row = [];
      const title1 = channels[i].title.length > 15 ? channels[i].title.substring(0, 15) + "..." : channels[i].title;
      row.push({ text: `⚙️ ${title1}`, callback_data: `manage_channel_${channels[i].id}` });
      if (channels[i + 1]) {
        const title2 = channels[i + 1].title.length > 15 ? channels[i + 1].title.substring(0, 15) + "..." : channels[i + 1].title;
        row.push({ text: `⚙️ ${title2}`, callback_data: `manage_channel_${channels[i + 1].id}` });
      }
      keyboard.push(row);
    }

    // Add action buttons
    keyboard.push([
      { text: "➕ Add Channel", callback_data: "add_channel" },
      { text: "🔄 Refresh", callback_data: "refresh_channels" }
    ]);


    return keyboard;
  }

  private async sendChannelAddedConfirmation(
    bot: TelegramBot,
    user: TelegramUserWithChannels,
    channel: Channel,
    channelType: ChannelType,
    memberCount: number | undefined,
    chat: TelegramBot.Chat
  ): Promise<void> {
    const confirmationMessage = `✅ Channel Connected Successfully!

📺 ${channel.title}
🆔 Type: ${this.channelManagementService.getChannelTypeDisplay(channelType)}
👥 Members: ${memberCount || 'Unknown'}
🔗 Username: ${chat.username ? `@${chat.username}` : 'None'}

Your channel has been added to your broadcast list. You can now send messages to this channel using the bot!

Use /channels to manage all your connected channels.`;

    // Try to send to user's private chat
    try {
      const userAccount = user.accounts.find((acc: TelegramAccount) => acc.platform === 'TELEGRAM');
      if (userAccount) {
        await this.telegramApiService.sendMessage(bot, parseInt(userAccount.platformId), confirmationMessage);
      }
    } catch (error) {
      this.logger.warn(`Could not send confirmation to user ${user.id}: ${error.message}`);
    }
  }
} 