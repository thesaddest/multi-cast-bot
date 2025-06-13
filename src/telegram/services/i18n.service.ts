import { Injectable, Logger } from "@nestjs/common";
import { Language } from "@prisma/client";
import { getMessages, I18nMessages } from "../constants/messages";
import { DbService } from "../../db/db.service";

@Injectable()
export class I18nService {
  private readonly logger = new Logger(I18nService.name);

  constructor(private dbService: DbService) {}

  /**
   * Get user's preferred language from database
   */
  async getUserLanguage(telegramUserId: string): Promise<Language> {
    try {
      const account = await this.dbService.account.findFirst({
        where: {
          platform: "TELEGRAM",
          platformId: telegramUserId,
        },
        include: {
          user: true,
        },
      });

      return account?.user?.language || Language.ENGLISH;
    } catch (error) {
      this.logger.error(`Error getting user language for ${telegramUserId}:`, error);
      return Language.ENGLISH;
    }
  }

  /**
   * Update user's language preference
   */
  async updateUserLanguage(telegramUserId: string, language: Language): Promise<boolean> {
    try {
      const account = await this.dbService.account.findFirst({
        where: {
          platform: "TELEGRAM",
          platformId: telegramUserId,
        },
      });

      if (!account) {
        this.logger.error(`Account not found for telegram user ${telegramUserId}`);
        return false;
      }

      await this.dbService.user.update({
        where: { id: account.userId },
        data: { language },
      });

      return true;
    } catch (error) {
      this.logger.error(`Error updating user language for ${telegramUserId}:`, error);
      return false;
    }
  }

  /**
   * Get localized messages for a specific language
   */
  getMessages(language: Language): I18nMessages {
    return getMessages(language);
  }

  /**
   * Get localized messages for a user (using their preferred language)
   */
  async getUserMessages(telegramUserId: string): Promise<I18nMessages> {
    const language = await this.getUserLanguage(telegramUserId);
    return this.getMessages(language);
  }

  /**
   * Get human-readable language name
   */
  getLanguageName(language: Language, targetLanguage: Language = Language.ENGLISH): string {
    const names = {
      [Language.ENGLISH]: {
        [Language.ENGLISH]: "English",
        [Language.RUSSIAN]: "Russian",
      },
      [Language.RUSSIAN]: {
        [Language.ENGLISH]: "Английский",
        [Language.RUSSIAN]: "Русский",
      },
    };

    return names[targetLanguage]?.[language] || "English";
  }

  /**
   * Get all available languages
   */
  getAvailableLanguages(): Language[] {
    return Object.values(Language);
  }
} 