import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { prisma } from '../utils/db';
import { z } from 'zod';

const exchangeRateSchema = z.object({
  fromCurrency: z.string().toUpperCase(),
  toCurrency: z.string().toUpperCase(),
  rate: z.number().positive(),
});

export async function getExchangeRates(req: AuthenticatedRequest, res: Response) {
  try {
    const rates = await prisma.exchangeRate.findMany();
    return res.json(rates);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateExchangeRate(req: AuthenticatedRequest, res: Response) {
  try {
    const validated = exchangeRateSchema.parse(req.body);

    const rate = await prisma.exchangeRate.upsert({
      where: {
        fromCurrency_toCurrency: {
          fromCurrency: validated.fromCurrency,
          toCurrency: validated.toCurrency,
        },
      },
      update: {
        rate: validated.rate,
      },
      create: {
        fromCurrency: validated.fromCurrency,
        toCurrency: validated.toCurrency,
        rate: validated.rate,
      },
    });

    return res.json(rate);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
