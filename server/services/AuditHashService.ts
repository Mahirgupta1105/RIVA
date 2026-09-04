import crypto from 'crypto';

export class AuditHashService {
  /**
   * Recursively sorts object keys to produce deterministic JSON.
   */
  static canonicalize(value: any): any {
    if (Array.isArray(value)) {
      return value.map((item) =>
        AuditHashService.canonicalize(item)
      );
    }

    if (value && typeof value === 'object') {
      return Object.keys(value)
        .sort()
        .reduce((result, key) => {
          result[key] =
            AuditHashService.canonicalize(value[key]);

          return result;
        }, {} as Record<string, any>);
    }

    return value;
  }

  /**
   * Creates the exact string used for hashing an audit entry.
   */
  static buildHashInput(
    previousHash: string,
    action: string,
    payload: any,
    timestamp: string
  ): string {
    const canonicalPayload =
      AuditHashService.canonicalize(payload);

    return (
      `${previousHash}|` +
      `${action}|` +
      `${JSON.stringify(canonicalPayload)}|` +
      `${timestamp}`
    );
  }

  /**
   * Generates the SHA-256 hash for an audit entry.
   */
  static generateHash(
    previousHash: string,
    action: string,
    payload: any,
    timestamp: string
  ): string {
    const dataToHash =
      AuditHashService.buildHashInput(
        previousHash,
        action,
        payload,
        timestamp
      );

    return crypto
      .createHash('sha256')
      .update(dataToHash)
      .digest('hex');
  }
}