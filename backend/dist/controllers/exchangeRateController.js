"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExchangeRates = getExchangeRates;
exports.updateExchangeRate = updateExchangeRate;
const db_1 = require("../utils/db");
const zod_1 = require("zod");
const exchangeRateSchema = zod_1.z.object({
    fromCurrency: zod_1.z.string().toUpperCase(),
    toCurrency: zod_1.z.string().toUpperCase(),
    rate: zod_1.z.number().positive(),
});
async function getExchangeRates(req, res) {
    try {
        const rates = await db_1.prisma.exchangeRate.findMany();
        return res.json(rates);
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
}
async function updateExchangeRate(req, res) {
    try {
        const validated = exchangeRateSchema.parse(req.body);
        const rate = await db_1.prisma.exchangeRate.upsert({
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
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
}
