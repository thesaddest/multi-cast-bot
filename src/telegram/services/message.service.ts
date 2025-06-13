import { Injectable, Logger } from "@nestjs/common";
import { DbService } from "../../db/db.service";
import { Platform, MessageType, MessageStatus, Message } from "@prisma/client";

export interface CreateMessageData {
  content: string;
  messageType?: MessageType;
  platform: Platform;
  userId: string;
  channelId: string;
  mediaUrls?: string[];
  mediaTypes?: string[];
  scheduledAt?: Date;
  metadata?: any;
}

export interface UpdateMessageData {
  status?: MessageStatus;
  sentAt?: Date;
  platformMessageId?: string;
  error?: string;
  retryCount?: number;
  metadata?: any;
}

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(private dbService: DbService) {}

  async createMessage(data: CreateMessageData): Promise<Message> {
    const message = await this.dbService.message.create({
      data: {
        content: data.content,
        messageType: data.messageType || MessageType.TEXT,
        status: MessageStatus.PENDING,
        platform: data.platform,
        userId: data.userId,
        channelId: data.channelId,
        mediaUrls: data.mediaUrls || [],
        mediaTypes: data.mediaTypes || [],
        scheduledAt: data.scheduledAt,
        metadata: data.metadata,
      },
      include: {
        channel: true,
        user: true,
      },
    });

    this.logger.log(
      `Message created: ${message.id} for channel ${message.channel.title}`,
    );
    return message;
  }

  async updateMessage(
    messageId: string,
    data: UpdateMessageData,
  ): Promise<Message> {
    const message = await this.dbService.message.update({
      where: { id: messageId },
      data: {
        status: data.status,
        sentAt: data.sentAt,
        platformMessageId: data.platformMessageId,
        error: data.error,
        retryCount: data.retryCount,
        metadata: data.metadata,
      },
      include: {
        channel: true,
        user: true,
      },
    });

    this.logger.log(
      `Message updated: ${message.id} - Status: ${message.status}`,
    );
    return message;
  }

  async markMessageAsSent(
    messageId: string,
    platformMessageId: string,
  ): Promise<Message> {
    return this.updateMessage(messageId, {
      status: MessageStatus.SENT,
      sentAt: new Date(),
      platformMessageId,
    });
  }

  async markMessageAsFailed(
    messageId: string,
    error: string,
    retryCount?: number,
  ): Promise<Message> {
    return this.updateMessage(messageId, {
      status: MessageStatus.FAILED,
      error,
      retryCount,
    });
  }

  async getMessagesByChannel(
    channelId: string,
    limit: number = 50,
  ): Promise<Message[]> {
    return this.dbService.message.findMany({
      where: { channelId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        channel: true,
        user: true,
      },
    });
  }

  async getMessagesByUser(
    userId: string,
    limit: number = 50,
  ): Promise<Message[]> {
    return this.dbService.message.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        channel: true,
        user: true,
      },
    });
  }

  async getMessagesWithStatus(
    status: MessageStatus,
    limit: number = 100,
  ): Promise<Message[]> {
    return this.dbService.message.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        channel: true,
        user: true,
      },
    });
  }

  async deleteMessage(messageId: string): Promise<void> {
    const message = await this.dbService.message.findUnique({
      where: { id: messageId },
      include: { channel: true },
    });

    if (message) {
      await this.dbService.message.delete({
        where: { id: messageId },
      });
      this.logger.log(
        `Message deleted: ${messageId} from ${message.channel.title}`,
      );
    }
  }
}
