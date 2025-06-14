import { Injectable, Logger } from "@nestjs/common";
import { DbService } from "../db/db.service";
import { StripeService } from "./stripe.service";
import { ConfigService } from "../config/config.service";
import { SubscriptionStatus, SubscriptionPlan, UserRole } from "@prisma/client";
import { getMessages } from "../telegram/constants/messages";

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private readonly FREE_MESSAGE_LIMIT = 3;
  private readonly PREMIUM_PRICE_ID: string;

  constructor(
    private prisma: DbService,
    private stripeService: StripeService,
    private configService: ConfigService,
  ) {
    this.PREMIUM_PRICE_ID =
      this.configService.get<string>("stripe.premium_price_id") || "";
  }

  async canSendMessage(
    userId: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return {
        allowed: false,
        reason: getMessages("ENGLISH" as any).messages.errors.userNotFound,
      };
    }

    if (user.role === UserRole.ADMIN) {
      return { allowed: true };
    }

    // Check if user has active premium subscription
    if (
      user.subscriptionStatus === SubscriptionStatus.ACTIVE &&
      user.subscriptionPlan === SubscriptionPlan.PREMIUM
    ) {
      return { allowed: true };
    }

    // Check free trial messages
    if (user.freeMessagesUsed < this.FREE_MESSAGE_LIMIT) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: `You've used all ${this.FREE_MESSAGE_LIMIT} free messages. Please upgrade to premium for unlimited messages.`,
    };
  }

  async incrementMessageCount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(
        getMessages("ENGLISH" as any).messages.errors.userNotFound,
      );
    }

    // If user has premium subscription, don't increment free message count
    if (
      user.subscriptionStatus === SubscriptionStatus.ACTIVE &&
      user.subscriptionPlan === SubscriptionPlan.PREMIUM
    ) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { messageCount: { increment: 1 } },
      });
      return;
    }

    // Increment both total and free message counts for free users
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        messageCount: { increment: 1 },
        freeMessagesUsed: { increment: 1 },
      },
    });
  }

  async createSubscription(
    userId: string,
    email: string,
  ): Promise<{ clientSecret: string; subscriptionId: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(
        getMessages("ENGLISH" as any).messages.errors.userNotFound,
      );
    }

    let customerId = user.stripeCustomerId;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await this.stripeService.createCustomer(
        email,
        user.username || undefined,
      );
      customerId = customer.id;

      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create subscription
    const subscription = await this.stripeService.createSubscription(
      customerId,
      this.PREMIUM_PRICE_ID,
    );

    // Update user with subscription info
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        subscriptionPlan: SubscriptionPlan.PREMIUM,
        subscriptionStartDate: new Date(),
      },
    });

    const latestInvoice = subscription.latest_invoice as any;
    const paymentIntent = latestInvoice?.payment_intent;

    return {
      clientSecret: paymentIntent?.client_secret,
      subscriptionId: subscription.id,
    };
  }

  async createCheckoutSession(
    userId: string,
    email: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(
        getMessages("ENGLISH" as any).messages.errors.userNotFound,
      );
    }

    let customerId = user.stripeCustomerId;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await this.stripeService.createCustomer(
        email,
        user.username || undefined,
      );
      customerId = customer.id;

      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await this.stripeService.createCheckoutSession(
      customerId,
      this.PREMIUM_PRICE_ID,
      successUrl,
      cancelUrl,
    );

    return session.url!;
  }

  async cancelSubscription(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.stripeSubscriptionId) {
      throw new Error(
        getMessages("ENGLISH" as any).messages.errors.noActiveSubscription,
      );
    }

    await this.stripeService.cancelSubscription(user.stripeSubscriptionId);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: SubscriptionStatus.CANCELLED,
        subscriptionPlan: SubscriptionPlan.FREE,
        subscriptionEndDate: new Date(),
      },
    });
  }

  async handleWebhookEvent(eventType: string, data: any): Promise<void> {
    switch (eventType) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await this.handleSubscriptionUpdate(data.object);
        break;
      case "customer.subscription.deleted":
        await this.handleSubscriptionCancelled(data.object);
        break;
      case "invoice.payment_succeeded":
        await this.handlePaymentSucceeded(data.object);
        break;
      case "invoice.payment_failed":
        await this.handlePaymentFailed(data.object);
        break;
      default:
        this.logger.log(`Unhandled webhook event: ${eventType}`);
    }
  }

  private async handleSubscriptionUpdate(subscription: any): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!user) {
      this.logger.warn(`User not found for subscription: ${subscription.id}`);
      return;
    }

    const status = this.mapStripeStatusToLocal(subscription.status);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: status,
        subscriptionPlan:
          status === SubscriptionStatus.ACTIVE
            ? SubscriptionPlan.PREMIUM
            : SubscriptionPlan.FREE,
      },
    });
  }

  private async handleSubscriptionCancelled(subscription: any): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!user) {
      this.logger.warn(`User not found for subscription: ${subscription.id}`);
      return;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: SubscriptionStatus.CANCELLED,
        subscriptionPlan: SubscriptionPlan.FREE,
        subscriptionEndDate: new Date(),
      },
    });
  }

  private async handlePaymentSucceeded(invoice: any): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { stripeSubscriptionId: invoice.subscription },
    });

    if (!user) {
      this.logger.warn(
        `User not found for subscription: ${invoice.subscription}`,
      );
      return;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        subscriptionPlan: SubscriptionPlan.PREMIUM,
      },
    });
  }

  private async handlePaymentFailed(invoice: any): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { stripeSubscriptionId: invoice.subscription },
    });

    if (!user) {
      this.logger.warn(
        `User not found for subscription: ${invoice.subscription}`,
      );
      return;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: SubscriptionStatus.PAST_DUE,
        subscriptionPlan: SubscriptionPlan.FREE,
      },
    });
  }

  private mapStripeStatusToLocal(stripeStatus: string): SubscriptionStatus {
    switch (stripeStatus) {
      case "active":
        return SubscriptionStatus.ACTIVE;
      case "canceled":
        return SubscriptionStatus.CANCELLED;
      case "past_due":
        return SubscriptionStatus.PAST_DUE;
      case "unpaid":
        return SubscriptionStatus.UNPAID;
      default:
        return SubscriptionStatus.EXPIRED;
    }
  }

  async getUserSubscriptionInfo(userId: string): Promise<{
    subscriptionStatus: SubscriptionStatus;
    subscriptionPlan: SubscriptionPlan;
    freeMessagesUsed: number;
    freeMessagesRemaining: number;
    totalMessages: number;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(
        getMessages("ENGLISH" as any).messages.errors.userNotFound,
      );
    }

    return {
      subscriptionStatus: user.subscriptionStatus,
      subscriptionPlan: user.subscriptionPlan,
      freeMessagesUsed: user.freeMessagesUsed,
      freeMessagesRemaining: Math.max(
        0,
        this.FREE_MESSAGE_LIMIT - user.freeMessagesUsed,
      ),
      totalMessages: user.messageCount,
    };
  }

  async activateSubscriptionFromSession(
    userId: string,
    session: any,
  ): Promise<void> {
    this.logger.log(
      `Activating subscription for user ${userId} from session ${session.id}`,
    );

    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error(
          getMessages("ENGLISH" as any).messages.errors.userNotFound,
        );
      }

      // Get the subscription from the session
      const subscriptionId = session.subscription;
      if (!subscriptionId) {
        throw new Error(
          getMessages("ENGLISH" as any).messages.errors.noSubscriptionInSession,
        );
      }

      // Update user with subscription info
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          stripeSubscriptionId: subscriptionId,
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          subscriptionPlan: SubscriptionPlan.PREMIUM,
          subscriptionStartDate: new Date(),
        },
      });

      this.logger.log(
        `Successfully activated premium subscription for user ${userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Error activating subscription for user ${userId}:`,
        error,
      );
      throw error;
    }
  }
}
