import { Injectable, Logger } from "@nestjs/common";
import * as TelegramBot from "node-telegram-bot-api";
import { Language } from "@prisma/client";
import { UserManagementService } from "../services/user-management.service";
import { TelegramApiService } from "../services/telegram-api.service";
import { MessageService } from "../services/message.service";
import { SubscriptionService } from "../../stripe/subscription.service";
import { I18nService } from "../services/i18n.service";
import { TelegramHandlerContext } from "../types/telegram.types";

@Injectable()
export class CommandHandler {
  private readonly logger = new Logger(CommandHandler.name);

  constructor(
    private userManagementService: UserManagementService,
    private telegramApiService: TelegramApiService,
    private messageService: MessageService,
    private subscriptionService: SubscriptionService,
    private i18nService: I18nService,
  ) {}

  async handleStart(
    bot: TelegramBot,
    context: TelegramHandlerContext,
  ): Promise<void> {
    const { chatId, telegramUser } = context;

    if (!telegramUser) {
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        "❌ Unable to get user information",
      );
      return;
    }

    try {
      // Check if user already exists
      let user = await this.userManagementService.findUserByTelegramId(
        telegramUser.id.toString(),
      );

      if (user) {
        const messages = await this.i18nService.getUserMessages(
          telegramUser.id.toString(),
        );
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          messages.messages.welcomeBack(telegramUser.first_name),
        );
        await this.showMainMenu(bot, chatId, telegramUser.id.toString());
        return;
      }

      // Create new user
      user =
        await this.userManagementService.createUserWithTelegramAccount(
          telegramUser,
        );

      const messages = await this.i18nService.getUserMessages(
        telegramUser.id.toString(),
      );

      const welcomeMessage = `${messages.messages.welcome.title(telegramUser.first_name)}

${messages.messages.welcome.description(user.id)}

${messages.messages.welcome.features}`;

      await this.telegramApiService.sendMessage(bot, chatId, welcomeMessage);
      await this.showMainMenu(bot, chatId, telegramUser.id.toString());
    } catch (error) {
      this.logger.error("Error creating user:", error);
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        "❌ Sorry, there was an error setting up your account. Please try again later.",
      );
    }
  }

  async showMainMenu(
    bot: TelegramBot,
    chatId: number,
    telegramUserId?: string,
  ): Promise<void> {
    let messages;
    if (telegramUserId) {
      messages = await this.i18nService.getUserMessages(telegramUserId);
    } else {
      messages = this.i18nService.getMessages(Language.ENGLISH);
    }

    const menuMessage = `${messages.messages.mainMenu.title}

${messages.messages.mainMenu.description}`;

    const keyboard = this.telegramApiService.createReplyKeyboard(
      [
        [
          { text: messages.buttons.profile },
          { text: messages.buttons.subscription },
        ],
        [
          { text: messages.buttons.myChannels },
          { text: messages.buttons.addChannel },
        ],
        [
          { text: messages.buttons.sendMessage },
          { text: messages.buttons.messageHistory },
        ],
        [{ text: messages.buttons.changeLanguage }],
      ],
      {
        resize_keyboard: true,
        one_time_keyboard: false,
        is_persistent: true,
      },
    );

    await this.telegramApiService.sendMessage(bot, chatId, menuMessage, {
      reply_markup: keyboard,
    });
  }

  async handleProfile(
    bot: TelegramBot,
    context: TelegramHandlerContext,
  ): Promise<void> {
    const { chatId, telegramUser } = context;

    try {
      const messages = await this.i18nService.getUserMessages(
        telegramUser.id.toString(),
      );
      const user = await this.userManagementService.findUserWithStats(
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

      const platformList = user.accounts
        .map(
          (account) =>
            `• ${account.platform}: @${account.username || account.displayName}`,
        )
        .join("\n");

      // Get subscription info
      const subscriptionInfo =
        await this.subscriptionService.getUserSubscriptionInfo(user.id);

      const subscriptionText =
        subscriptionInfo.subscriptionPlan === "PREMIUM"
          ? messages.messages.profile.premiumActive
          : messages.messages.profile.freePlan(
              subscriptionInfo.freeMessagesRemaining,
            );

      const profileMessage = `${messages.messages.profile.title}

${messages.messages.profile.userId} ${user.id}
${messages.messages.profile.email} ${user.email || "Not set"}
${messages.messages.profile.username} ${user.username || "Not set"}
${messages.messages.profile.memberSince} ${user.createdAt.toDateString()}

${messages.messages.profile.subscription} ${subscriptionText}

${messages.messages.profile.connectedPlatforms(user.accounts.length)}
${platformList || "None"}

${messages.messages.profile.activeChannels} ${user.channels.length}
${messages.messages.profile.messagesSent} ${subscriptionInfo.totalMessages}
${messages.messages.profile.scheduledMessages} ${user._count?.messageQueue || 0}`;

      await this.telegramApiService.sendMessage(bot, chatId, profileMessage);
    } catch (error) {
      this.logger.error("Error fetching profile:", error);
      const messages = await this.i18nService.getUserMessages(
        telegramUser.id.toString(),
      );
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        messages.messages.errors.profileError,
      );
    }
  }

  async handleMessageHistory(
    bot: TelegramBot,
    context: TelegramHandlerContext,
  ): Promise<void> {
    const { chatId, telegramUser } = context;

    try {
      const i18nMessages = await this.i18nService.getUserMessages(
        telegramUser.id.toString(),
      );
      const user = await this.userManagementService.findUserByTelegramId(
        telegramUser.id.toString(),
      );
      if (!user) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          i18nMessages.messages.errors.userNotFound,
        );
        return;
      }

      const messages = await this.messageService.getMessagesByUser(user.id, 10);

      if (messages.length === 0) {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          `${i18nMessages.messages.messages.noMessages}\n\n${i18nMessages.messages.messages.noMessagesDescription}`,
        );
        return;
      }

      const messageList = messages
        .map((msg, index) => {
          const status = this.getStatusEmoji(msg.status, i18nMessages);
          const type = this.getMessageTypeEmoji(msg.messageType);
          const date = msg.sentAt
            ? msg.sentAt.toLocaleDateString()
            : msg.createdAt.toLocaleDateString();
          const content =
            msg.content.length > 50
              ? msg.content.substring(0, 50) + "..."
              : msg.content;
          const channelTitle =
            (msg as any).channel?.title ||
            i18nMessages.messages.general.unknown;

          return `${index + 1}. ${status} ${type} ${channelTitle}\n   "${content}"\n   📅 ${date}`;
        })
        .join("\n\n");

      const historyMessage = `${i18nMessages.messages.messages.historyLast(10)}

${messageList}

${i18nMessages.messages.general.messageHistoryLegend}

${i18nMessages.messages.general.detailedMessagesHint}`;

      await this.telegramApiService.sendMessage(bot, chatId, historyMessage);
    } catch (error) {
      this.logger.error("Error fetching message history:", error);
      const messages = await this.i18nService.getUserMessages(
        telegramUser.id.toString(),
      );
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        messages.messages.errors.generalError,
      );
    }
  }

  async handleLanguageSettings(
    bot: TelegramBot,
    context: TelegramHandlerContext,
  ): Promise<void> {
    const { chatId, telegramUser } = context;

    try {
      const messages = await this.i18nService.getUserMessages(
        telegramUser.id.toString(),
      );
      const userLanguage = await this.i18nService.getUserLanguage(
        telegramUser.id.toString(),
      );
      const languageName = this.i18nService.getLanguageName(
        userLanguage,
        userLanguage,
      );

      const languageMessage = `${messages.messages.language.title}

${messages.messages.language.description}

${messages.messages.language.current(languageName)}`;

      const inlineKeyboard = {
        inline_keyboard: [
          [
            { text: messages.buttons.english, callback_data: "lang_ENGLISH" },
            { text: messages.buttons.russian, callback_data: "lang_RUSSIAN" },
          ],
          [{ text: messages.buttons.back, callback_data: "back_to_menu" }],
        ],
      };

      await this.telegramApiService.sendMessage(bot, chatId, languageMessage, {
        reply_markup: inlineKeyboard,
      });
    } catch (error) {
      this.logger.error("Error showing language settings:", error);
      const messages = await this.i18nService.getUserMessages(
        telegramUser.id.toString(),
      );
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        messages.messages.errors.generalError,
      );
    }
  }

  async handleLanguageChange(
    bot: TelegramBot,
    chatId: number,
    telegramUserId: string,
    newLanguage: Language,
  ): Promise<void> {
    try {
      const success = await this.i18nService.updateUserLanguage(
        telegramUserId,
        newLanguage,
      );

      if (success) {
        const messages = this.i18nService.getMessages(newLanguage);
        const languageName = this.i18nService.getLanguageName(
          newLanguage,
          newLanguage,
        );

        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          messages.messages.language.changed(languageName),
        );

        // Show updated main menu with new language
        await this.showMainMenu(bot, chatId, telegramUserId);
      } else {
        const messages = await this.i18nService.getUserMessages(telegramUserId);
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          messages.messages.errors.languageError,
        );
      }
    } catch (error) {
      this.logger.error("Error changing language:", error);
      const messages = await this.i18nService.getUserMessages(telegramUserId);
      await this.telegramApiService.sendMessage(
        bot,
        chatId,
        messages.messages.errors.languageError,
      );
    }
  }

  private getStatusEmoji(status: string, messages: any): string {
    switch (status) {
      case "SENT":
        return messages.messages.general.sent;
      case "FAILED":
        return messages.messages.general.failed;
      case "PENDING":
        return messages.messages.general.pending;
      case "SCHEDULED":
        return messages.messages.general.scheduled;
      case "CANCELLED":
        return messages.messages.general.cancelledStatus;
      default:
        return messages.messages.general.unknownStatus;
    }
  }

  private getMessageTypeEmoji(type: string): string {
    switch (type) {
      case "TEXT":
        return "💬";
      case "PHOTO":
        return "📷";
      case "VIDEO":
        return "🎥";
      case "DOCUMENT":
        return "📄";
      case "AUDIO":
        return "🎵";
      case "GIF":
        return "🎬";
      case "STICKER":
        return "😀";
      case "POLL":
        return "📊";
      case "LOCATION":
        return "📍";
      default:
        return "💬";
    }
  }

  async handleSubscribe(
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

      const subscriptionInfo =
        await this.subscriptionService.getUserSubscriptionInfo(user.id);

      if (subscriptionInfo.subscriptionPlan === "PREMIUM") {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          `${messages.messages.subscription.premiumActive}

${messages.messages.subscription.alreadyActive}

${messages.messages.subscription.yourStats}
${messages.messages.subscription.totalMessages(subscriptionInfo.totalMessages)}
${messages.messages.subscription.subscriptionStatus(subscriptionInfo.subscriptionStatus)}

${messages.messages.subscription.useCancelCommand}`,
        );
        return;
      }

      const subscribeMessage = `${messages.messages.subscription.upgradeTitle}

${messages.messages.subscription.yourFreePlan}
${messages.messages.subscription.freeUsed(subscriptionInfo.freeMessagesUsed, 3)}
${messages.messages.subscription.remaining(subscriptionInfo.freeMessagesRemaining)}

${messages.messages.subscription.premiumPlan}
${messages.messages.subscription.unlimitedMessages}
${messages.messages.subscription.prioritySupport}
${messages.messages.subscription.advancedScheduling}
${messages.messages.subscription.analyticsDashboard}
${messages.messages.subscription.customBranding}

${messages.messages.subscription.clickToUpgrade}`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: messages.messages.subscription.upgradeToPremium,
              callback_data: "upgrade_premium",
            },
          ],
          [
            {
              text: messages.buttons.back,
              callback_data: "back_to_menu",
            },
          ],
        ],
      };

      await this.telegramApiService.sendMessage(bot, chatId, subscribeMessage, {
        reply_markup: keyboard,
      });
    } catch (error) {
      this.logger.error("Error handling subscribe command:", error);
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

  async handleSubscriptionManagement(
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

      const subscriptionInfo = await this.subscriptionService.getUserSubscriptionInfo(user.id);
      
      // Format start date
      const startDate = user.subscriptionStartDate ? 
        user.subscriptionStartDate.toDateString() : 
        messages.messages.general.notSet;

      let managementMessage = `${messages.messages.subscription.managementTitle}

${messages.messages.subscription.managementDescription}

${messages.messages.subscription.currentPlan} ${subscriptionInfo.subscriptionPlan === 'PREMIUM' ? '💎 Premium' : '🆓 Free'}
${messages.messages.subscription.status} ${subscriptionInfo.subscriptionStatus}`;

      let keyboard;

      if (subscriptionInfo.subscriptionPlan === "PREMIUM") {
        managementMessage += `
${messages.messages.subscription.startDate} ${startDate}
${messages.messages.subscription.monthlyPrice} $10/month

${messages.messages.subscription.yourStats}
${messages.messages.subscription.totalMessages(subscriptionInfo.totalMessages)}`;

                  keyboard = {
            inline_keyboard: [
              [
                {
                  text: messages.messages.subscription.cancelSubscriptionButton,
                  callback_data: "confirm_cancel_subscription_menu",
                },
              ],
            [
              {
                text: messages.buttons.back,
                callback_data: "back_to_menu",
              },
            ],
          ],
        };
      } else {
        managementMessage += `

${messages.messages.subscription.freeUsed(subscriptionInfo.freeMessagesUsed, 3)}
${messages.messages.subscription.remaining(subscriptionInfo.freeMessagesRemaining)}

${messages.messages.subscription.premiumPlan}
${messages.messages.subscription.unlimitedMessages}
${messages.messages.subscription.prioritySupport}
${messages.messages.subscription.advancedScheduling}`;

        keyboard = {
          inline_keyboard: [
            [
              {
                text: messages.messages.subscription.upgradeToPremium,
                callback_data: "upgrade_premium",
              },
            ],
            [
              {
                text: messages.buttons.back,
                callback_data: "back_to_menu",
              },
            ],
          ],
        };
      }

      await this.telegramApiService.sendMessage(bot, chatId, managementMessage, {
        reply_markup: keyboard,
      });

    } catch (error) {
      this.logger.error("Error handling subscription management:", error);
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

  async handleCancelSubscription(
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

      const subscriptionInfo =
        await this.subscriptionService.getUserSubscriptionInfo(user.id);

      if (subscriptionInfo.subscriptionPlan !== "PREMIUM") {
        await this.telegramApiService.sendMessage(
          bot,
          chatId,
          messages.messages.subscription.noPremiumToCancel,
        );
        return;
      }

      const cancelMessage = `${messages.messages.subscription.cancelTitle}

${messages.messages.subscription.cancelConfirmation}

${messages.messages.subscription.willLose}
${messages.messages.subscription.unlimitedMessages}
${messages.messages.subscription.prioritySupport}
${messages.messages.subscription.advancedScheduling}

${messages.messages.subscription.willKeep}
${messages.messages.subscription.freeMessages}
${messages.messages.subscription.basicFunctionality}
${messages.messages.subscription.dataAndChannels}

${messages.messages.subscription.remainsActive}`;

      const keyboard = {
        inline_keyboard: [
          [
            {
              text: messages.messages.subscription.yesCancelSubscription,
              callback_data: "confirm_cancel_subscription",
            },
          ],
          [
            {
              text: messages.messages.subscription.noKeepPremium,
              callback_data: "keep_subscription",
            },
          ],
        ],
      };

      await this.telegramApiService.sendMessage(bot, chatId, cancelMessage, {
        reply_markup: keyboard,
      });
    } catch (error) {
      this.logger.error("Error handling cancel subscription command:", error);
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
