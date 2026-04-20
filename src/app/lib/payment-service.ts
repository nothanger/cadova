export type BillingInterval = "monthly" | "yearly";
export type SubscriptionPlan = "free" | "pro" | "premium";

export interface LocalSubscription {
  userId: string;
  plan: "pro";
  billing: BillingInterval;
  activatedAt: string;
}

const SUBSCRIPTION_KEY = "cadova_subscription_state";

export const PRO_PRICING = {
  monthly: {
    label: "Mensuel",
    price: "8,99 €",
    note: "par mois",
    amount: 8.99,
  },
  yearly: {
    label: "Annuel",
    price: "89,90 €",
    note: "par an",
    amount: 89.9,
    savings: "2 mois offerts",
  },
};

function readSubscriptions(): Record<string, LocalSubscription> {
  try {
    return JSON.parse(localStorage.getItem(SUBSCRIPTION_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeSubscriptions(subscriptions: Record<string, LocalSubscription>) {
  localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(subscriptions));
}

export function getStoredSubscription(userId: string): LocalSubscription | null {
  return readSubscriptions()[userId] ?? null;
}

export function isProSubscription(plan?: SubscriptionPlan | null) {
  return plan === "pro" || plan === "premium";
}

export async function confirmProCheckout(userId: string, billing: BillingInterval): Promise<LocalSubscription> {
  await new Promise((resolve) => setTimeout(resolve, 900));
  const subscription: LocalSubscription = {
    userId,
    plan: "pro",
    billing,
    activatedAt: new Date().toISOString(),
  };
  const subscriptions = readSubscriptions();
  subscriptions[userId] = subscription;
  writeSubscriptions(subscriptions);
  return subscription;
}
