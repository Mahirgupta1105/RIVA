import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

export enum FailureCategory {
  MANDATE_EXPIRED = 'MANDATE_EXPIRED',
  AUTH_FAILURE_3DS = 'AUTH_FAILURE_3DS',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  UPI_APP_TIMEOUT = 'UPI_APP_TIMEOUT',
  BANK_GATEWAY_DOWN = 'BANK_GATEWAY_DOWN',
  TOKENIZATION_ERROR = 'TOKENIZATION_ERROR',
  RISK_BLOCKED = 'RISK_BLOCKED',
  TECHNICAL_ERROR = 'TECHNICAL_ERROR',
  UNKNOWN = 'UNKNOWN'
}

export interface ForensicResult {
  category: FailureCategory;
  confidence: number;
  source: 'AI' | 'HEURISTIC';
  reasoning: string;
}

export class ForensicEngine {
  private anthropic: Anthropic | null = null;

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }
  }

  async classify(incidentId: string, rawErrorMessage: string): Promise<ForensicResult> {
    if (this.anthropic) {
      try {
        return await this.classifyWithAI(rawErrorMessage);
      } catch (error) {
        console.error(`AI Classification failed for ${incidentId}:`, error);
      }
    }

    return this.classifyWithHeuristics(rawErrorMessage);
  }

  private async classifyWithAI(errorMessage: string): Promise<ForensicResult> {
    const response = await this.anthropic!.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      system: `You are a fintech payment forensic expert.
Analyze the provided payment failure error message and classify it into one of these categories:
- MANDATE_EXPIRED: E-mandate or standing instruction has expired.
- AUTH_FAILURE_3DS: 3DS authentication failed or timed out.
- INSUFFICIENT_FUNDS: Customer does not have enough balance.
- UPI_APP_TIMEOUT: UPI app failed to respond or timed out.
- BANK_GATEWAY_DOWN: Bank server/gateway is down or unavailable.
- TOKENIZATION_ERROR: Card tokenization failed or token is invalid.
- RISK_BLOCKED: Transaction blocked by risk or fraud filters.
- TECHNICAL_ERROR: General gateway or internal system error.
- UNKNOWN: Cannot determine from the message.

Respond ONLY in JSON format:
{
  "category": "CATEGORY_NAME",
  "confidence": 0.0-1.0,
  "reasoning": "short explanation"
}`,
      messages: [{ role: 'user', content: `Error message: ${errorMessage}` }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    const parsed = JSON.parse(text);

    // 1. Category Validation
    const isValidCategory = Object.values(FailureCategory).includes(parsed.category as FailureCategory);
    if (!isValidCategory) {
      throw new Error(`AI returned invalid category: ${parsed.category}`);
    }

    // 2. Confidence Validation
    const confidence = parsed.confidence;
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
      throw new Error(`Invalid confidence value: ${confidence}`);
    }

    return {
      category: parsed.category as FailureCategory,
      confidence: confidence,
      source: 'AI',
      reasoning: parsed.reasoning,
    };
  }

  private classifyWithHeuristics(errorMessage: string): ForensicResult {
    const msg = errorMessage.toLowerCase();

    const mappings: { pattern: RegExp; category: FailureCategory }[] = [
      { pattern: /expired|mandate|stale/i, category: FailureCategory.MANDATE_EXPIRED },
      { pattern: /3ds|auth|verification|challenge/i, category: FailureCategory.AUTH_FAILURE_3DS },
      { pattern: /insufficient|balance|funds|low balance/i, category: FailureCategory.INSUFFICIENT_FUNDS },
      { pattern: /upi timeout|app timeout|app not responding/i, category: FailureCategory.UPI_APP_TIMEOUT },
      { pattern: /gateway down|bank server|system unavailable|maintenance/i, category: FailureCategory.BANK_GATEWAY_DOWN },
      { pattern: /tokenization|token failed|token invalid/i, category: FailureCategory.TOKENIZATION_ERROR },
      { pattern: /fraud|blocked|risk|security/i, category: FailureCategory.RISK_BLOCKED },
      { pattern: /error|exception|failed|internal/i, category: FailureCategory.TECHNICAL_ERROR },
    ];

    for (const { pattern, category } of mappings) {
      if (pattern.test(msg)) {
        return {
          category,
          confidence: 0.6,
          source: 'HEURISTIC',
          reasoning: `Matched heuristic pattern: ${pattern}`,
        };
      }
    }

    return {
      category: FailureCategory.UNKNOWN,
      confidence: 0.1,
      source: 'HEURISTIC',
      reasoning: 'No heuristic patterns matched',
    };
  }
}
