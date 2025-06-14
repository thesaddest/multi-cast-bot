import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Req,
  Headers,
  RawBodyRequest,
  Logger,
} from "@nestjs/common";
import { SubscriptionService } from "./subscription.service";
import { StripeService } from "./stripe.service";
import { UserManagementService } from "../telegram/services/user-management.service";
import { Request } from "express";
import { ConfigService } from "src/config/config.service";

@Controller("stripe")
export class StripeController {
  private readonly logger = new Logger(StripeController.name);

  constructor(
    private subscriptionService: SubscriptionService,
    private stripeService: StripeService,
    private userManagementService: UserManagementService,
    private configService: ConfigService,
  ) {}

  @Post("create-checkout-session")
  async createCheckoutSession(
    @Body()
    body: {
      userId: string;
      email: string;
      successUrl: string;
      cancelUrl: string;
    },
  ) {
    try {
      const { userId, email, successUrl, cancelUrl } = body;
      const url = await this.subscriptionService.createCheckoutSession(
        userId,
        email,
        successUrl,
        cancelUrl,
      );
      return { url };
    } catch (error) {
      this.logger.error("Error creating checkout session:", error);
      throw error;
    }
  }

  @Post("create-subscription")
  async createSubscription(@Body() body: { userId: string; email: string }) {
    try {
      const { userId, email } = body;
      const result = await this.subscriptionService.createSubscription(
        userId,
        email,
      );
      return result;
    } catch (error) {
      this.logger.error("Error creating subscription:", error);
      throw error;
    }
  }

  @Post("cancel-subscription/:userId")
  async cancelSubscription(@Param("userId") userId: string) {
    try {
      await this.subscriptionService.cancelSubscription(userId);
      return { success: true };
    } catch (error) {
      this.logger.error("Error canceling subscription:", error);
      throw error;
    }
  }

  @Get("subscription-info/:userId")
  async getSubscriptionInfo(@Param("userId") userId: string) {
    try {
      const info =
        await this.subscriptionService.getUserSubscriptionInfo(userId);
      return info;
    } catch (error) {
      this.logger.error("Error getting subscription info:", error);
      throw error;
    }
  }

  @Post("check-message-limit/:userId")
  async checkMessageLimit(@Param("userId") userId: string) {
    try {
      const result = await this.subscriptionService.canSendMessage(userId);
      return result;
    } catch (error) {
      this.logger.error("Error checking message limit:", error);
      throw error;
    }
  }

  @Post("webhook")
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature: string,
  ) {
    try {
      const event = await this.stripeService.constructEvent(
        req.rawBody!,
        signature,
      );

      this.logger.log(`Received webhook event: ${event.type}`);

      await this.subscriptionService.handleWebhookEvent(event.type, event.data);

      return { received: true };
    } catch (error) {
      this.logger.error("Error handling webhook:", error);
      throw error;
    }
  }

  @Get("success")
  async paymentSuccess(@Req() req: Request) {
    const { session_id, user_id } = req.query;

    this.logger.log(
      `Payment success called with session_id: ${session_id}, user_id: ${user_id}`,
    );

    const botUsername = this.configService.get<string>("app.tg.bot_username");

    if (!session_id || !user_id) {
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payment Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; color: #333; max-width: 500px; margin: 50px auto; padding: 20px; }
            .error { color: #e74c3c; }
          </style>
        </head>
        <body>
          <h1 class="error">❌ Payment Error</h1>
          <p>Invalid payment session. Please try again.</p>
          <p><strong>Return to your Telegram bot to continue.</strong></p>
        </body>
        </html>
      `;
    }

    try {
      // Verify the payment session
      const session = await this.stripeService.retrieveSession(
        session_id as string,
      );

      if (session.payment_status === "paid") {
        // Update the user's subscription status
        await this.subscriptionService.activateSubscriptionFromSession(
          user_id as string,
          session,
        );

        // Send Telegram notification and show updated profile
        await this.userManagementService.notifyUserOfSubscriptionSuccess(
          user_id as string,
        );

        return `
          <!DOCTYPE html>
          <html>
          <head>
            <title>Payment Successful</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; text-align: center; color: #333; max-width: 500px; margin: 50px auto; padding: 20px; }
              .success { color: #27ae60; }
              .button { background: #0088cc; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
              .telegram-link { background: #0088cc; }
            </style>
          </head>
          <body>
            <h1 class="success">✅ Payment Successful!</h1>
            <p>Your premium subscription has been activated.</p>
            <p>You now have unlimited access to all premium features.</p>
            <a href="https://t.me/${botUsername || "your_bot_username"}" class="button telegram-link">Return to Telegram Bot</a>
            <p><small>You can close this window and return to Telegram.</small></p>
          </body>
          </html>
        `;
      } else {
        throw new Error("Payment not completed");
      }
    } catch (error) {
      this.logger.error("Error verifying payment:", error);
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Payment Verification Error</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; color: #333; max-width: 500px; margin: 50px auto; padding: 20px; }
            .error { color: #e74c3c; }
          </style>
        </head>
        <body>
          <h1 class="error">❌ Payment Verification Failed</h1>
          <p>We couldn't verify your payment. Please contact support if you believe this is an error.</p>
          <p><strong>Return to your Telegram bot to continue.</strong></p>
        </body>
        </html>
      `;
    }
  }

  @Get("cancel")
  async paymentCancel(@Req() req: Request) {
    const botUsername = this.configService.get<string>("app.tg.bot_username");

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Cancelled</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; color: #333; max-width: 500px; margin: 50px auto; padding: 20px; }
          .cancel { color: #f39c12; }
          .button { background: #0088cc; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1 class="cancel">🚫 Payment Cancelled</h1>
        <p>Your payment was cancelled. You can try again anytime.</p>
        <a href="https://t.me/${botUsername || "your_bot_username"}" class="button">Return to Telegram Bot</a>
        <p><small>You can close this window and return to Telegram.</small></p>
      </body>
      </html>
    `;
  }

  @Get("debug/user/:userId")
  async debugUserStatus(@Param("userId") userId: string) {
    try {
      const subscriptionInfo =
        await this.subscriptionService.getUserSubscriptionInfo(userId);
      return {
        userId,
        subscriptionInfo,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error("Error getting user debug info:", error);
      return {
        userId,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
