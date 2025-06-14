import { Language } from "@prisma/client";

export interface I18nMessages {
  buttons: {
    profile: string;
    myChannels: string;
    addChannel: string;
    sendMessage: string;
    messageHistory: string;
    changeLanguage: string;
    english: string;
    russian: string;
    back: string;
    subscription: string;
    support: string;
  };
  messages: {
    welcome: {
      title: (firstName: string) => string;
      description: (userId: string) => string;
      features: string;
    };
    welcomeBack: (firstName: string) => string;
    mainMenu: {
      title: string;
      description: string;
    };
    profile: {
      title: string;
      userId: string;
      email: string;
      username: string;
      memberSince: string;
      subscription: string;
      connectedPlatforms: (count: number) => string;
      activeChannels: string;
      messagesSent: string;
      scheduledMessages: string;
      premiumActive: string;
      freePlan: (remaining: number) => string;
    };
    language: {
      title: string;
      description: string;
      current: (language: string) => string;
      changed: (language: string) => string;
    };
    errors: {
      userNotFound: string;
      generalError: string;
      profileError: string;
      languageError: string;
      // New error messages
      tryAgain: string;
      channelUsernameProcessing: string;
      unableToGetUserInfo: string;
      accountSetupError: string;
      errorOccurred: string;
      // System errors
      paymentNotCompleted: string;
      channelNotFound: string;
      stripeSecretNotConfigured: string;
      stripeWebhookSecretNotConfigured: string;
      noActiveSubscription: string;
      noSubscriptionInSession: string;
      noMediaUrls: string;
      noMediaUrl: string;
      noMediaTypes: string;
    };
    messages: {
      noMessages: string;
      noMessagesDescription: string;
      historyTitle: string;
      historyLast: (count: number) => string;
      messagePreview: string;
      confirmBroadcast: string;
      messageSentTo: (count: number) => string;
      confirmBroadcastQuestion: string;
    };
    channels: {
      title: (count?: number) => string;
      noChannels: string;
      howToAdd: string;
      instructions: string;
      autoDetect: string;
      checking: string;
      addedSuccessfully: string;
      channelInfo: {
        type: string;
        members: string;
        username: string;
        readyForBroadcasting: string;
        canSendMessages: string;
      };
      viewAll: string;
      legend: {
        title: string;
        active: string;
        inactive: string;
      };
      management: string;
      refresh: string;
      channelTypes: {
        CHANNEL: string;
        GROUP: string;
        SUPERGROUP: string;
        PRIVATE: string;
      };
      addInstructions: {
        method1Title: string;
        method1Step1: string;
        method1Step2: string;
        method1Step3: string;
        method2Title: string;
        method2Format: string;
        examples: string;
        exampleChannel: string;
        exampleGroup: string;
        note: string;
      };
    };
    broadcast: {
      inProgress: string;
      inProgressDescription: string;
      confirming: string;
      complete: string;
      successCount: (count: number) => string;
      failedCount: (count: number) => string;
      totalChannels: (count: number) => string;
      detailedResults: string;
      failedChannelsNote: string;
      error: string;
      limitReached: string;
      yourUsage: string;
      freeMessagesUsed: (used: number, total: number) => string;
      totalMessagesSent: (count: number) => string;
      upgradePrompt: string;
      unlimitedMessages: string;
      prioritySupport: string;
      advancedFeatures: string;
      useSubscribeCommand: string;
      noActiveChannels: string;
      noActiveChannelsDescription: string;
      needToSetup: string;
      addChannelsStep: string;
      checkPermissionsStep: string;
      activateChannelsStep: string;
      manageChannelsHint: string;
      broadcastTitle: string;
      activeChannelsReady: (count: number) => string;
      typeMessage: string;
      tips: string;
      tipText: string;
      tipMedia: string;
      tipFormatting: string;
      sendToAll: string;
      sessionExpired: string;
      cancelled: string;
      errorOccurred: string;
      broadcastCancelled: string;
    };
    channelManagement: {
      title: string;
      type: string;
      members: string;
      username: string;
      added: string;
      canPost: string;
      limitedPermissions: string;
      active: string;
      inactive: string;
      activate: string;
      deactivate: string;
      remove: string;
      refreshInfo: string;
      backToChannels: string;
      activated: (title: string) => string;
      deactivated: (title: string) => string;
      removeTitle: string;
      removeConfirmation: string;
      removeWarning: string;
      yesRemove: string;
      cancel: string;
      removed: string;
      refreshing: string;
      updated: string;
      manage: string;
      unknown: string;
      none: string;
    };
    subscription: {
      premiumActive: string;
      alreadyActive: string;
      yourStats: string;
      totalMessages: (count: number) => string;
      subscriptionStatus: (status: string) => string;
      useCancelCommand: string;
      upgradeTitle: string;
      yourFreePlan: string;
      freeUsed: (used: number, total: number) => string;
      remaining: (count: number) => string;
      premiumPlan: string;
      unlimitedMessages: string;
      prioritySupport: string;
      advancedScheduling: string;
      analyticsDashboard: string;
      customBranding: string;
      clickToUpgrade: string;
      upgradeToPremium: string;
      cancelTitle: string;
      cancelConfirmation: string;
      willLose: string;
      willKeep: string;
      basicFunctionality: string;
      dataAndChannels: string;
      remainsActive: string;
      yesCancelSubscription: string;
      noKeepPremium: string;
      upgradeMessage: string;
      readyToSupercharge: string;
      whatYouGet: string;
      unlimitedMessagesAcross: string;
      priorityCustomerSupport: string;
      advancedSchedulingFeatures: string;
      payWithStripe: string;
      subscriptionCancelled: string;
      cancelledMessage: string;
      returnToFreePlan: string;
      freeMessages: string;
      keepChoice: string;
      noPremiumToCancel: string;
      managementTitle: string;
      managementDescription: string;
      viewDetails: string;
      manageSubscription: string;
      billingHistory: string;
      currentPlan: string;
      subscriptionDetails: string;
      startDate: string;
      nextBilling: string;
      monthlyPrice: string;
      status: string;
      cancelSubscriptionButton: string;
      premiumActivatedTitle: string;
      premiumActivatedMessage: string;
      premiumActivatedAccess: string;
      premiumActivatedFeatures: {
        unlimitedMessages: string;
        prioritySupport: string;
        advancedScheduling: string;
        analyticsDashboard: string;
        customBranding: string;
      };
      premiumActivatedThanks: string;
      // Payment error messages
      paymentError: string;
      paymentVerificationFailed: string;
      paymentCancelled: string;
    };
    display: {
      // Status displays
      premium: string;
      free: string;
      historyEmoji: string;
      // Channel type fallbacks
      privateChat: string;
      channelType: string;
      unknownType: string;
    };
    menuButtons: {
      // Button text arrays for comparison
      english: string[];
      russian: string[];
    };
    general: {
      unknown: string;
      none: string;
      notSet: string;
      noUsername: string;
      sessionExpired: string;
      cancelled: string;
      error: string;
      loading: string;
      success: string;
      unableToGetUserInfo: string;
      accountSetupError: string;
      messageHistoryLegend: string;
      detailedMessagesHint: string;
      sent: string;
      failed: string;
      pending: string;
      scheduled: string;
      cancelledStatus: string;
      unknownStatus: string;
    };
    channelAddition: {
      autoDetectionTitle: string;
      autoStep1: string;
      autoStep2: string;
      autoStep3: string;
      manualTitle: string;
      manualDescription: string;
      examples: string;
      exampleChannel: string;
      exampleGroup: string;
      note: string;
      alreadyInList: (title: string) => string;
      notFoundError: (username: string) => string;
      channelPublic: string;
      usernameCorrect: string;
      botHasAccess: string;
      foundButNotAdmin: (title: string) => string;
      addAsAdmin: string;
      connectedSuccessfully: string;
    };
    support: {
      title: string;
      description: string;
      contactInfo: string;
      telegramProfile: string;
      responseTime: string;
      helpfulTips: string;
    };
  };
}

const ENGLISH_MESSAGES: I18nMessages = {
  buttons: {
    profile: "👤 Profile",
    myChannels: "📋 My Channels",
    addChannel: "➕ Add Channel",
    sendMessage: "📢 Send Message",
    messageHistory: "📊 Message History",
    changeLanguage: "🌐 Language",
    english: "🇺🇸 English",
    russian: "🇷🇺 Русский",
    back: "⬅️ Back",
    subscription: "💎 Subscription",
    support: "🆘 Support",
  },
  messages: {
    welcome: {
      title: (firstName: string) =>
        `👋 Welcome to MultiCast Bot, ${firstName}!`,
      description: (userId: string) =>
        `Your account has been created successfully.\n\n🆔 User ID: ${userId}`,
      features:
        "🚀 Features available to you:\n• 📢 Send messages to multiple channels\n• ➕ Add unlimited channels\n• 🌐 Multi-language support",
    },
    welcomeBack: (firstName: string) => `👋 Welcome back, ${firstName}!`,
    mainMenu: {
      title: "🏠 Main Menu",
      description: "Choose an option from the menu below:",
    },
    profile: {
      title: "👤 Profile",
      userId: "🆔 User ID:",
      email: "📧 Email:",
      username: "👤 Username:",
      memberSince: "📅 Member since:",
      subscription: "💎 Subscription:",
      connectedPlatforms: (count: number) => `🔗 Connected platforms: ${count}`,
      activeChannels: "📋 Active channels:",
      messagesSent: "📊 Messages sent:",
      scheduledMessages: "📤 Scheduled messages:",
      premiumActive: "💎 Premium Active",
      freePlan: (remaining: number) => `🆓 Free Plan (${remaining} remaining messages)`,
    },
    language: {
      title: "🌐 Language Settings",
      description: "Select your preferred language:",
      current: (language: string) => `Current language: ${language}`,
      changed: (language: string) => `✅ Language changed to ${language}`,
    },
    errors: {
      userNotFound: "❌ User not found",
      generalError: "❌ An error occurred",
      profileError: "❌ Error loading profile",
      languageError: "❌ Error changing language",
      tryAgain: "❌ An error occurred. Please try again.",
      channelUsernameProcessing:
        "❌ An error occurred while processing the channel username.",
      unableToGetUserInfo: "❌ Unable to get user information",
      accountSetupError:
        "❌ Sorry, there was an error setting up your account. Please try again later.",
      errorOccurred: "Error occurred",
      // System errors
      paymentNotCompleted: "Payment not completed",
      channelNotFound: "Channel not found",
      stripeSecretNotConfigured: "Stripe secret key not configured",
      stripeWebhookSecretNotConfigured: "Stripe webhook secret not configured",
      noActiveSubscription: "No active subscription found",
      noSubscriptionInSession: "No subscription found in session",
      noMediaUrls: "No media URLs or types found for media group",
      noMediaUrl: "No media URL found for single media",
      noMediaTypes: "No media types found for media group",
    },
    messages: {
      noMessages: "📭 No messages found",
      noMessagesDescription:
        "You haven't sent any messages yet. Start by adding channels and sending your first message!",
      historyTitle: "📜 Message History",
      historyLast: (count: number) => `📜 Message History (Last ${count})`,
      messagePreview: "📝 Message Preview:",
      confirmBroadcast: "📢 Confirm Broadcast",
      messageSentTo: (count: number) =>
        `Your message will be sent to ${count} channel(s):`,
      confirmBroadcastQuestion:
        "Are you sure you want to broadcast this message?",
    },
    channels: {
      title: (count?: number) =>
        count !== undefined ? `📋 My Channels (${count})` : "📋 My Channels",
      noChannels: "📭 No channels added yet",
      howToAdd: "How to add channels:",
      instructions:
        "1. Add the bot to your channel as admin\n2. The channel will appear here automatically\n3. Or manually add by username: @channel",
      autoDetect: "🔍 Auto-detect channels",
      checking: "Checking channel... Please wait.",
      addedSuccessfully: "✅ Channel added successfully!",
      channelInfo: {
        type: "Type:",
        members: "Members:",
        username: "Username:",
        readyForBroadcasting: "Ready for broadcasting",
        canSendMessages: "Can send messages",
      },
      viewAll: "📋 View All Channels",
      legend: {
        title: "Legend:",
        active: "🟢 Active - Ready for broadcasting",
        inactive: "🔴 Inactive - Cannot send messages",
      },
      management: "⚙️ Channel Management",
      refresh: "🔄 Refresh",
      channelTypes: {
        CHANNEL: "Channel",
        GROUP: "Group",
        SUPERGROUP: "Supergroup",
        PRIVATE: "Private",
      },
      addInstructions: {
        method1Title: "Method 1: Auto-Detection (Recommended)",
        method1Step1: "Add this bot to your channel/group",
        method1Step2: "Make sure the bot has admin permissions",
        method1Step3: "The bot will automatically detect and add the channel",
        method2Title: "Method 2: Manual Addition",
        method2Format:
          "Send me the channel username in this format:\n@channelname",
        examples: "Examples:",
        exampleChannel: "@mychannel - for public channels",
        exampleGroup: "@mygroup - for public groups",
        note: "Note: For private channels/groups, use Method 1 (auto-detection) by adding the bot directly.",
      },
    },
    broadcast: {
      inProgress: "📡 Broadcasting message...",
      inProgressDescription:
        "Please wait while we send your message to all channels.",
      confirming: "Broadcasting...",
      complete: "📊 Broadcast Complete!",
      successCount: (count: number) => `✅ Successfully sent: ${count}`,
      failedCount: (count: number) => `❌ Failed: ${count}`,
      totalChannels: (count: number) => `📊 Total channels: ${count}`,
      detailedResults: "📋 Detailed Results:",
      failedChannelsNote:
        "💡 Failed channels may have restricted bot permissions or be inactive.",
      error: "❌ Error during broadcast. Some messages may not have been sent.",
      limitReached: "🚫 Message Limit Reached",
      yourUsage: "📊 Your Usage:",
      freeMessagesUsed: (used: number, total: number) =>
        `• Free messages used: ${used}/${total}`,
      totalMessagesSent: (count: number) => `• Total messages sent: ${count}`,
      upgradePrompt: "💎 Upgrade to Premium:",
      unlimitedMessages: "• Unlimited messages: $10/month",
      prioritySupport: "• Priority support",
      advancedFeatures: "• Advanced features",
      useSubscribeCommand: "Use /subscribe to upgrade your account!",
      noActiveChannels: "📢 No Active Channels",
      noActiveChannelsDescription:
        "You don't have any active channels where you can post messages.",
      needToSetup: "To broadcast messages, you need to:",
      addChannelsStep: '1️⃣ Add channels using "➕ Add Channel"',
      checkPermissionsStep: "2️⃣ Make sure the bot has posting permissions",
      activateChannelsStep: "3️⃣ Activate the channels you want to use",
      manageChannelsHint: 'Use "📋 My Channels" to manage your channels.',
      broadcastTitle: "📢 Broadcast Message",
      activeChannelsReady: (count: number) =>
        `You have ${count} active channel(s) ready for broadcasting:`,
      typeMessage:
        "📝 Please type your message that you want to send to all these channels:",
      tips: "💡 Tips:",
      tipText: "• You can send text, photos, videos, or documents",
      tipMedia: "• Media files will be posted natively (not forwarded)",
      tipFormatting: "• Use formatting: *bold*, _italic_, `code`",
      sendToAll: "✅ Send to All",
      sessionExpired: "Session expired. Please start again.",
      cancelled: "Cancelled",
      errorOccurred: "Error occurred",
      broadcastCancelled: "❌ Broadcast cancelled.",
    },
    channelManagement: {
      title: "⚙️ Channel Management",
      type: "🆔 Type:",
      members: "👥 Members:",
      username: "🔗 Username:",
      added: "📅 Added:",
      canPost: "✅ Can post messages",
      limitedPermissions: "⚠️ Limited permissions",
      active: "🟢 Active",
      inactive: "🔴 Inactive",
      activate: "🟢 Activate",
      deactivate: "🔴 Deactivate",
      remove: "🗑️ Remove",
      refreshInfo: "🔄 Refresh Info",
      backToChannels: "📋 Back to Channels",
      activated: (title: string) =>
        `✅ Channel "${title}" has been activated and will receive broadcasts.`,
      deactivated: (title: string) =>
        `🔴 Channel "${title}" has been deactivated and will not receive broadcasts.`,
      removeTitle: "🗑️ Remove Channel",
      removeConfirmation: "Are you sure you want to remove this channel?",
      removeWarning:
        "⚠️ This action cannot be undone. You'll need to add the channel again if you want to use it for broadcasting.",
      yesRemove: "🗑️ Yes, Remove",
      cancel: "❌ Cancel",
      removed: "✅ Channel Removed",
      refreshing: "🔄 Refreshing channel information...",
      updated: "🔄 Channel Information Updated",
      manage: "⚙️ Manage Channel",
      unknown: "Unknown",
      none: "None",
    },
    subscription: {
      premiumActive: "💎 Premium Subscription Active!",
      alreadyActive: "You already have an active premium subscription.",
      yourStats: "📊 Your Stats:",
      totalMessages: (count: number) => `• Total messages sent: ${count}`,
      subscriptionStatus: (status: string) =>
        `• Subscription status: ${status}`,
      useCancelCommand:
        "Use /cancel_subscription if you want to cancel your subscription.",
      upgradeTitle: "💎 Upgrade to Premium",
      yourFreePlan: "🆓 Your Free Plan:",
      freeUsed: (used: number, total: number) =>
        `• Free messages used: ${used}/${total}`,
      remaining: (count: number) => `• Remaining: ${count}`,
      premiumPlan: "💎 Premium Plan - $10/month:",
      unlimitedMessages: "• ✅ Unlimited messages",
      prioritySupport: "• ✅ Priority support",
      advancedScheduling: "• ✅ Advanced scheduling",
      analyticsDashboard: "• ✅ Analytics dashboard",
      customBranding: "• ✅ Custom branding",
      clickToUpgrade: "Click the button below to upgrade:",
      upgradeToPremium: "💎 Upgrade to Premium",
      cancelTitle: "🚫 Cancel Premium Subscription",
      cancelConfirmation:
        "Are you sure you want to cancel your premium subscription?",
      willLose: "❌ You will lose:",
      willKeep: "✅ You will keep:",
      basicFunctionality: "• Basic functionality",
      dataAndChannels: "• Your data and channels",
      remainsActive:
        "Your subscription will remain active until the end of the current billing period.",
      yesCancelSubscription: "🚫 Yes, Cancel Subscription",
      noKeepPremium: "❌ No, Keep Premium",
      upgradeMessage: "💎 Upgrade to Premium",
      readyToSupercharge: "Ready to supercharge your messaging?",
      whatYouGet: "✅ What you'll get:",
      unlimitedMessagesAcross: "• Unlimited messages across all platforms",
      priorityCustomerSupport: "• Priority customer support",
      advancedSchedulingFeatures: "• Advanced scheduling features",
      payWithStripe: "💎 Pay with Stripe",
      subscriptionCancelled: "✅ Subscription Cancelled",
      cancelledMessage: "Your premium subscription has been cancelled.",
      returnToFreePlan: "🆓 You'll return to the free plan with:",
      freeMessages: "• 3 free messages",
      keepChoice:
        "💎 Great choice! Your premium subscription will continue as normal. Thank you for staying with us!",
      noPremiumToCancel:
        "❌ You don't have an active premium subscription to cancel.",
      managementTitle: "📋 Subscription Management",
      managementDescription: "Manage your subscription and billing details",
      viewDetails: "View Details",
      manageSubscription: "Manage Subscription",
      billingHistory: "Billing History",
      currentPlan: "Current Plan:",
      subscriptionDetails: "Subscription Details",
      startDate: "Start Date:",
      nextBilling: "Next Billing:",
      monthlyPrice: "Monthly Price:",
      status: "Status:",
      cancelSubscriptionButton: "🚫 Cancel Subscription",
      premiumActivatedTitle: "🎉 Premium Subscription Activated!",
      premiumActivatedMessage:
        "✅ Your payment was successful and your premium subscription is now active!",
      premiumActivatedAccess: "💎 You now have access to:",
      premiumActivatedFeatures: {
        unlimitedMessages: "• ✅ Unlimited messages",
        prioritySupport: "• ✅ Priority support",
        advancedScheduling: "• ✅ Advanced scheduling",
        analyticsDashboard: "• ✅ Analytics dashboard",
        customBranding: "• ✅ Custom branding",
      },
      premiumActivatedThanks:
        "Thank you for upgrading! You can now enjoy all premium features.",
      // Payment error messages
      paymentError: "❌ Payment Error",
      paymentVerificationFailed: "❌ Payment Verification Failed",
      paymentCancelled: "🚫 Payment Cancelled",
    },
    display: {
      // Status displays
      premium: "💎 Premium",
      free: "🆓 Free",
      historyEmoji: "📊",
      // Channel type fallbacks
      privateChat: "👤 Private Chat",
      channelType: "📢 Channel",
      unknownType: "❓ Unknown",
    },
    menuButtons: {
      // Button text arrays for comparison
      english: [
        "👤 Profile",
        "📋 My Channels",
        "➕ Add Channel",
        "📢 Send Message",
        "📊 Message History",
        "🌐 Language",
        "💎 Subscription",
        "🆘 Support",
      ],
      russian: [
        "👤 Профиль",
        "📋 Мои каналы",
        "➕ Добавить канал",
        "📢 Отправить сообщение",
        "📊 История сообщений",
        "🌐 Язык",
        "💎 Подписка",
        "🆘 Поддержка",
      ],
    },
    general: {
      unknown: "Unknown",
      none: "None",
      notSet: "Not set",
      noUsername: "No username",
      sessionExpired: "Session expired. Please start again.",
      cancelled: "Cancelled",
      error: "Error occurred",
      loading: "Loading...",
      success: "Success",
      unableToGetUserInfo: "❌ Unable to get user information",
      accountSetupError:
        "❌ Sorry, there was an error setting up your account. Please try again later.",
      messageHistoryLegend: "✅ Sent  ❌ Failed  ⏳ Pending  📤 Scheduled",
      detailedMessagesHint:
        "Use /messages_detailed for more information about specific messages.",
      sent: "✅",
      failed: "❌",
      pending: "⏳",
      scheduled: "📤",
      cancelledStatus: "🚫",
      unknownStatus: "❓",
    },
    channelAddition: {
      autoDetectionTitle: "Method 1: Auto-Detection (Recommended)",
      autoStep1: "1. Add this bot to your channel/group",
      autoStep2: "2. Make sure the bot has admin permissions",
      autoStep3: "3. The bot will automatically detect and add the channel",
      manualTitle: "Method 2: Manual Addition",
      manualDescription: "Send me the channel username in this format:",
      examples: "Examples:",
      exampleChannel: "• @mychannel - for public channels",
      exampleGroup: "• @mygroup - for public groups",
      note: "Note: For private channels/groups, use Method 1 (auto-detection) by adding the bot directly.",
      alreadyInList: (title: string) =>
        `✅ Channel "${title}" is already in your list!`,
      notFoundError: (username: string) =>
        `❌ Channel @${username} not found or not accessible. Make sure:`,
      channelPublic: "• The channel is public",
      usernameCorrect: "• The username is correct",
      botHasAccess: "• The bot has access to the channel",
      foundButNotAdmin: (title: string) =>
        `⚠️ Found channel "${title}", but the bot is not an admin.`,
      addAsAdmin:
        "Please add the bot as an administrator to this channel, then try again.",
      connectedSuccessfully: "✅ Channel Connected Successfully!",
    },
    support: {
      title: "🆘 Support & Help",
      description: "Need help with the bot? I'm here to assist you!",
      contactInfo: "📞 Contact Information:",
      telegramProfile: "💬 Telegram: @thesaddestkid",
      responseTime: "⏱️ Response time: Usually within 24 hours",
      helpfulTips: "💡 Helpful Tips:\n• Make sure the bot has admin permissions in your channels",
    },
  },
};

const RUSSIAN_MESSAGES: I18nMessages = {
  buttons: {
    profile: "👤 Профиль",
    myChannels: "📋 Мои каналы",
    addChannel: "➕ Добавить канал",
    sendMessage: "📢 Отправить сообщение",
    messageHistory: "📊 История сообщений",
    changeLanguage: "🌐 Язык",
    english: "🇺🇸 English",
    russian: "🇷🇺 Русский",
    back: "⬅️ Назад",
    subscription: "💎 Подписка",
    support: "🆘 Поддержка",
  },
  messages: {
    welcome: {
      title: (firstName: string) =>
        `👋 Добро пожаловать в MultiCast Bot, ${firstName}!`,
      description: (userId: string) =>
        `Ваш аккаунт был успешно создан.\n\n🆔 ID пользователя: ${userId}`,
      features:
        "🚀 Доступные возможности:\n• 📢 Отправка сообщений в несколько каналов\n• 📊 Отслеживание статистики сообщений\n• ➕ Добавление неограниченного количества каналов\n• 🌐 Поддержка нескольких языков",
    },
    welcomeBack: (firstName: string) => `👋 С возвращением, ${firstName}!`,
    mainMenu: {
      title: "🏠 Главное меню",
      description: "Выберите опцию из меню ниже:",
    },
    profile: {
      title: "👤 Профиль",
      userId: "🆔 ID пользователя:",
      email: "📧 Email:",
      username: "👤 Имя пользователя:",
      memberSince: "📅 Участник с:",
      subscription: "💎 Подписка:",
      connectedPlatforms: (count: number) =>
        `🔗 Подключенные платформы: ${count}`,
      activeChannels: "📋 Активные каналы:",
      messagesSent: "📊 Отправлено сообщений:",
      scheduledMessages: "📤 Запланированные сообщения:",
      premiumActive: "💎 Премиум активен",
      freePlan: (remaining: number) =>
        `🆓 Бесплатный план (осталось ${remaining} сообщения)`,
    },
    language: {
      title: "🌐 Настройки языка",
      description: "Выберите предпочитаемый язык:",
      current: (language: string) => `Текущий язык: ${language}`,
      changed: (language: string) => `✅ Язык изменен на ${language}`,
    },
    errors: {
      userNotFound: "❌ Пользователь не найден",
      generalError: "❌ Произошла ошибка",
      profileError: "❌ Ошибка загрузки профиля",
      languageError: "❌ Ошибка изменения языка",
      // New error messages
      tryAgain: "❌ Произошла ошибка. Пожалуйста, попробуйте еще раз.",
      channelUsernameProcessing:
        "❌ Произошла ошибка при обработке имени канала.",
      unableToGetUserInfo: "❌ Не удалось получить информацию о пользователе",
      accountSetupError:
        "❌ Извините, произошла ошибка при настройке вашего аккаунта. Пожалуйста, попробуйте позже.",
      errorOccurred: "Произошла ошибка",
      // System errors
      paymentNotCompleted: "Платеж не завершен",
      channelNotFound: "Канал не найден",
      stripeSecretNotConfigured: "Секретный ключ Stripe не настроен",
      stripeWebhookSecretNotConfigured:
        "Секретный ключ вебхука Stripe не настроен",
      noActiveSubscription: "Не найдена активная подписка",
      noSubscriptionInSession: "Не найдена подписка в сессии",
      noMediaUrls: "Не найдены URL или типы медиа для группы медиа",
      noMediaUrl: "Не найден URL медиа",
      noMediaTypes: "Не найдены типы медиа для группы медиа",
    },
    messages: {
      noMessages: "📭 Сообщения не найдены",
      noMessagesDescription:
        "Вы еще не отправили ни одного сообщения. Начните с добавления каналов и отправки первого сообщения!",
      historyTitle: "📜 История сообщений",
      historyLast: (count: number) =>
        `📜 История сообщений (Последние ${count})`,
      messagePreview: "📝 Предварительный просмотр сообщения:",
      confirmBroadcast: "📢 Подтвердить рассылку",
      messageSentTo: (count: number) =>
        `Ваше сообщение будет отправлено в ${count} канал(ов):`,
      confirmBroadcastQuestion:
        "Вы уверены, что хотите отправить это сообщение?",
    },
    channels: {
      title: (count?: number) =>
        count !== undefined ? `📋 Мои каналы (${count})` : "📋 Мои каналы",
      noChannels: "📭 Каналы еще не добавлены",
      howToAdd: "Как добавить каналы:",
      instructions:
        "1. Добавьте бота в ваш канал как администратора\n2. Канал появится здесь автоматически\n3. Или добавьте вручную по имени: @channel",
      autoDetect: "🔍 Автоопределение каналов",
      checking: "Проверка канала... Пожалуйста, подождите.",
      addedSuccessfully: "✅ Канал успешно добавлен!",
      channelInfo: {
        type: "Тип:",
        members: "Участников:",
        username: "Имя пользователя:",
        readyForBroadcasting: "Готов к рассылке",
        canSendMessages: "Может отправлять сообщения",
      },
      viewAll: "📋 Посмотреть все каналы",
      legend: {
        title: "Легенда:",
        active: "🟢 Активный - готов к рассылке",
        inactive: "🔴 Неактивный - не может отправлять сообщения",
      },
      management: "⚙️ Управление каналами",
      refresh: "🔄 Обновить",
      channelTypes: {
        CHANNEL: "Канал",
        GROUP: "Группа",
        SUPERGROUP: "Супергруппа",
        PRIVATE: "Приватный",
      },
      addInstructions: {
        method1Title: "Метод 1: Автообнаружение (Рекомендуется)",
        method1Step1: "Добавьте этого бота в ваш канал/группу",
        method1Step2: "Убедитесь, что у бота есть права администратора",
        method1Step3: "Бот автоматически обнаружит и добавит канал",
        method2Title: "Метод 2: Ручное добавление",
        method2Format:
          "Отправьте мне имя пользователя канала в этом формате:\n@channelname",
        examples: "Примеры:",
        exampleChannel: "@mychannel - для публичных каналов",
        exampleGroup: "@mygroup - для публичных групп",
        note: "Примечание: Для приватных каналов/групп используйте Метод 1 (автообнаружение), добавив бота напрямую.",
      },
    },
    broadcast: {
      inProgress: "📡 Отправка сообщения...",
      inProgressDescription:
        "Пожалуйста, подождите, пока мы отправляем ваше сообщение во все каналы.",
      confirming: "Отправляем...",
      complete: "📊 Рассылка завершена!",
      successCount: (count: number) => `✅ Успешно отправлено: ${count}`,
      failedCount: (count: number) => `❌ Не удалось: ${count}`,
      totalChannels: (count: number) => `📊 Всего каналов: ${count}`,
      detailedResults: "📋 Подробные результаты:",
      failedChannelsNote:
        "💡 Неудачные каналы могут иметь ограничения на права бота или быть неактивными.",
      error:
        "❌ Ошибка при рассылке. Некоторые сообщения не могли быть отправлены.",
      limitReached: "🚫 Достигнут лимит сообщений",
      yourUsage: "📊 Ваше использование:",
      freeMessagesUsed: (used: number, total: number) =>
        `• Использовано бесплатных сообщений: ${used}/${total}`,
      totalMessagesSent: (count: number) =>
        `• Всего отправлено сообщений: ${count}`,
      upgradePrompt: "💎 Обновиться до Премиум:",
      unlimitedMessages: "• Безлимитные сообщения: $10/месяц",
      prioritySupport: "• Приоритетная поддержка",
      advancedFeatures: "• Расширенные возможности",
      useSubscribeCommand: "Используйте /subscribe для обновления аккаунта!",
      noActiveChannels: "📢 Нет активных каналов",
      noActiveChannelsDescription:
        "У вас нет активных каналов, где вы можете отправлять сообщения.",
      needToSetup: "Для рассылки сообщений нужно:",
      addChannelsStep: '1️⃣ Добавить каналы через "➕ Добавить канал"',
      checkPermissionsStep: "2️⃣ Убедиться, что у бота есть права на публикацию",
      activateChannelsStep:
        "3️⃣ Активировать каналы, которые хотите использовать",
      manageChannelsHint:
        'Используйте "📋 Мои каналы" для управления каналами.',
      broadcastTitle: "📢 Рассылка сообщения",
      activeChannelsReady: (count: number) =>
        `У вас есть ${count} активных канала(ов) готовых для рассылки:`,
      typeMessage:
        "📝 Пожалуйста, введите сообщение, которое хотите отправить во все эти каналы:",
      tips: "💡 Советы:",
      tipText: "• Можно отправлять текст, фото, видео или документы",
      tipMedia: "• Медиафайлы будут опубликованы нативно (не пересланы)",
      tipFormatting: "• Используйте форматирование: *жирный*, _курсив_, `код`",
      sendToAll: "✅ Отправить всем",
      sessionExpired: "Сессия истекла. Пожалуйста, начните заново.",
      cancelled: "Отмена",
      errorOccurred: "Произошла ошибка",
      broadcastCancelled: "❌ Рассылка отменена.",
    },
    channelManagement: {
      title: "⚙️ Управление каналами",
      type: "🆔 Тип:",
      members: "👥 Участников:",
      username: "🔗 Имя пользователя:",
      added: "📅 Добавлен:",
      canPost: "✅ Может публиковать сообщения",
      limitedPermissions: "⚠️ Ограниченные права",
      active: "🟢 Активен",
      inactive: "🔴 Неактивен",
      activate: "🟢 Активировать",
      deactivate: "🔴 Деактивировать",
      remove: "🗑️ Удалить",
      refreshInfo: "🔄 Обновить информацию",
      backToChannels: "📋 Назад к каналам",
      activated: (title: string) =>
        `✅ Канал "${title}" был активирован и будет получать рассылки.`,
      deactivated: (title: string) =>
        `🔴 Канал "${title}" был деактивирован и не будет получать рассылки.`,
      removeTitle: "🗑️ Удалить канал",
      removeConfirmation: "Вы уверены, что хотите удалить этот канал?",
      removeWarning:
        "⚠️ Это действие нельзя отменить. Вам нужно будет добавить канал снова, если захотите использовать его для рассылки.",
      yesRemove: "🗑️ Да, удалить",
      cancel: "❌ Отмена",
      removed: "✅ Канал удален",
      refreshing: "🔄 Обновление информации о канале...",
      updated: "🔄 Информация о канале обновлена",
      manage: "⚙️ Управлять каналом",
      unknown: "Неизвестно",
      none: "Нет",
    },
    subscription: {
      premiumActive: "💎 Премиум подписка активна!",
      alreadyActive: "У вас уже есть активная премиум подписка.",
      yourStats: "📊 Ваша статистика:",
      totalMessages: (count: number) =>
        `• Всего отправлено сообщений: ${count}`,
      subscriptionStatus: (status: string) => `• Статус подписки: ${status}`,
      useCancelCommand:
        "Используйте /cancel_subscription, если хотите отменить подписку.",
      upgradeTitle: "💎 Обновиться до Премиум",
      yourFreePlan: "🆓 Ваш бесплатный план:",
      freeUsed: (used: number, total: number) =>
        `• Использовано бесплатных сообщений: ${used}/${total}`,
      remaining: (count: number) => `• Осталось: ${count}`,
      premiumPlan: "💎 Премиум план - $10/месяц:",
      unlimitedMessages: "• ✅ Безлимитные сообщения",
      prioritySupport: "• ✅ Приоритетная поддержка",
      advancedScheduling: "• ✅ Расширенное планирование",
      analyticsDashboard: "• ✅ Панель аналитики",
      customBranding: "• ✅ Персональный брендинг",
      clickToUpgrade: "Нажмите кнопку ниже для обновления:",
      upgradeToPremium: "💎 Обновиться до Премиум",
      cancelTitle: "🚫 Отменить Премиум подписку",
      cancelConfirmation: "Вы уверены, что хотите отменить премиум подписку?",
      willLose: "❌ Вы потеряете:",
      willKeep: "✅ Вы сохраните:",
      basicFunctionality: "• Основной функционал",
      dataAndChannels: "• Ваши данные и каналы",
      remainsActive:
        "Ваша подписка останется активной до конца текущего биллингового периода.",
      yesCancelSubscription: "🚫 Да, отменить подписку",
      noKeepPremium: "❌ Нет, оставить Премиум",
      upgradeMessage: "💎 Обновиться до Премиум",
      readyToSupercharge: "Готовы усилить ваши сообщения?",
      whatYouGet: "✅ Что вы получите:",
      unlimitedMessagesAcross: "• Безлимитные сообщения на всех платформах",
      priorityCustomerSupport: "• Приоритетная поддержка клиентов",
      advancedSchedulingFeatures: "• Расширенные функции планирования",
      payWithStripe: "💎 Оплатить через Stripe",
      subscriptionCancelled: "✅ Подписка отменена",
      cancelledMessage: "Ваша премиум подписка была отменена.",
      returnToFreePlan: "🆓 Вы вернетесь к бесплатному плану с:",
      freeMessages: "• 3 бесплатных сообщения",
      keepChoice:
        "💎 Отличный выбор! Ваша премиум подписка будет продолжена как обычно. Спасибо, что остаетесь с нами!",
      noPremiumToCancel: "❌ У вас нет активной премиум подписки для отмены.",
      managementTitle: "📋 Управление подпиской",
      managementDescription:
        "Управляйте вашей подпиской и деталями выставления счетов",
      viewDetails: "Просмотреть детали",
      manageSubscription: "Управлять подпиской",
      billingHistory: "История выставления счетов",
      currentPlan: "Текущий план:",
      subscriptionDetails: "Детали подписки",
      startDate: "Дата начала:",
      nextBilling: "Следующий платеж:",
      monthlyPrice: "Ежемесячная стоимость:",
      status: "Статус:",
      cancelSubscriptionButton: "🚫 Отменить подписку",
      premiumActivatedTitle: "🎉 Премиум подписка активирована!",
      premiumActivatedMessage:
        "✅ Ваш платеж прошел успешно и ваша премиум подписка теперь активна!",
      premiumActivatedAccess: "💎 Теперь у вас есть доступ к:",
      premiumActivatedFeatures: {
        unlimitedMessages: "• ✅ Безлимитные сообщения",
        prioritySupport: "• ✅ Приоритетная поддержка",
        advancedScheduling: "• ✅ Расширенное планирование",
        analyticsDashboard: "• ✅ Панель аналитики",
        customBranding: "• ✅ Персональный брендинг",
      },
      premiumActivatedThanks:
        "Спасибо за обновление! Теперь вы можете наслаждаться всеми премиум функциями.",
      // Payment error messages
      paymentError: "❌ Ошибка платежа",
      paymentVerificationFailed: "❌ Ошибка верификации платежа",
      paymentCancelled: "🚫 Платеж отменен",
    },
    display: {
      // Status displays
      premium: "💎 Премиум",
      free: "🆓 Бесплатно",
      historyEmoji: "📊",
      // Channel type fallbacks
      privateChat: "👤 Приватный чат",
      channelType: "📢 Канал",
      unknownType: "❓ Неизвестно",
    },
    menuButtons: {
      // Button text arrays for comparison
      english: [
        "👤 Profile",
        "📋 My Channels",
        "➕ Add Channel",
        "📢 Send Message",
        "📊 Message History",
        "🌐 Language",
        "💎 Subscription",
        "🆘 Поддержка",
      ],
      russian: [
        "👤 Профиль",
        "📋 Мои каналы",
        "➕ Добавить канал",
        "📢 Отправить сообщение",
        "📊 История сообщений",
        "🌐 Язык",
        "💎 Подписка",
        "🆘 Поддержка",
      ],
    },
    general: {
      unknown: "Неизвестно",
      none: "Нет",
      notSet: "Не задано",
      noUsername: "Нет имени пользователя",
      sessionExpired: "Сессия истекла. Пожалуйста, начните заново.",
      cancelled: "Отмена",
      error: "Произошла ошибка",
      loading: "Загрузка...",
      success: "Успешно",
      unableToGetUserInfo: "❌ Не удалось получить информацию о пользователе",
      accountSetupError:
        "❌ Извините, произошла ошибка при настройке вашего аккаунта. Пожалуйста, попробуйте позже.",
      messageHistoryLegend:
        "✅ Отправлено  ❌ Не удалось  ⏳ В ожидании  📤 Запланировано",
      detailedMessagesHint:
        "Используйте /messages_detailed для получения дополнительной информации о конкретных сообщениях.",
      sent: "✅",
      failed: "❌",
      pending: "⏳",
      scheduled: "📤",
      cancelledStatus: "🚫",
      unknownStatus: "❓",
    },
    channelAddition: {
      autoDetectionTitle: "Метод 1: Автообнаружение (Рекомендуется)",
      autoStep1: "1. Добавьте этого бота в ваш канал/группу",
      autoStep2: "2. Убедитесь, что у бота есть права администратора",
      autoStep3: "3. Бот автоматически обнаружит и добавит канал",
      manualTitle: "Метод 2: Ручное добавление",
      manualDescription:
        "Отправьте мне имя пользователя канала в этом формате:",
      examples: "Примеры:",
      exampleChannel: "• @mychannel - для публичных каналов",
      exampleGroup: "• @mygroup - для публичных групп",
      note: "Примечание: Для приватных каналов/групп используйте Метод 1 (автообнаружение), добавив бота напрямую.",
      alreadyInList: (title: string) =>
        `✅ Канал "${title}" уже в вашем списке!`,
      notFoundError: (username: string) =>
        `❌ Канал @${username} не найден или недоступен. Убедитесь, что:`,
      channelPublic: "• Канал публичный",
      usernameCorrect: "• Имя пользователя правильное",
      botHasAccess: "• У бота есть доступ к каналу",
      foundButNotAdmin: (title: string) =>
        `⚠️ Найден канал "${title}", но бот не является администратором.`,
      addAsAdmin:
        "Пожалуйста, добавьте бота как администратора в этот канал, затем попробуйте снова.",
      connectedSuccessfully: "✅ Канал успешно подключен!",
    },
    support: {
      title: "🆘 Поддержка и помощь",
      description: "Нужна помощь с ботом? Я здесь, чтобы помочь вам!",
      contactInfo: "📞 Контактная информация:",
      telegramProfile: "💬 Telegram: @thesaddestkid",
      responseTime: "⏱️ Время ответа: Обычно в течение 24 часов",
      helpfulTips: "💡 Полезные советы:\n• Убедитесь, что бот имеет права администратора в ваших каналах",
    },
  },
};

export const getMessages = (language: Language): I18nMessages => {
  switch (language) {
    case Language.ENGLISH:
      return ENGLISH_MESSAGES;
    case Language.RUSSIAN:
      return RUSSIAN_MESSAGES;
    default:
      return ENGLISH_MESSAGES;
  }
};
