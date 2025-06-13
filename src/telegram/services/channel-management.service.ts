import { Injectable, Logger } from "@nestjs/common";
import { DbService } from "../../db/db.service";
import { Platform, ChannelType, Channel } from "@prisma/client";
import * as TelegramBot from "node-telegram-bot-api";
import { ChannelWithMetadata, CreateChannelData, ChannelMetadata } from "../types/telegram.types";

@Injectable()
export class ChannelManagementService {
  private readonly logger = new Logger(ChannelManagementService.name);

  constructor(private dbService: DbService) {}

  async getUserChannels(userId: string): Promise<Channel[]> {
    return await this.dbService.channel.findMany({
      where: {
        userId,
        platform: Platform.TELEGRAM,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findChannelById(channelId: string, userId: string): Promise<Channel | null> {
    return await this.dbService.channel.findFirst({
      where: {
        id: channelId,
        userId,
      },
    });
  }

  async findChannelByPlatformId(platformId: string, userId: string): Promise<Channel | null> {
    return await this.dbService.channel.findFirst({
      where: {
        platform: Platform.TELEGRAM,
        platformId,
        userId,
      },
    });
  }

  async createChannel(data: CreateChannelData): Promise<Channel> {
    const channel = await this.dbService.channel.create({
      data: {
        platform: Platform.TELEGRAM,
        userId: data.userId,
        platformId: data.platformId,
        title: data.title,
        type: data.type,
        username: data.username,
        description: data.description,
        memberCount: data.memberCount,
        canPost: data.canPost ?? true,
        metadata: data.metadata as any, // Prisma Json type requires any
      },
    });

    this.logger.log(`Channel created: ${channel.title} (${data.platformId}) for user ${data.userId}`);
    return channel;
  }

  async updateChannel(channelId: string, data: Partial<Channel>): Promise<Channel> {
    return await this.dbService.channel.update({
      where: { id: channelId },
      data,
    });
  }

  async toggleChannelStatus(channelId: string): Promise<Channel> {
    const channel = await this.dbService.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new Error('Channel not found');
    }

    const updatedChannel = await this.dbService.channel.update({
      where: { id: channelId },
      data: { isActive: !channel.isActive },
    });

    this.logger.log(`Channel ${updatedChannel.isActive ? 'activated' : 'deactivated'}: ${channel.title}`);
    return updatedChannel;
  }

  async deleteChannel(channelId: string): Promise<void> {
    const channel = await this.dbService.channel.findUnique({
      where: { id: channelId },
    });

    if (channel) {
      await this.dbService.channel.delete({
        where: { id: channelId },
      });
      this.logger.log(`Channel removed: ${channel.title}`);
    }
  }

  async reactivateChannelIfExists(platformId: string, userId: string): Promise<boolean> {
    const existingChannel = await this.findChannelByPlatformId(platformId, userId);
    
    if (existingChannel && !existingChannel.isActive) {
      await this.updateChannel(existingChannel.id, { isActive: true });
      return true;
    }
    
    return false;
  }

  getChannelType(chatType: string): ChannelType {
    switch (chatType) {
      case 'private':
        return ChannelType.PRIVATE;
      case 'group':
        return ChannelType.GROUP;
      case 'supergroup':
        return ChannelType.SUPERGROUP;
      case 'channel':
        return ChannelType.CHANNEL;
      default:
        return ChannelType.GROUP;
    }
  }

  getChannelTypeDisplay(type: ChannelType): string {
    switch (type) {
      case ChannelType.PRIVATE:
        return '👤 Private Chat';
      case ChannelType.GROUP:
        return '👥 Group';
      case ChannelType.SUPERGROUP:
        return '👥 Supergroup';
      case ChannelType.CHANNEL:
        return '📢 Channel';
      default:
        return '❓ Unknown';
    }
  }

  formatChannelsList(channels: Channel[]): string {
    return channels.map((channel, index) => {
      let statusIcon;
      if (!channel.isActive) {
        statusIcon = "🔴"; // Inactive/Deactivated
      } else if (channel.canPost) {
        statusIcon = "✅"; // Active and can post
      } else {
        statusIcon = "⚠️"; // Active but limited permissions
      }
      
      const typeDisplay = this.getChannelTypeDisplay(channel.type);
      const memberInfo = channel.memberCount ? ` (${channel.memberCount} members)` : '';
      const activeStatus = channel.isActive ? "" : " (INACTIVE)";
      
      return `${index + 1}. ${statusIcon} ${channel.title}${activeStatus}
   🆔 ${typeDisplay}${memberInfo}
   🔗 ${channel.username ? `@${channel.username}` : 'No username'}
   📅 Added: ${channel.createdAt.toDateString()}`;
    }).join('\n\n');
  }
} 