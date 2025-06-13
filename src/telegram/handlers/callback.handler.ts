import { Injectable, Logger } from "@nestjs/common";
import * as TelegramBot from "node-telegram-bot-api";
import { Language } from "@prisma/client";
import { UserManagementService } from "../services/user-management.service";
import { ChannelManagementService } from "../services/channel-management.service";
import { TelegramApiService } from "../services/telegram-api.service";
import { SubscriptionService } from "../../stripe/subscription.service";
import { I18nService } from "../services/i18n.service";
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
    private subscriptionService: SubscriptionService,
    private i18nService: I18nService,
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

      // Get user language for error message
      const userLanguage = await this.i18nService.getUserLanguage(
        telegramUser.id.toString(),
      );
      const messages = this.i18nService.getMessages(userLanguage);

      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        messages.messages.errors.generalError,
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

      case "upgrade_premium":
        await this.handleUpgradePremium(bot, context);
        break;

      case "cancel_subscription_flow":
        await this.handleCancelSubscriptionFlow(bot, context);
        break;

      case "confirm_cancel_subscription":
        await this.handleConfirmCancelSubscription(bot, context);
        break;

      case "keep_subscription":
        await this.handleKeepSubscription(bot, context);
        break;

      case "back_to_menu":
        await this.commandHandler.showMainMenu(
          bot,
          context.chatId,
          context.telegramUser.id.toString(),
        );
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
    if (data.startsWith("lang_")) {
      const languageCode = data.replace("lang_", "");
      if (languageCode === "ENGLISH" || languageCode === "RUSSIAN") {
        await this.commandHandler.handleLanguageChange(
          bot,
          context.chatId,
          context.telegramUser.id.toString(),
          languageCode as Language,
        );
      } else {
        this.logger.error("Invalid language code:", languageCode);
      }
    } else if (data.startsWith("manage_channel_")) {
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

      const userLanguage = await this.i18nService.getUserLanguage(
        context.telegramUser.id.toString(),
      );
      const messages = this.i18nService.getMessages(userLanguage);

      await this.telegramApiService.sendMessage(
        bot,
        context.chatId,
        messages.messages.errors.generalError,
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
      const userLanguage = await this.i18nService.getUserLanguage(
        telegramUser.id.toString(),
      );
      const messages = this.i18nService.getMessages(userLanguage);

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

      const channel = await this.channelManagementService.findChannelById(
        channelId,
        user.id,
      );
      if (!channel) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          messages.messages.errors.generalError,
        );
        return;
      }

      const managementMessage = `${messages.messages.channelManagement.title}

📺 ${channel.title}
${messages.messages.channelManagement.type} ${this.channelManagementService.getChannelTypeDisplay(channel.type, messages)}
${messages.messages.channelManagement.members} ${channel.memberCount || messages.messages.channelManagement.unknown}
${messages.messages.channelManagement.username} ${channel.username ? `@${channel.username}` : messages.messages.channelManagement.none}
${messages.messages.channelManagement.added} ${channel.createdAt.toDateString()}
${channel.canPost ? messages.messages.channelManagement.canPost : messages.messages.channelManagement.limitedPermissions}
${channel.isActive ? messages.messages.channelManagement.active : messages.messages.channelManagement.inactive}`;

      const keyboard = [
        [
          {
            text: channel.isActive
              ? messages.messages.channelManagement.deactivate
              : messages.messages.channelManagement.activate,
            callback_data: `toggle_channel_${channelId}`,
          },
          {
            text: messages.messages.channelManagement.remove,
            callback_data: `remove_channel_${channelId}`,
          },
        ],
        [
          {
            text: messages.messages.channelManagement.refreshInfo,
            callback_data: `refresh_channel_${channelId}`,
          },
        ],
        [
          {
            text: messages.messages.channelManagement.backToChannels,
            callback_data: "channels_list",
          },
        ],
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
      const userLanguage = await this.i18nService.getUserLanguage(
        telegramUser.id.toString(),
      );
      const messages = this.i18nService.getMessages(userLanguage);

      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        messages.messages.errors.generalError,
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
      const userLanguage = await this.i18nService.getUserLanguage(
        telegramUser.id.toString(),
      );
      const messages = this.i18nService.getMessages(userLanguage);

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

      const channel = await this.channelManagementService.findChannelById(
        channelId,
        user.id,
      );
      if (!channel) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          messages.messages.errors.generalError,
        );
        return;
      }

      const updatedChannel =
        await this.channelManagementService.toggleChannelStatus(channelId);

      const statusMessage = updatedChannel.isActive
        ? messages.messages.channelManagement.activated(channel.title)
        : messages.messages.channelManagement.deactivated(channel.title);

      const keyboard = [
        [
          {
            text: messages.messages.channelManagement.backToChannels,
            callback_data: "channels_list",
          },
        ],
      ];

      await this.telegramApiService.sendMessage(bot, chatId, statusMessage, {
        reply_markup: this.telegramApiService.createInlineKeyboard(keyboard),
      });
    } catch (error) {
      this.logger.error("Error toggling channel:", error);
      const userLanguage = await this.i18nService.getUserLanguage(
        telegramUser.id.toString(),
      );
      const messages = this.i18nService.getMessages(userLanguage);

      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        messages.messages.errors.generalError,
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
      const userLanguage = await this.i18nService.getUserLanguage(
        telegramUser.id.toString(),
      );
      const messages = this.i18nService.getMessages(userLanguage);

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

      const channel = await this.channelManagementService.findChannelById(
        channelId,
        user.id,
      );
      if (!channel) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          messages.messages.errors.generalError,
        );
        return;
      }

      const confirmMessage = `${messages.messages.channelManagement.removeTitle}

${messages.messages.channelManagement.removeConfirmation}

📺 ${channel.title}
${messages.messages.channelManagement.type} ${this.channelManagementService.getChannelTypeDisplay(channel.type, messages)}
${messages.messages.channelManagement.username} ${channel.username ? `@${channel.username}` : messages.messages.channelManagement.none}

${messages.messages.channelManagement.removeWarning}`;

      const keyboard = [
        [
          {
            text: messages.messages.channelManagement.yesRemove,
            callback_data: `confirm_remove_${channelId}`,
          },
          {
            text: messages.messages.channelManagement.cancel,
            callback_data: `manage_channel_${channelId}`,
          },
        ],
        [
          {
            text: messages.messages.channelManagement.backToChannels,
            callback_data: "channels_list",
          },
        ],
      ];

      await this.telegramApiService.sendMessage(bot, chatId, confirmMessage, {
        reply_markup: this.telegramApiService.createInlineKeyboard(keyboard),
      });
    } catch (error) {
      this.logger.error("Error in remove channel:", error);
      const userLanguage = await this.i18nService.getUserLanguage(
        telegramUser.id.toString(),
      );
      const messages = this.i18nService.getMessages(userLanguage);

      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        messages.messages.errors.generalError,
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
      const userLanguage = await this.i18nService.getUserLanguage(
        telegramUser.id.toString(),
      );
      const messages = this.i18nService.getMessages(userLanguage);

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

      const channel = await this.channelManagementService.findChannelById(
        channelId,
        user.id,
      );
      if (!channel) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          messages.messages.errors.generalError,
        );
        return;
      }

      await this.channelManagementService.deleteChannel(channelId);

      const successMessage = `${messages.messages.channelManagement.removed}

"${channel.title}" has been successfully removed from your broadcast list.

You can add it back anytime by adding the bot to the channel again or using the manual addition method.`;

      const keyboard = [
        [{ text: messages.buttons.addChannel, callback_data: "add_channel" }],
        [{ text: messages.buttons.myChannels, callback_data: "channels_list" }],
      ];

      await this.telegramApiService.sendMessage(bot, chatId, successMessage, {
        reply_markup: this.telegramApiService.createInlineKeyboard(keyboard),
      });
    } catch (error) {
      this.logger.error("Error confirming channel removal:", error);
      const userLanguage = await this.i18nService.getUserLanguage(
        telegramUser.id.toString(),
      );
      const messages = this.i18nService.getMessages(userLanguage);

      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        messages.messages.errors.generalError,
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
      const userLanguage = await this.i18nService.getUserLanguage(
        telegramUser.id.toString(),
      );
      const messages = this.i18nService.getMessages(userLanguage);

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

      const channel = await this.channelManagementService.findChannelById(
        channelId,
        user.id,
      );
      if (!channel) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          messages.messages.errors.generalError,
        );
        return;
      }

      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        messages.messages.channelManagement.refreshing,
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

        const refreshMessage = `${messages.messages.channelManagement.updated}

📺 ${updatedChannel.title}
${messages.messages.channelManagement.type} ${this.channelManagementService.getChannelTypeDisplay(updatedChannel.type, messages)}
${messages.messages.channelManagement.members} ${updatedChannel.memberCount || messages.messages.channelManagement.unknown}
${messages.messages.channelManagement.username} ${updatedChannel.username ? `@${updatedChannel.username}` : messages.messages.channelManagement.none}
${updatedChannel.canPost ? messages.messages.channelManagement.canPost : messages.messages.channelManagement.limitedPermissions}
${updatedChannel.isActive ? messages.messages.channelManagement.active : messages.messages.channelManagement.inactive}`;

        const keyboard = [
          [
            {
              text: messages.messages.channelManagement.manage,
              callback_data: `manage_channel_${channelId}`,
            },
          ],
          [
            {
              text: messages.messages.channelManagement.backToChannels,
              callback_data: "channels_list",
            },
          ],
        ];

        await this.telegramApiService.sendMessage(bot, chatId, refreshMessage, {
          reply_markup: this.telegramApiService.createInlineKeyboard(keyboard),
        });
      } catch (telegramError) {
        this.logger.error(
          "Error fetching channel info from Telegram:",
          telegramError,
        );
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          messages.messages.errors.generalError,
        );
      }
    } catch (error) {
      this.logger.error("Error refreshing channel:", error);
      const userLanguage = await this.i18nService.getUserLanguage(
        telegramUser.id.toString(),
      );
      const messages = this.i18nService.getMessages(userLanguage);

      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        messages.messages.errors.generalError,
      );
    }
  }

  private async handleUpgradePremium(
    bot: TelegramBot,
    context: TelegramHandlerContext,
  ): Promise<void> {
    const { chatId, telegramUser } = context;

    try {
      const userLanguage = await this.i18nService.getUserLanguage(
        telegramUser.id.toString(),
      );
      const messages = this.i18nService.getMessages(userLanguage);

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

      const subscription =
        await this.subscriptionService.getUserSubscriptionInfo(user.id);

      if (subscription && subscription.subscriptionStatus === "ACTIVE") {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          messages.messages.subscription.alreadyActive,
        );
        return;
      }

      const upgradeMessage = `${messages.messages.subscription.upgradeMessage}

${messages.messages.subscription.readyToSupercharge}

${messages.messages.subscription.whatYouGet}
${messages.messages.subscription.unlimitedMessagesAcross}
${messages.messages.subscription.priorityCustomerSupport}
${messages.messages.subscription.advancedSchedulingFeatures}`;

      // Create dynamic checkout session
      const baseUrl = process.env.BASE_URL || "http://localhost:3000";
      const successUrl = `${baseUrl}/stripe/success?session_id={CHECKOUT_SESSION_ID}&user_id=${user.id}`;
      const cancelUrl = `${baseUrl}/stripe/cancel`;

      // Use user's email or a placeholder - you might want to collect this from the user
      const userEmail = user.email || `${telegramUser.id}@telegram.user`;

      const checkoutUrl = await this.subscriptionService.createCheckoutSession(
        user.id,
        userEmail,
        successUrl,
        cancelUrl,
      );

      const keyboard = [
        [
          {
            text: messages.messages.subscription.payWithStripe,
            url: checkoutUrl,
          },
        ],
        [
          {
            text: messages.buttons.back,
            callback_data: "back_to_menu",
          },
        ],
      ];

      await this.telegramApiService.sendMessage(bot, chatId, upgradeMessage, {
        reply_markup: this.telegramApiService.createInlineKeyboard(keyboard),
      });
    } catch (error) {
      this.logger.error("Error in upgrade premium:", error);
      const userLanguage = await this.i18nService.getUserLanguage(
        telegramUser.id.toString(),
      );
      const messages = this.i18nService.getMessages(userLanguage);

      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        messages.messages.errors.generalError,
      );
    }
  }

  private async handleCancelSubscriptionFlow(
    bot: TelegramBot,
    context: TelegramHandlerContext,
  ): Promise<void> {
    const { chatId } = context;

    await this.telegramApiService.sendMessage(
      bot,
      chatId,
      "Subscription cancellation is not implemented yet. Please contact support.",
    );
  }

  private async handleConfirmCancelSubscription(
    bot: TelegramBot,
    context: TelegramHandlerContext,
  ): Promise<void> {
    const { chatId, telegramUser } = context;

    try {
      const userLanguage = await this.i18nService.getUserLanguage(
        telegramUser.id.toString(),
      );
      const messages = this.i18nService.getMessages(userLanguage);

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

      const subscription =
        await this.subscriptionService.getUserSubscriptionInfo(user.id);

      if (!subscription || subscription.subscriptionStatus !== "ACTIVE") {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          messages.messages.subscription.noPremiumToCancel,
        );
        return;
      }

      // Cancel the subscription
      await this.subscriptionService.cancelSubscription(user.id);

      const cancelMessage = `${messages.messages.subscription.subscriptionCancelled}

${messages.messages.subscription.cancelledMessage}

${messages.messages.subscription.returnToFreePlan}
${messages.messages.subscription.freeMessages}`;

      const keyboard = [
        [
          {
            text: messages.buttons.back,
            callback_data: "back_to_menu",
          },
        ],
      ];

      await this.telegramApiService.sendMessage(bot, chatId, cancelMessage, {
        reply_markup: this.telegramApiService.createInlineKeyboard(keyboard),
      });
    } catch (error) {
      this.logger.error("Error cancelling subscription:", error);
      const userLanguage = await this.i18nService.getUserLanguage(
        telegramUser.id.toString(),
      );
      const messages = this.i18nService.getMessages(userLanguage);

      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        messages.messages.errors.generalError,
      );
    }
  }

  private async handleKeepSubscription(
    bot: TelegramBot,
    context: TelegramHandlerContext,
  ): Promise<void> {
    const { chatId, telegramUser } = context;

    try {
      const userLanguage = await this.i18nService.getUserLanguage(
        telegramUser.id.toString(),
      );
      const messages = this.i18nService.getMessages(userLanguage);

      const keepMessage = messages.messages.subscription.keepChoice;

      const keyboard = [
        [
          {
            text: messages.buttons.back,
            callback_data: "back_to_menu",
          },
        ],
      ];

      await this.telegramApiService.sendMessage(bot, chatId, keepMessage, {
        reply_markup: this.telegramApiService.createInlineKeyboard(keyboard),
      });
    } catch (error) {
      this.logger.error("Error in keep subscription:", error);
      const userLanguage = await this.i18nService.getUserLanguage(
        telegramUser.id.toString(),
      );
      const messages = this.i18nService.getMessages(userLanguage);

      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        messages.messages.errors.generalError,
      );
    }
  }
}
