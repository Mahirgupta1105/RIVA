import { Request, Response } from 'express';

export class SystemController {
  constructor(private databaseMode: string) {}

  health(req: Request, res: Response) {
    res.json({
      status: 'OK',
      mode: this.databaseMode,
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        ai_engine: 'active',
        recovery_engine: 'active'
      }
    });
  }

  gateways(req: Request, res: Response) {
    res.json([
      {
        name: 'Razorpay',
        status: 'HEALTHY',
        successRate: 0.98,
        latency: '120ms'
      },
      {
        name: 'Stripe',
        status: 'HEALTHY',
        successRate: 0.99,
        latency: '150ms'
      },
      {
        name: 'Cashfree',
        status: 'DEGRADED',
        successRate: 0.85,
        latency: '450ms'
      },
      {
        name: 'PayU',
        status: 'HEALTHY',
        successRate: 0.96,
        latency: '180ms'
      }
    ]);
  }

  runSimulation(req: Request, res: Response) {
    const { scenario } = req.body;

    res.json({
      message: `Scenario ${scenario} initiated`,
      status: 'triggered'
    });
  }
}