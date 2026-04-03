// ============================================================
// Nexus402 / Webhook Service
// Handles asynchronous notifications to developer systems
// ============================================================

export interface WebhookPayload {
  event: 'payment.success' | 'asset.created' | 'balance.low';
  timestamp: string;
  data: any;
}

/**
 * Send a webhook notification with simple retry logic
 */
export async function sendWebhook(url: string, payload: WebhookPayload, retries = 3): Promise<boolean> {
  if (!url) return false;

  console.log(`[Webhook] Sending ${payload.event} to ${url}...`);

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Nexus402-Webhook/1.0',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log(`[Webhook] Success: ${payload.event} delivered.`);
        return true;
      }
      
      console.warn(`[Webhook] Attempt ${i + 1} failed with status ${response.status}.`);
    } catch (error: any) {
      console.error(`[Webhook] Attempt ${i + 1} error:`, error.message);
    }

    // Wait before retry (1s, 2s, 4s...)
    if (i < retries - 1) {
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  console.error(`[Webhook] Failed to deliver ${payload.event} after ${retries} attempts.`);
  return false;
}
