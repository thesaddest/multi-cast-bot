import { Injectable, Logger } from "@nestjs/common";
import * as TelegramBot from "node-telegram-bot-api";
import { Channel, ChannelType } from "@prisma/client";
import { UserManagementService } from "../services/user-management.service";
import { ChannelManagementService } from "../services/channel-management.service";
import { TelegramApiService } from "../services/telegram-api.service";
import { I18nService } from "../services/i18n.service";
import {
  TelegramHandlerContext,
  TelegramUserWithChannels,
  TelegramAccount,
} from "../types/telegram.types";

@Injectable()
export class ChannelHandler {
  private readonly logger = new Logger(ChannelHandler.name);

  constructor(
    private userManagementService: UserManagementService,
    private channelManagementService: ChannelManagementService,
    private telegramApiService: TelegramApiService,
    private i18nService: I18nService,
  ) {}

  async handleChannelsList(
    bot: TelegramBot,
    context: TelegramHandlerContext,
  ): Promise<void> {
    const { chatId, telegramUser } = context;

    try {
      const messages = await this.i18nService.getUserMessages(telegramUser.id.toString());
      const user = await this.userManagementService.findUserByTelegramId(
        telegramUser.id.toString(),
      );
      if (!user) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          messages.messages.errors.userNotFound,
        );
        return;
      }

      const channels = await this.channelManagementService.getUserChannels(
        user.id,
      );

      if (channels.length === 0) {
        await this.showNoChannelsMessage(bot, chatId, telegramUser.id.toString());
        return;
      }

      const channelsList =
        this.channelManagementService.formatChannelsList(channels, messages);
      const channelsMessage = `${messages.messages.channels.title(channels.length)}

${channelsList}

${messages.messages.channels.legend.title}
${messages.messages.channels.legend.active}
${messages.messages.channels.legend.limited}
${messages.messages.channels.legend.inactive}

${messages.messages.channels.management}`;

      // Create inline keyboard for channel management
      const keyboard = this.createChannelManagementKeyboard(channels, messages);

      await this.telegramApiService.sendMessage(bot, chatId, channelsMessage, {
        reply_markup: this.telegramApiService.createInlineKeyboard(keyboard),
      });
    } catch (error) {
      this.logger.error("Error fetching channels list:", error);
      const messages = await this.i18nService.getUserMessages(telegramUser.id.toString());
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        messages.messages.errors.generalError,
      );
    }
  }

  async handleAddChannelCommand(
    bot: TelegramBot,
    context: TelegramHandlerContext,
  ): Promise<void> {
    const { chatId, telegramUser } = context;
    const messages = await this.i18nService.getUserMessages(telegramUser.id.toString());

    const instructionsMessage = `${messages.buttons.addChannel}

${messages.messages.channels.addInstructions.method1Title}
1. ${messages.messages.channels.addInstructions.method1Step1}
2. ${messages.messages.channels.addInstructions.method1Step2}
3. ${messages.messages.channels.addInstructions.method1Step3}

${messages.messages.channels.addInstructions.method2Title}
${messages.messages.channels.addInstructions.method2Format}

${messages.messages.channels.addInstructions.examples}
• ${messages.messages.channels.addInstructions.exampleChannel}
• ${messages.messages.channels.addInstructions.exampleGroup}

${messages.messages.channels.addInstructions.note}`;

    const keyboard = [
      [{ text: messages.buttons.myChannels, callback_data: "channels_list" }],
    ];

    await this.telegramApiService.sendMessage(
      bot,
      chatId,
      instructionsMessage,
      {
        reply_markup: this.telegramApiService.createInlineKeyboard(keyboard),
      },
    );
  }

  async handleChannelUsernameInput(
    bot: TelegramBot,
    context: TelegramHandlerContext,
    username: string,
  ): Promise<void> {
    const { chatId, telegramUser } = context;

    try {
      const user = await this.userManagementService.findUserByTelegramId(
        telegramUser.id.toString(),
      );
      if (!user) {
        const messages = await this.i18nService.getUserMessages(telegramUser.id.toString());
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          messages.messages.errors.userNotFound,
        );
        return;
      }

      const messages = await this.i18nService.getUserMessages(telegramUser.id.toString());
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        messages.messages.channels.checking,
      );

      // Try to get chat info
      let chat: TelegramBot.Chat;
      try {
        chat = await this.telegramApiService.getChatInfo(bot, `@${username}`);
      } catch (error) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          `${messages.messages.channelAddition.notFoundError(username)}
• ${messages.messages.channelAddition.channelPublic}
• ${messages.messages.channelAddition.usernameCorrect}
• ${messages.messages.channelAddition.botHasAccess}`,
        );
        return;
      }

      // Check if channel already exists
      const existingChannel =
        await this.channelManagementService.findChannelByPlatformId(
          chat.id.toString(),
          user.id,
        );

      if (existingChannel) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          messages.messages.channelAddition.alreadyInList(chat.title || username),
        );
        return;
      }

      // Check bot permissions
      const { isAdmin, canPost } =
        await this.telegramApiService.getBotPermissions(bot, chat.id);

      if (!isAdmin) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          `${messages.messages.channelAddition.foundButNotAdmin(chat.title || username)}

${messages.messages.channelAddition.addAsAdmin}`,
        );
        return;
      }

      // Get additional info
      const memberCount = await this.telegramApiService.getChatMemberCount(
        bot,
        chat.id,
      );

      // Create channel record
      const channelType = this.channelManagementService.getChannelType(
        chat.type,
      );
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

      const successMessage = `${messages.messages.channels.addedSuccessfully}

📺 ${channel.title}
${messages.messages.channels.channelInfo.type} ${this.channelManagementService.getChannelTypeDisplay(channelType, messages)}
${messages.messages.channels.channelInfo.members} ${memberCount || "Unknown"}
${messages.messages.channels.channelInfo.username} @${username}
${canPost ? messages.messages.channels.channelInfo.readyForBroadcasting : "⚠️ Limited posting permissions"}

${messages.messages.channels.channelInfo.canSendMessages}`;

      const keyboard = [
        [{ text: messages.messages.channels.viewAll, callback_data: "channels_list" }],
      ];

      await this.telegramApiService.sendMessage(bot, chatId, successMessage, {
        reply_markup: this.telegramApiService.createInlineKeyboard(keyboard),
      });
    } catch (error) {
      this.logger.error("Error adding channel by username:", error);
      const messages = await this.i18nService.getUserMessages(telegramUser.id.toString());
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        messages.messages.errors.generalError,
      );
    }
  }

  async handleBotAddedToChannel(
    bot: TelegramBot,
    chat: TelegramBot.Chat,
    addedBy: TelegramBot.User,
  ): Promise<void> {
    try {
      // Find the user who added the bot
      const user = await this.userManagementService.findUserByTelegramId(
        addedBy.id.toString(),
      );
      if (!user) {
        this.logger.warn(`Bot added by unknown user: ${addedBy.id}`);
        return;
      }

      // Check if channel already exists or reactivate
      const wasReactivated =
        await this.channelManagementService.reactivateChannelIfExists(
          chat.id.toString(),
          user.id,
        );
      if (wasReactivated) {
        return;
      }

      // Check if channel already exists
      const existingChannel =
        await this.channelManagementService.findChannelByPlatformId(
          chat.id.toString(),
          user.id,
        );
      if (existingChannel) {
        return;
      }

      // Get additional channel info
      const memberCount = await this.telegramApiService.getChatMemberCount(
        bot,
        chat.id,
      );
      const channelType = this.channelManagementService.getChannelType(
        chat.type,
      );

      // Create new channel record
      const channel = await this.channelManagementService.createChannel({
        userId: user.id,
        platformId: chat.id.toString(),
        title:
          chat.title ||
          `${chat.first_name} ${chat.last_name || ""}`.trim() ||
          "Private Chat",
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
      await this.sendChannelAddedConfirmation(
        bot,
        user,
        channel,
        channelType,
        memberCount,
        chat,
      );
    } catch (error) {
      this.logger.error("Error handling bot added to channel:", error);
    }
  }

  private async showNoChannelsMessage(
    bot: TelegramBot,
    chatId: number,
    telegramUserId: string,
  ): Promise<void> {
    const messages = await this.i18nService.getUserMessages(telegramUserId);
    const noChannelsMessage = `${messages.messages.channels.title()}

${messages.messages.channels.noChannels}

${messages.messages.channels.howToAdd}
${messages.messages.channels.instructions}

${messages.messages.channels.autoDetect}`;

    const keyboard = [
      [{ text: messages.buttons.addChannel, callback_data: "add_channel" }],
    ];

    await this.telegramApiService.sendMessage(bot, chatId, noChannelsMessage, {
      reply_markup: this.telegramApiService.createInlineKeyboard(keyboard),
    });
  }

  private createChannelManagementKeyboard(
    channels: Channel[],
    messages: any,
  ): TelegramBot.InlineKeyboardButton[][] {
    const keyboard = [];

    // Add channel management buttons in rows of 2
    for (let i = 0; i < channels.length; i += 2) {
      const row = [];
      const title1 =
        channels[i].title.length > 15
          ? channels[i].title.substring(0, 15) + "..."
          : channels[i].title;
      row.push({
        text: `⚙️ ${title1}`,
        callback_data: `manage_channel_${channels[i].id}`,
      });
      if (channels[i + 1]) {
        const title2 =
          channels[i + 1].title.length > 15
            ? channels[i + 1].title.substring(0, 15) + "..."
            : channels[i + 1].title;
        row.push({
          text: `⚙️ ${title2}`,
          callback_data: `manage_channel_${channels[i + 1].id}`,
        });
      }
      keyboard.push(row);
    }

    // Add action buttons
    keyboard.push([
      { text: messages.buttons.addChannel, callback_data: "add_channel" },
      { text: `🔄 ${messages.messages.channels.refresh}`, callback_data: "refresh_channels" },
    ]);

    return keyboard;
  }

  private async sendChannelAddedConfirmation(
    bot: TelegramBot,
    user: TelegramUserWithChannels,
    channel: Channel,
    channelType: ChannelType,
    memberCount: number | undefined,
    chat: TelegramBot.Chat,
  ): Promise<void> {
    const confirmationMessage = `✅ Channel Connected Successfully!

📺 ${channel.title}
🆔 Type: ${this.channelManagementService.getChannelTypeDisplay(channelType)}
👥 Members: ${memberCount || "Unknown"}
🔗 Username: ${chat.username ? `@${chat.username}` : "None"}

Your channel has been added to your broadcast list. You can now send messages to this channel using the bot!

Use /channels to manage all your connected channels.`;

    // Try to send to user's private chat
    try {
      const userAccount = user.accounts.find(
        (acc: TelegramAccount) => acc.platform === "TELEGRAM",
      );
      if (userAccount) {
        await this.telegramApiService.sendMessage(
          bot,
          parseInt(userAccount.platformId),
          confirmationMessage,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Could not send confirmation to user ${user.id}: ${error.message}`,
      );
    }
  }
}
