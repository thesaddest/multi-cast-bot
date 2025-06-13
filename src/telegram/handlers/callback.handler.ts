import { Injectable, Logger } from "@nestjs/common";
import * as TelegramBot from "node-telegram-bot-api";
import { UserManagementService } from "../services/user-management.service";
import { ChannelManagementService } from "../services/channel-management.service";
import { TelegramApiService } from "../services/telegram-api.service";
import { CommandHandler } from "./command.handler";
import { ChannelHandler } from "./channel.handler";
import {
  TelegramHandlerContext,
  ChannelMetadata,
} from "../types/telegram.types";

@Injectable()
export class CallbackHandler {
  private readonly logger = new Logger(CallbackHandler.name);

  constructor(
    private userManagementService: UserManagementService,
    private channelManagementService: ChannelManagementService,
    private telegramApiService: TelegramApiService,
    private commandHandler: CommandHandler,
    private channelHandler: ChannelHandler,
  ) {}

  async handleCallbackQuery(
    bot: TelegramBot,
    callbackQuery: TelegramBot.CallbackQuery,
  ): Promise<void> {
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
    await this.telegramApiService.answerCallbackQuery(bot, callbackQuery.id);

    const context: TelegramHandlerContext = {
      chatId,
      telegramUser,
      callbackQuery,
    };

    try {
      await this.routeCallback(bot, context, data);
    } catch (error) {
      this.logger.error("Error handling callback query:", error);
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        "❌ An error occurred. Please try again.",
      );
    }
  }

  private async routeCallback(
    bot: TelegramBot,
    context: TelegramHandlerContext,
    data: string,
  ): Promise<void> {
    switch (data) {
      case "profile":
        await this.commandHandler.handleProfile(bot, context);
        break;

      case "channels_list":
        await this.channelHandler.handleChannelsList(bot, context);
        break;

      case "add_channel":
        await this.channelHandler.handleAddChannelCommand(bot, context);
        break;

      case "refresh_channels":
        await this.channelHandler.handleChannelsList(bot, context);
        break;

      default:
        await this.handleDynamicCallbacks(bot, context, data);
    }
  }

  private async handleDynamicCallbacks(
    bot: TelegramBot,
    context: TelegramHandlerContext,
    data: string,
  ): Promise<void> {
    if (data.startsWith("manage_channel_")) {
      const channelId = data.replace("manage_channel_", "");
      await this.handleChannelManagement(bot, context, channelId);
    } else if (data.startsWith("toggle_channel_")) {
      const channelId = data.replace("toggle_channel_", "");
      await this.handleToggleChannel(bot, context, channelId);
    } else if (data.startsWith("remove_channel_")) {
      const channelId = data.replace("remove_channel_", "");
      await this.handleRemoveChannel(bot, context, channelId);
    } else if (data.startsWith("refresh_channel_")) {
      const channelId = data.replace("refresh_channel_", "");
      await this.handleRefreshChannel(bot, context, channelId);
    } else if (data.startsWith("confirm_remove_")) {
      const channelId = data.replace("confirm_remove_", "");
      await this.handleConfirmRemoveChannel(bot, context, channelId);
    } else {
      this.logger.error("Unknown callback data:", data);
      await this.telegramApiService.sendMessage(
        bot,
        context.chatId,
        "❌ Unknown action",
      );
    }
  }

  private async handleChannelManagement(
    bot: TelegramBot,
    context: TelegramHandlerContext,
    channelId: string,
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
          "❌ User not found.",
        );
        return;
      }

      const channel = await this.channelManagementService.findChannelById(
        channelId,
        user.id,
      );
      if (!channel) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          "❌ Channel not found.",
        );
        return;
      }

      const managementMessage = `⚙️ Channel Management

📺 ${channel.title}
🆔 Type: ${this.channelManagementService.getChannelTypeDisplay(channel.type)}
👥 Members: ${channel.memberCount || "Unknown"}
🔗 Username: ${channel.username ? `@${channel.username}` : "None"}
📅 Added: ${channel.createdAt.toDateString()}
${channel.canPost ? "✅ Can post messages" : "⚠️ Limited permissions"}
${channel.isActive ? "🟢 Active" : "🔴 Inactive"}`;

      const keyboard = [
        [
          {
            text: channel.isActive ? "🔴 Deactivate" : "🟢 Activate",
            callback_data: `toggle_channel_${channelId}`,
          },
          { text: "🗑️ Remove", callback_data: `remove_channel_${channelId}` },
        ],
        [
          {
            text: "🔄 Refresh Info",
            callback_data: `refresh_channel_${channelId}`,
          },
        ],
        [{ text: "📋 Back to Channels", callback_data: "channels_list" }],
      ];

      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        managementMessage,
        {
          reply_markup: this.telegramApiService.createInlineKeyboard(keyboard),
        },
      );
    } catch (error) {
      this.logger.error("Error in channel management:", error);
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        "❌ Error managing channel.",
      );
    }
  }

  private async handleToggleChannel(
    bot: TelegramBot,
    context: TelegramHandlerContext,
    channelId: string,
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
          "❌ User not found.",
        );
        return;
      }

      const channel = await this.channelManagementService.findChannelById(
        channelId,
        user.id,
      );
      if (!channel) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          "❌ Channel not found.",
        );
        return;
      }

      const updatedChannel =
        await this.channelManagementService.toggleChannelStatus(channelId);

      const statusMessage = updatedChannel.isActive
        ? `✅ Channel "${channel.title}" has been activated and will receive broadcasts.`
        : `🔴 Channel "${channel.title}" has been deactivated and will not receive broadcasts.`;

      const keyboard = [
        [{ text: "📋 Back to Channels", callback_data: "channels_list" }],
      ];

      await this.telegramApiService.sendMessage(bot, chatId, statusMessage, {
        reply_markup: this.telegramApiService.createInlineKeyboard(keyboard),
      });
    } catch (error) {
      this.logger.error("Error toggling channel:", error);
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        "❌ Error updating channel status.",
      );
    }
  }

  private async handleRemoveChannel(
    bot: TelegramBot,
    context: TelegramHandlerContext,
    channelId: string,
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
          "❌ User not found.",
        );
        return;
      }

      const channel = await this.channelManagementService.findChannelById(
        channelId,
        user.id,
      );
      if (!channel) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          "❌ Channel not found.",
        );
        return;
      }

      const confirmMessage = `🗑️ Remove Channel

Are you sure you want to remove this channel?

📺 ${channel.title}
🆔 Type: ${this.channelManagementService.getChannelTypeDisplay(channel.type)}
🔗 Username: ${channel.username ? `@${channel.username}` : "None"}

⚠️ This action cannot be undone. You'll need to add the channel again if you want to use it for broadcasting.`;

      const keyboard = [
        [
          {
            text: "🗑️ Yes, Remove",
            callback_data: `confirm_remove_${channelId}`,
          },
          { text: "❌ Cancel", callback_data: `manage_channel_${channelId}` },
        ],
        [{ text: "📋 Back to Channels", callback_data: "channels_list" }],
      ];

      await this.telegramApiService.sendMessage(bot, chatId, confirmMessage, {
        reply_markup: this.telegramApiService.createInlineKeyboard(keyboard),
      });
    } catch (error) {
      this.logger.error("Error in remove channel:", error);
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        "❌ Error removing channel.",
      );
    }
  }

  private async handleConfirmRemoveChannel(
    bot: TelegramBot,
    context: TelegramHandlerContext,
    channelId: string,
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
          "❌ User not found.",
        );
        return;
      }

      const channel = await this.channelManagementService.findChannelById(
        channelId,
        user.id,
      );
      if (!channel) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          "❌ Channel not found.",
        );
        return;
      }

      await this.channelManagementService.deleteChannel(channelId);

      const successMessage = `✅ Channel Removed

"${channel.title}" has been successfully removed from your broadcast list.

You can add it back anytime by adding the bot to the channel again or using the manual addition method.`;

      const keyboard = [
        [{ text: "➕ Add Channel", callback_data: "add_channel" }],
        [{ text: "📋 My Channels", callback_data: "channels_list" }],
      ];

      await this.telegramApiService.sendMessage(bot, chatId, successMessage, {
        reply_markup: this.telegramApiService.createInlineKeyboard(keyboard),
      });
    } catch (error) {
      this.logger.error("Error confirming channel removal:", error);
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        "❌ Error removing channel.",
      );
    }
  }

  private async handleRefreshChannel(
    bot: TelegramBot,
    context: TelegramHandlerContext,
    channelId: string,
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
          "❌ User not found.",
        );
        return;
      }

      const channel = await this.channelManagementService.findChannelById(
        channelId,
        user.id,
      );
      if (!channel) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          "❌ Channel not found.",
        );
        return;
      }

      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        "🔄 Refreshing channel information...",
      );

      try {
        // Get updated channel info from Telegram
        const chat = await this.telegramApiService.getChatInfo(
          bot,
          parseInt(channel.platformId),
        );

        // Check bot permissions
        const { canPost } = await this.telegramApiService.getBotPermissions(
          bot,
          chat.id,
        );

        // Get member count
        const memberCount = await this.telegramApiService.getChatMemberCount(
          bot,
          chat.id,
        );

        // Update channel in database
        const existingMetadata = (channel.metadata as ChannelMetadata) || {};
        const updatedChannel =
          await this.channelManagementService.updateChannel(channelId, {
            title: chat.title || channel.title,
            username: chat.username,
            description: chat.description,
            memberCount,
            canPost,
            metadata: {
              ...existingMetadata,
              chatType: chat.type,
              inviteLink: chat.invite_link,
              lastUpdated: new Date().toISOString(),
            } as any, // Prisma Json type requires any
          });

        const refreshMessage = `🔄 Channel Information Updated

📺 ${updatedChannel.title}
🆔 Type: ${this.channelManagementService.getChannelTypeDisplay(updatedChannel.type)}
👥 Members: ${updatedChannel.memberCount || "Unknown"}
🔗 Username: ${updatedChannel.username ? `@${updatedChannel.username}` : "None"}
${updatedChannel.canPost ? "✅ Can post messages" : "⚠️ Limited permissions"}
${updatedChannel.isActive ? "🟢 Active" : "🔴 Inactive"}

Information has been refreshed successfully!`;

        const keyboard = [
          [
            {
              text: "⚙️ Manage Channel",
              callback_data: `manage_channel_${channelId}`,
            },
          ],
          [{ text: "📋 Back to Channels", callback_data: "channels_list" }],
        ];

        await this.telegramApiService.sendMessage(bot, chatId, refreshMessage, {
          reply_markup: this.telegramApiService.createInlineKeyboard(keyboard),
        });
      } catch (telegramError) {
        const keyboard = [
          [
            {
              text: "🗑️ Remove Channel",
              callback_data: `remove_channel_${channelId}`,
            },
          ],
          [{ text: "📋 Back to Channels", callback_data: "channels_list" }],
        ];

        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          `❌ Could not refresh channel information. The channel might be inaccessible or the bot might have been removed.

You may want to remove this channel and add it again.`,
          {
            reply_markup:
              this.telegramApiService.createInlineKeyboard(keyboard),
          },
        );
      }
    } catch (error) {
      this.logger.error("Error refreshing channel:", error);
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        "❌ Error refreshing channel information.",
      );
    }
  }
}
