import { Injectable, Logger, forwardRef, Inject } from "@nestjs/common";
import { DbService } from "../../db/db.service";
import { Platform } from "@prisma/client";
import * as TelegramBot from "node-telegram-bot-api";
import { TelegramUserWithChannels } from "../types/telegram.types";
import { TelegramService } from "../telegram.service";

@Injectable()
export class UserManagementService {
  private readonly logger = new Logger(UserManagementService.name);

  constructor(
    private dbService: DbService,
    @Inject(forwardRef(() => TelegramService))
    private telegramService: TelegramService,
  ) {}

  async findUserByTelegramId(
    telegramId: string,
  ): Promise<TelegramUserWithChannels | null> {
    return await this.dbService.user.findFirst({
      where: {
        accounts: {
          some: {
            platform: Platform.TELEGRAM,
            platformId: telegramId,
          },
        },
      },
      include: {
        accounts: true,
        channels: true,
      },
    });
  }

  async findUserWithStats(
    telegramId: string,
  ): Promise<TelegramUserWithChannels | null> {
    return await this.dbService.user.findFirst({
      where: {
        accounts: {
          some: {
            platform: Platform.TELEGRAM,
            platformId: telegramId,
          },
        },
      },
      include: {
        accounts: {
          where: { isActive: true },
        },
        channels: {
          where: { isActive: true },
        },
        _count: {
          select: {
            messages: true,
            messageQueue: true,
          },
        },
      },
    });
  }

  async createUserWithTelegramAccount(
    telegramUser: TelegramBot.User,
  ): Promise<TelegramUserWithChannels> {
    const user = await this.dbService.user.create({
      data: {
        username: telegramUser.username,
        primaryPlatform: Platform.TELEGRAM,
        accounts: {
          create: {
            platform: Platform.TELEGRAM,
            platformId: telegramUser.id.toString(),
            username: telegramUser.username,
            displayName:
              `${telegramUser.first_name} ${telegramUser.last_name || ""}`.trim(),
            firstName: telegramUser.first_name,
            lastName: telegramUser.last_name,
          },
        },
      },
      include: {
        accounts: true,
        channels: true,
      },
    });

    this.logger.log(
      `New user created: ${user.id} (Telegram: ${telegramUser.id})`,
    );
    return user;
  }

  async findOrCreateUser(
    telegramUser: TelegramBot.User,
  ): Promise<TelegramUserWithChannels> {
    let user = await this.findUserByTelegramId(telegramUser.id.toString());

    if (!user) {
      user = await this.createUserWithTelegramAccount(telegramUser);
    }

    return user;
  }

  async findUserTelegramInfoById(userId: string): Promise<{
    id: string;
    telegramId: string;
    username?: string;
    displayName?: string;
  } | null> {
    try {
      const user = await this.dbService.user.findUnique({
        where: { id: userId },
        include: {
          accounts: {
            where: { platform: Platform.TELEGRAM },
          },
        },
      });

      if (user && user.accounts.length > 0) {
        const telegramAccount = user.accounts[0];
        return {
          id: user.id,
          telegramId: telegramAccount.platformId,
          username: telegramAccount.username,
          displayName: telegramAccount.displayName || user.username,
        };
      }
      return null;
    } catch (error) {
      this.logger.error("Error finding user Telegram info:", error);
      return null;
    }
  }

  async notifyUserOfSubscriptionSuccess(userId: string): Promise<void> {
    try {
      const userInfo = await this.findUserTelegramInfoById(userId);
      if (!userInfo) {
        this.logger.warn(
          `User ${userId} not found for subscription notification`,
        );
        return;
      }

      const chatId = parseInt(userInfo.telegramId);

      await this.telegramService.sendSubscriptionSuccessNotification(
        chatId,
        userInfo.displayName,
      );

      this.logger.log(
        `Subscription success notification sent to user ${userId}`,
      );
    } catch (error) {
      this.logger.error("Error notifying user of subscription success:", error);
    }
  }
}
