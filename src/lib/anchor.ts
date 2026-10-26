import { ANCHOR_API_KEY, ANCHOR_BASE_URL } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";
import logger from "../utils/logger.js";

const BASE_URL = ANCHOR_BASE_URL || "https://api.sandbox.getanchor.co";

export interface AnchorAddress {
  addressLine_1: string;
  addressLine_2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface CreateCustomerInput {
  userId: string;
  email: string;
  phoneNumber: string;
  fullName: {
    firstName: string;
    lastName: string;
    middleName?: string;
    maidenName?: string;
  };
  address: AnchorAddress;
}

export interface VerifyIndividualCustomerInput {
  customerId: string;
  level?: string;
  bvn: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: "Male" | "Female" | "Others";
}

export interface AnchorAccountResource {
  id: string;
  type: string;
  attributes: {
    accountName?: string;
    accountNumber?: string;
    currency?: string;
    status?: string;
    [key: string]: any;
  };
}

export interface AnchorAccountNumberResource {
  id: string;
  type: string;
  attributes: {
    accountNumber: string;
    name?: string;
    accountName?: string;
    bank?: {
      provider?: string;
      name?: string;
      code?: string;
      nipCode?: string;
      cbnCode?: string;
    };
    bankName?: string;
    bankNipCode?: string;
    status?: string;
    [key: string]: any;
  };
}

class AnchorClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = ANCHOR_API_KEY || "";
    this.baseUrl = BASE_URL;
  }

  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    if (!this.apiKey) {
      throw new ApiError(500, "Anchor API key is not configured");
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-anchor-key": this.apiKey,
      ...(options.headers as Record<string, string>),
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const errorDetail =
          data?.errors?.[0]?.detail ||
          data?.errors?.[0]?.title ||
          data?.message ||
          `Anchor API error (${response.status})`;

        logger.error(
          {
            status: response.status,
            endpoint,
            errorDetail,
          },
          "[ANCHOR_API_ERROR]",
        );

        throw new ApiError(
          response.status >= 500 ? 502 : response.status,
          errorDetail,
        );
      }

      return data as T;
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      if (err.name === "AbortError") {
        throw new ApiError(504, "Anchor service request timed out");
      }
      logger.error({ endpoint, message: err.message }, "[ANCHOR_REQUEST_FAILED]");
      throw new ApiError(502, "Failed to communicate with Anchor banking services");
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Create an Individual Customer on Anchor (Tier 0)
   */
  async createIndividualCustomer(input: CreateCustomerInput) {
    const payload = {
      data: {
        type: "IndividualCustomer",
        attributes: {
          fullName: input.fullName,
          address: input.address,
          email: input.email,
          phoneNumber: input.phoneNumber,
          metadata: {
            userId: input.userId,
          },
        },
      },
    };

    const res = await this.request<{ data: { id: string; [key: string]: any } }>(
      "/api/v1/customers",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    return res.data;
  }

  /**
   * Update an existing Individual Customer before KYC is completed
   */
  async updateIndividualCustomer(customerId: string, input: Partial<CreateCustomerInput>) {
    const payload: any = {
      data: {
        type: "IndividualCustomer",
        attributes: {},
      },
    };

    if (input.fullName) payload.data.attributes.fullName = input.fullName;
    if (input.address) payload.data.attributes.address = input.address;
    if (input.phoneNumber) payload.data.attributes.phoneNumber = input.phoneNumber;

    const res = await this.request<{ data: { id: string; [key: string]: any } }>(
      `/api/v1/customers/update/${customerId}`,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );

    return res.data;
  }

  /**
   * Submit BVN verification for an Individual Customer (Tier 1)
   */
  async verifyIndividualCustomer(input: VerifyIndividualCustomerInput) {
    const payload = {
      data: {
        type: "IndividualCustomerVerification",
        attributes: {
          level: input.level || "TIER_2",
          level2: {
            bvn: input.bvn,
            dateOfBirth: input.dateOfBirth,
            gender: input.gender,
          },
        },
      },
    };

    // Notice: Never log payload containing the BVN
    const res = await this.request<{ data: any }>(
      `/api/v1/customers/${input.customerId}/verification/individual`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    return res.data;
  }

  /**
   * Create a Deposit Account (Product: SAVINGS)
   */
  async createDepositAccount(customerId: string) {
    const payload = {
      data: {
        type: "DepositAccount",
        attributes: {
          productName: "SAVINGS",
        },
        relationships: {
          customer: {
            data: {
              id: customerId,
              type: "IndividualCustomer",
            },
          },
        },
      },
    };

    const res = await this.request<{ data: AnchorAccountResource }>(
      "/api/v1/accounts",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    return res.data;
  }

  /**
   * Retrieve Account Numbers for an Account
   */
  async getAccountNumbers(accountId: string) {
    const res = await this.request<{ data: AnchorAccountNumberResource[] }>(
      `/api/v1/account-numbers?AccountId=${encodeURIComponent(accountId)}`,
      {
        method: "GET",
      },
    );

    return res.data;
  }

  /**
   * Get Customer details
   */
  async getCustomer(customerId: string) {
    const res = await this.request<{ data: any }>(
      `/api/v1/customers/${customerId}`,
      {
        method: "GET",
      },
    );

    return res.data;
  }

  /**
   * Get the verification status for a customer directly from the customer resource.
   */
  async getCustomerVerification(customerId: string): Promise<{
    status: string;
    level: string;
    [key: string]: any;
  } | null> {
    try {
      const customer = await this.getCustomer(customerId);
      const verification = customer?.attributes?.verification;

      if (!verification) {
        return null;
      }

      return {
        status: verification.status || "unknown",
        level: verification.level || "unknown",
        ...verification,
      };
    } catch (err: any) {
      if (err.statusCode === 404 || err.message?.includes("404")) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Register a webhook with Anchor.
   * deliveryMode: "AtMostOnce" | "AtLeastOnce"
   */
  async registerWebhook(input: {
    url: string;
    label?: string;
    deliveryMode?: "AtMostOnce" | "AtLeastOnce";
    token?: string;
  }) {
    const payload = {
      data: {
        type: "Webhook",
        attributes: {
          url: input.url,
          label: input.label || "app_webhook",
          deliveryMode: input.deliveryMode || "AtLeastOnce",
          ...(input.token ? { token: input.token } : {}),
        },
      },
    };

    const res = await this.request<{ data: any }>(
      "/api/v1/webhooks",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );

    return res.data;
  }

  /**
   * List registered webhooks on this Anchor organization.
   */
  async listWebhooks() {
    const res = await this.request<{ data: any[] }>(
      "/api/v1/webhooks",
      {
        method: "GET",
      },
    );

    return res.data;
  }
}

export const anchor = new AnchorClient();

