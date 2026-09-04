import { Request, Response } from 'express';
import crypto from 'crypto';
import { IIncidentRepository, AuditLog } from '../repositories/IIncidentRepository.js';

export class AuditController {
  constructor(private repository: IIncidentRepository) {}

  /**
   * Creates a deterministic representation of an object.
   *
   * Object keys are sorted recursively so that the same payload
   * always produces the same JSON string regardless of key order.
   */
  private canonicalize(value: any): any {
    if (Array.isArray(value)) {
      return value.map((item) => this.canonicalize(item));
    }

    if (value && typeof value === 'object') {
      return Object.keys(value)
        .sort()
        .reduce((result, key) => {
          result[key] = this.canonicalize(value[key]);
          return result;
        }, {} as Record<string, any>);
    }

    return value;
  }

  async getLatestAuditEntry(req: Request, res: Response) {
    try {
      const entry = await this.repository.getLatestAuditEntry();

      if (!entry) {
        return res.status(404).json({
          error: 'No audit entries found'
        });
      }

      res.json(entry);
    } catch (error: any) {
      res.status(500).json({
        error: error.message
      });
    }
  }

  async getAuditChain(req: Request, res: Response) {
    try {
      const chain = await this.repository.getAuditChain();

      res.json(chain);
    } catch (error: any) {
      res.status(500).json({
        error: error.message
      });
    }
  }

  async createAuditEntry(req: Request, res: Response) {
    try {
      const {
        previousHash,
        hash,
        action,
        actor,
        payload
      } = req.body;

      if (!hash || !action || !actor) {
        return res.status(400).json({
          error: 'hash, action, and actor are required'
        });
      }

     const entry = await this.repository.createAuditEntry({
  previousHash: previousHash ?? null,
  hash,
  action,
  actor,
  payload,
  timestamp: new Date()
});

      res.status(201).json(entry);
    } catch (error: any) {
      res.status(500).json({
        error: error.message
      });
    }
  }

  async verifyAuditChain(req: Request, res: Response) {
    try {
      const logs = await this.repository.getAuditChain();

      /*
       * Legacy entries were created before the RIVA audit-chain
       * format existed. They are reported separately and are not
       * considered part of the cryptographically linked RIVA chain.
       */
      const legacyLogs = logs.filter(
  (log: AuditLog) => !log.previousHash
);

const rivaLogs = logs.filter(
  (log: AuditLog) => !!log.previousHash
);

      const details: any[] = [];

      // ----------------------------------------------------------
      // Legacy records
      // ----------------------------------------------------------

      for (const log of legacyLogs) {
        details.push({
          id: log.id,
          isValid: false,
          status: 'LEGACY',
          reason: 'Missing previousHash'
        });
      }

      // ----------------------------------------------------------
      // RIVA chain
      // ----------------------------------------------------------

      for (let index = 0; index < rivaLogs.length; index++) {
        const log = rivaLogs[index];

        const canonicalPayload =
          this.canonicalize(log.payload);

        const dataToHash =
          `${log.previousHash}|` +
          `${log.action}|` +
          `${JSON.stringify(canonicalPayload)}|` +
          `${new Date(log.timestamp).toISOString()}`;

        const calculatedHash = crypto
          .createHash('sha256')
          .update(dataToHash)
          .digest('hex');

        const hashValid =
          calculatedHash === log.hash;

        /*
         * The first RIVA record links to the most recent
         * audit record that existed when the RIVA chain began.
         *
         * Subsequent RIVA records link to the previous RIVA
         * record's hash.
         */
        const expectedPreviousHash =
          index === 0
            ? legacyLogs.length > 0
              ? legacyLogs[legacyLogs.length - 1].hash
              : '0'.repeat(64)
            : rivaLogs[index - 1].hash;

        const chainValid =
          log.previousHash === expectedPreviousHash;

        details.push({
          id: log.id,
          isValid: hashValid && chainValid,
          status: 'RIVA_CHAIN',
          hashValid,
          chainValid
        });
      }

      const rivaDetails = details.filter(
        (entry) => entry.status === 'RIVA_CHAIN'
      );

      const validRiva =
        rivaDetails.filter(
          (entry) => entry.isValid
        ).length;

      const invalidRiva =
        rivaDetails.filter(
          (entry) => !entry.isValid
        ).length;

      /*
       * allValid refers to the RIVA cryptographic chain.
       *
       * Legacy records are intentionally excluded because
       * they were created before previousHash existed.
       */
      const allValid =
        rivaDetails.length > 0 &&
        rivaDetails.every(
          (entry) => entry.isValid
        );

      res.json({
        allValid,
        total: logs.length,
        valid: validRiva,
        invalid: invalidRiva,
        legacy: legacyLogs.length,
        rivaChain: rivaLogs.length,
        details
      });
    } catch (error: any) {
      res.status(500).json({
        error: error.message
      });
    }
  }
}