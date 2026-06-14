import * as dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';
import groupRouter from './routes/groups';
import expenseRouter from './routes/expenses';
import settlementRouter from './routes/settlements';
import importRouter from './routes/import';
import exchangeRateRouter from './routes/exchangeRates';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRouter);
app.use('/groups', groupRouter);
app.use('/expenses', expenseRouter);
app.use('/settlements', settlementRouter);
app.use('/import', importRouter);
app.use('/exchange-rates', exchangeRateRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Backend server is running on http://localhost:${PORT}`);
});
