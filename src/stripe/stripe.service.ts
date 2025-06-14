import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "../config/config.service";
import Stripe from "stripe";
import { getMessages } from "../telegram/constants/messages";

@Injectable()
export class StripeService {
  private stripe: Stripe;
  private readonly logger = new Logger(StripeService.name);

  constructor(private configService: ConfigService) {
    const stripeSecretKey = this.configService.get<string>("stripe.secret_key");
    if (!stripeSecretKey) {
      this.logger.error("Stripe secret key not found in configuration");
      throw new Error(
        getMessages("ENGLISH" as any).messages.errors.stripeSecretNotConfigured,
      );
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-05-28.basil",
    });
  }

  async createCustomer(email: string, name?: string): Promise<Stripe.Customer> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
      });
      return customer;
    } catch (error) {
      this.logger.error("Error creating Stripe customer:", error);
      throw error;
    }
  }

  async createSubscription(
    customerId: string,
    priceId: string,
    trialPeriodDays = 0,
  ): Promise<Stripe.Subscription> {
    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        trial_period_days: trialPeriodDays,
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
      });
      return subscription;
    } catch (error) {
      this.logger.error("Error creating Stripe subscription:", error);
      throw error;
    }
  }

  async cancelSubscription(
    subscriptionId: string,
  ): Promise<Stripe.Subscription> {
    try {
      const subscription =
        await this.stripe.subscriptions.cancel(subscriptionId);
      return subscription;
    } catch (error) {
      this.logger.error("Error canceling Stripe subscription:", error);
      throw error;
    }
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription =
        await this.stripe.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error) {
      this.logger.error("Error retrieving Stripe subscription:", error);
      throw error;
    }
  }

  async createPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.attach(
        paymentMethodId,
        {
          customer: customerId,
        },
      );
      return paymentMethod;
    } catch (error) {
      this.logger.error("Error attaching payment method:", error);
      throw error;
    }
  }

  async createCheckoutSession(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<Stripe.Checkout.Session> {
    try {
      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: successUrl,
        cancel_url: cancelUrl,
      });
      return session;
    } catch (error) {
      this.logger.error("Error creating checkout session:", error);
      throw error;
    }
  }

  async constructEvent(
    payload: Buffer,
    signature: string,
  ): Promise<Stripe.Event> {
    const webhookSecret = this.configService.get<string>(
      "stripe.webhook_secret",
    );
    if (!webhookSecret) {
      throw new Error(
        getMessages(
          "ENGLISH" as any,
        ).messages.errors.stripeWebhookSecretNotConfigured,
      );
    }

    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
      return event;
    } catch (error) {
      this.logger.error("Error constructing webhook event:", error);
      throw error;
    }
  }

  async retrieveSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);
      return session;
    } catch (error) {
      this.logger.error("Error retrieving checkout session:", error);
      throw error;
    }
  }
}
