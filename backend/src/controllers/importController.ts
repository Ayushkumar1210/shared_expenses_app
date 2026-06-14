import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { prisma } from '../utils/db';
import { detectAnomalies, RawCsvRow } from '../services/anomalyDetector';
import * as Papa from 'papaparse';
import * as fs from 'fs';

export async function uploadAndProcessCsv(req: AuthenticatedRequest, res: Response) {
  try {
    const file = req.file;
    const { groupId } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'Please upload a CSV file.' });
    }
    if (!groupId) {
      return res.status(400).json({ error: 'groupId is required.' });
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        memberships: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!group) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    const csvContent = fs.readFileSync(file.path, 'utf8');

    const parsed = Papa.parse<RawCsvRow>(csvContent, {
      header: true,
      skipEmptyLines: true,
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return res.status(400).json({ error: 'Failed to parse CSV file.' });
    }

    const exRate = await prisma.exchangeRate.findUnique({
      where: { fromCurrency_toCurrency: { fromCurrency: 'USD', toCurrency: 'INR' } },
    });
    const usdRate = exRate ? Number(exRate.rate) : 83.0;

    const existingExpenses = await prisma.expense.findMany({
      where: { groupId },
      include: { payer: { select: { name: true } } },
    });

    const groupMembers = group.memberships.map((m) => ({
      id: m.userId,
      name: m.user.name,
      joinedAt: m.joinedAt,
      leftAt: m.leftAt,
    }));

    const report = detectAnomalies(parsed.data, groupMembers, existingExpenses, usdRate);

    const rawDataJson = JSON.stringify({
      expenses: report.processedExpenses,
      settlements: report.processedSettlements,
    });

    const importJob = await prisma.importJob.create({
      data: {
        groupId,
        fileName: file.originalname,
        status: 'PROCESSED',
        totalRows: report.totalRows,
        importedRows: report.importedRows,
        flaggedRows: report.flaggedRows,
        rawDataJson,
        anomalies: {
          create: report.anomalies.map((anom) => ({
            rowNumber: anom.rowNumber,
            anomalyType: anom.anomalyType,
            severity: anom.severity,
            detectedReason: anom.detectedReason,
            actionTaken: anom.actionTaken,
          })),
        },
      },
      include: {
        anomalies: true,
      },
    });

    try {
      fs.unlinkSync(file.path);
    } catch (err) {
      console.error('Failed to delete temp file:', err);
    }

    return res.json({
      importJobId: importJob.id,
      fileName: importJob.fileName,
      status: importJob.status,
      report: {
        totalRows: report.totalRows,
        importedRows: report.importedRows,
        flaggedRows: report.flaggedRows,
        anomalies: importJob.anomalies,
      },
    });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getImportReport(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const importJob = await prisma.importJob.findUnique({
      where: { id },
      include: {
        anomalies: {
          orderBy: { rowNumber: 'asc' },
        },
      },
    });

    if (!importJob) {
      return res.status(404).json({ error: 'Import job not found' });
    }

    return res.json({
      id: importJob.id,
      groupId: importJob.groupId,
      fileName: importJob.fileName,
      status: importJob.status,
      totalRows: importJob.totalRows,
      importedRows: importJob.importedRows,
      flaggedRows: importJob.flaggedRows,
      anomalies: importJob.anomalies,
      createdAt: importJob.createdAt,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function confirmImport(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const importJob = await prisma.importJob.findUnique({
      where: { id },
    });

    if (!importJob) {
      return res.status(404).json({ error: 'Import job not found' });
    }

    if (importJob.status !== 'PROCESSED') {
      return res.status(400).json({ error: `Cannot confirm import job with status "${importJob.status}".` });
    }

    if (!importJob.rawDataJson) {
      return res.status(400).json({ error: 'No staged import data found.' });
    }

    const { expenses, settlements } = JSON.parse(importJob.rawDataJson);

    await prisma.$transaction(async (tx) => {
      for (const exp of expenses) {
        const createdExp = await tx.expense.create({
          data: {
            groupId: importJob.groupId,
            payerId: exp.payerId,
            amount: exp.amount,
            currency: exp.currency,
            amountINR: exp.amountINR,
            description: exp.description,
            date: new Date(exp.date),
            splitType: exp.splitType,
            importJobId: importJob.id,
          },
        });

        const sharesData = exp.shares.map((share: any) => ({
          expenseId: createdExp.id,
          userId: share.userId,
          originalShare: share.originalShare,
          shareAmountINR: share.shareAmountINR,
        }));

        await tx.expenseShare.createMany({
          data: sharesData,
        });
      }

      for (const set of settlements) {
        await tx.settlement.create({
          data: {
            groupId: importJob.groupId,
            payerId: set.payerId,
            receiverId: set.receiverId,
            amount: set.amount,
            currency: set.currency,
            amountINR: set.amountINR,
            date: new Date(set.date),
            importJobId: importJob.id,
          },
        });
      }

      await tx.importJob.update({
        where: { id: importJob.id },
        data: { status: 'IMPORTED' },
      });
    });

    return res.json({ message: 'Import confirmed and data successfully saved.', status: 'IMPORTED' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to confirm and import data.' });
  }
}
