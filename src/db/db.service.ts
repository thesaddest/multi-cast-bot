import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class DbService extends PrismaClient implements OnModuleInit {
  constructor(private readonly logger: Logger) {
    super();
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.debug("Database connected");
    } catch (error) {
      this.logger.error("Failed to connect to the database:", error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.debug("Database connection closed.");
  }

  async findUnique<T, K>(
    model: { findUnique: (params: K) => Promise<T | null> },
    params: K,
  ): Promise<T | null> {
    return model.findUnique(params);
  }

  async findMany<T, K>(
    model: { findMany: (params: K) => Promise<T[]> },
    params: K,
  ): Promise<T[]> {
    return model.findMany(params);
  }

  async create<T, K>(
    model: { create: (params: K) => Promise<T> },
    params: K,
  ): Promise<T> {
    return model.create(params);
  }

  async update<T, K>(
    model: { update: (params: K) => Promise<T> },
    params: K,
  ): Promise<T> {
    return model.update(params);
  }
}
