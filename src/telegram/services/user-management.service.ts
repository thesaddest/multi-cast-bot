import { Injectable, Logger } from "@nestjs/common";
import { DbService } from "../../db/db.service";
import { Platform } from "@prisma/client";
import * as TelegramBot from "node-telegram-bot-api";
import { TelegramUserWithChannels } from "../types/telegram.types";

@Injectable()
export class UserManagementService {
  private readonly logger = new Logger(UserManagementService.name);

  constructor(private dbService: DbService) {}

  async findUserByTelegramId(telegramId: string): Promise<TelegramUserWithChannels | null> {
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

  async findUserWithStats(telegramId: string): Promise<TelegramUserWithChannels | null> {
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

  async createUserWithTelegramAccount(telegramUser: TelegramBot.User): Promise<TelegramUserWithChannels> {
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

    this.logger.log(`New user created: ${user.id} (Telegram: ${telegramUser.id})`);
    return user;
  }

  async findOrCreateUser(telegramUser: TelegramBot.User): Promise<TelegramUserWithChannels> {
    let user = await this.findUserByTelegramId(telegramUser.id.toString());
    
    if (!user) {
      user = await this.createUserWithTelegramAccount(telegramUser);
    }
    
    return user;
  }
} 