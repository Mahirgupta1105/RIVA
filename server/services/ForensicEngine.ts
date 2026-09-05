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
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (apiKey) {
      this.anthropic = new Anthropic({
        apiKey
      });

      console.log('RIVA Agent 1: Anthropic AI enabled');
    } else {
      console.warn(
        'RIVA Agent 1: ANTHROPIC_API_KEY not found. Using heuristic classification.'
      );
    }
  }

  /**
   * Main classification entry point.
   *
   * Agent 1 tries Claude first.
   * If Claude fails, the system safely falls back
   * to deterministic heuristic classification.
   */
  async classify(
    incidentId: string,
    rawErrorMessage: string
  ): Promise<ForensicResult> {
    if (this.anthropic) {
      try {
        const result =
          await this.classifyWithAI(rawErrorMessage);

        console.log(
          `RIVA Agent 1: AI classification successful for ${incidentId}`
        );

        return result;
      } catch (error: any) {
        console.error(
          `RIVA Agent 1: AI classification failed for ${incidentId}`
        );

        console.error(
          'Error name:',
          error?.name
        );

        console.error(
          'Error message:',
          error?.message
        );

        console.error(
          'Error status:',
          error?.status
        );

        if (error instanceof Anthropic.APIError) {
          console.error(
            'Anthropic API error:',
            {
              status: error.status,
              name: error.name,
              message: error.message
            }
          );
        }

        console.warn(
          'RIVA Agent 1: Falling back to heuristic classification.'
        );
      }
    }

    return this.classifyWithHeuristics(
      rawErrorMessage
    );
  }

  /**
   * Claude-powered forensic classification.
   */
  private async classifyWithAI(
    errorMessage: string
  ): Promise<ForensicResult> {
    if (!this.anthropic) {
      throw new Error(
        'Anthropic client is not initialized'
      );
    }

    const response =
      await this.anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,

        system: `
You are RIVA Agent 1, a fintech payment forensic intelligence system.

Your job is to analyze a payment failure and determine the most likely root cause.

Classify the failure into exactly ONE of these categories:

MANDATE_EXPIRED
E-mandate or standing instruction has expired.

AUTH_FAILURE_3DS
3DS authentication, verification, challenge, or authorization failed.

INSUFFICIENT_FUNDS
Customer does not have enough available balance.

UPI_APP_TIMEOUT
UPI application failed to respond or timed out.

BANK_GATEWAY_DOWN
Bank server, payment gateway, or banking infrastructure is unavailable.

TOKENIZATION_ERROR
Card tokenization failed or the payment token is invalid.

RISK_BLOCKED
Transaction was blocked by fraud, risk, security, or compliance systems.

TECHNICAL_ERROR
General gateway, API, infrastructure, or internal technical failure.

UNKNOWN
The available information is insufficient to determine the cause.

Return ONLY valid JSON.

The JSON must have exactly these fields:

{
  "category": "CATEGORY_NAME",
  "confidence": 0.0,
  "reasoning": "short explanation"
}

Rules:

- category must be one of the categories above.
- confidence must be between 0 and 1.
- reasoning must briefly explain why the category was selected.
- Do not include markdown.
- Do not include code fences.
- Do not include additional fields.
`,

        messages: [
          {
            role: 'user',
            content:
              `Payment failure message: ${errorMessage}`
          }
        ]
      });

    /**
     * Claude may return multiple content blocks.
     * We only need the first text block.
     */
    const textBlock =
      response.content.find(
        block => block.type === 'text'
      );

    if (!textBlock || textBlock.type !== 'text') {
      throw new Error(
        'Claude returned no text response'
      );
    }

    let parsed: any;

    try {
      parsed = JSON.parse(
        textBlock.text.trim()
      );
    } catch {
      throw new Error(
        `Claude returned invalid JSON: ${textBlock.text}`
      );
    }

    /**
     * Validate category.
     */
    const isValidCategory =
      Object.values(FailureCategory).includes(
        parsed.category as FailureCategory
      );

    if (!isValidCategory) {
      throw new Error(
        `AI returned invalid category: ${parsed.category}`
      );
    }

    /**
     * Validate confidence.
     */
    const confidence =
      parsed.confidence;

    if (
      typeof confidence !== 'number' ||
      confidence < 0 ||
      confidence > 1
    ) {
      throw new Error(
        `AI returned invalid confidence: ${confidence}`
      );
    }

    /**
     * Validate reasoning.
     */
    if (
      typeof parsed.reasoning !== 'string' ||
      parsed.reasoning.trim().length === 0
    ) {
      throw new Error(
        'AI returned invalid reasoning'
      );
    }

    return {
      category:
        parsed.category as FailureCategory,

      confidence,

      source: 'AI',

      reasoning:
        parsed.reasoning.trim()
    };
  }

  /**
   * Deterministic fallback classification.
   *
   * Used when:
   * - API key is missing
   * - Anthropic API fails
   * - Model request fails
   * - AI response cannot be parsed
   */
  private classifyWithHeuristics(
    errorMessage: string
  ): ForensicResult {
    const msg =
      errorMessage.toLowerCase();

    const mappings: {
      pattern: RegExp;
      category: FailureCategory;
    }[] = [

      {
        pattern:
          /expired|mandate|stale/i,
        category:
          FailureCategory.MANDATE_EXPIRED
      },

      {
        pattern:
          /3ds|3-d secure|auth|authorization|verification|challenge/i,
        category:
          FailureCategory.AUTH_FAILURE_3DS
      },

      {
        pattern:
          /insufficient|balance|funds|low balance/i,
        category:
          FailureCategory.INSUFFICIENT_FUNDS
      },

      {
        pattern:
          /upi timeout|app timeout|app not responding|upi.*timeout/i,
        category:
          FailureCategory.UPI_APP_TIMEOUT
      },

      {
        pattern:
          /gateway down|bank server|system unavailable|maintenance|gateway unavailable/i,
        category:
          FailureCategory.BANK_GATEWAY_DOWN
      },

      {
        pattern:
          /tokenization|token failed|token invalid|invalid token/i,
        category:
          FailureCategory.TOKENIZATION_ERROR
      },

      {
        pattern:
          /fraud|blocked|risk|security|compliance/i,
        category:
          FailureCategory.RISK_BLOCKED
      },

      {
        pattern:
          /error|exception|failed|failure|internal|technical/i,
        category:
          FailureCategory.TECHNICAL_ERROR
      }
    ];

    for (const {
      pattern,
      category
    } of mappings) {

      if (pattern.test(msg)) {
        return {
          category,

          confidence: 0.6,

          source: 'HEURISTIC',

          reasoning:
            `Matched heuristic pattern: ${pattern}`
        };
      }
    }

    return {
      category:
        FailureCategory.UNKNOWN,

      confidence: 0.1,

      source: 'HEURISTIC',

      reasoning:
        'No heuristic patterns matched the payment failure message.'
    };
  }
}