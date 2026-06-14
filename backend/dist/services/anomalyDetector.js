"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectAnomalies = detectAnomalies;
const splitCalculator_1 = require("../utils/splitCalculator");
function detectAnomalies(rows, members, existingExpenses, usdRate) {
    const anomalies = [];
    const processedExpenses = [];
    const processedSettlements = [];
    const round2 = (num) => Math.round((num + Number.EPSILON) * 100) / 100;
    const toNumber = (val) => {
        if (!val)
            return 0;
        return typeof val.toNumber === 'function' ? val.toNumber() : Number(val);
    };
    // Determine overall date format patterns in the file
    let hasFirstFieldDay = false; // E.g., 15/04/2026 -> first field > 12
    let hasSecondFieldDay = false; // E.g., 04/15/2026 -> second field > 12
    rows.forEach((row) => {
        const dateStr = row.date?.trim();
        if (dateStr) {
            const parts = dateStr.split(/[-/]/);
            if (parts.length === 3) {
                // Assume format is either D/M/Y or M/D/Y (Year is at the end or start)
                const first = parseInt(parts[0], 10);
                const second = parseInt(parts[1], 10);
                const third = parseInt(parts[2], 10);
                if (third > 1000) {
                    // Year is at end: first and second are day/month
                    if (first > 12 && first <= 31)
                        hasFirstFieldDay = true;
                    if (second > 12 && second <= 31)
                        hasSecondFieldDay = true;
                }
            }
        }
    });
    const assumedFormat = hasSecondFieldDay && !hasFirstFieldDay ? 'MM/DD/YYYY' : 'DD/MM/YYYY';
    // Helper to parse dates based on assumed format and check ambiguity
    const parseDateString = (dateStr, rowIdx) => {
        if (!dateStr || dateStr.trim() === '') {
            return { date: null, isAmbiguous: false, error: 'Date is missing.' };
        }
        const trimmed = dateStr.trim();
        // Check if ISO format YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            const d = new Date(trimmed);
            if (isNaN(d.getTime())) {
                return { date: null, isAmbiguous: false, error: `Invalid date format: ${trimmed}` };
            }
            return { date: d, isAmbiguous: false, error: null };
        }
        const parts = trimmed.split(/[-/]/);
        if (parts.length !== 3) {
            return { date: null, isAmbiguous: false, error: `Invalid date separator/parts: ${trimmed}` };
        }
        const first = parseInt(parts[0], 10);
        const second = parseInt(parts[1], 10);
        const third = parseInt(parts[2], 10);
        if (isNaN(first) || isNaN(second) || isNaN(third)) {
            return { date: null, isAmbiguous: false, error: `Non-numeric date components: ${trimmed}` };
        }
        let year = third;
        let month = 0;
        let day = 1;
        // Standardize 2-digit years
        if (year < 100)
            year += 2000;
        let isAmbiguous = false;
        if (first <= 12 && second <= 12) {
            isAmbiguous = true;
        }
        if (assumedFormat === 'MM/DD/YYYY') {
            month = first - 1;
            day = second;
        }
        else {
            month = second - 1;
            day = first;
        }
        const d = new Date(Date.UTC(year, month, day));
        if (isNaN(d.getTime()) || d.getUTCDate() !== day || d.getUTCMonth() !== month) {
            return { date: null, isAmbiguous: false, error: `Invalid calendar date: ${trimmed}` };
        }
        return { date: d, isAmbiguous, error: null };
    };
    // Helper to normalize member names
    const matchMember = (nameStr) => {
        if (!nameStr || nameStr.trim() === '')
            return { member: null, isNormalized: false };
        const cleaned = nameStr.trim().toLowerCase();
        // 1. Exact match
        const exact = members.find((m) => m.name.toLowerCase() === cleaned);
        if (exact) {
            return { member: exact, isNormalized: exact.name !== nameStr.trim() };
        }
        // 2. Contains / Starts with match (e.g. "Rohan K" matches "Rohan" in DB, or vice versa)
        const partial = members.find((m) => cleaned.startsWith(m.name.toLowerCase()) ||
            m.name.toLowerCase().startsWith(cleaned));
        if (partial) {
            return { member: partial, isNormalized: true };
        }
        return { member: null, isNormalized: false };
    };
    // Process rows
    rows.forEach((row, idx) => {
        const rowNum = idx + 1;
        let hasCriticalError = false;
        // 1. Missing Payer (Rule 2)
        const rawPayer = row.payer;
        const { member: payer, isNormalized: payerNormalized } = matchMember(rawPayer);
        if (!rawPayer || rawPayer.trim() === '') {
            anomalies.push({
                rowNumber: rowNum,
                anomalyType: 'MISSING_PAYER',
                severity: 'ERROR',
                detectedReason: 'Payer column is blank or empty.',
                actionTaken: 'Skipped row import.',
            });
            hasCriticalError = true;
        }
        else if (!payer) {
            anomalies.push({
                rowNumber: rowNum,
                anomalyType: 'MISSING_PAYER',
                severity: 'ERROR',
                detectedReason: `Payer "${rawPayer}" could not be matched to any group member.`,
                actionTaken: 'Skipped row import.',
            });
            hasCriticalError = true;
        }
        // 2. Missing Currency & Currency Mismatch (Rule 3, Rule 15)
        let currency = row.currency?.trim().toUpperCase();
        if (!currency || currency === '') {
            anomalies.push({
                rowNumber: rowNum,
                anomalyType: 'MISSING_CURRENCY',
                severity: 'WARNING',
                detectedReason: 'Currency column is blank.',
                actionTaken: 'Assumed INR default currency.',
            });
            currency = 'INR';
        }
        else if (currency !== 'INR' && currency !== 'USD') {
            anomalies.push({
                rowNumber: rowNum,
                anomalyType: 'CURRENCY_MISMATCH',
                severity: 'ERROR',
                detectedReason: `Currency "${currency}" is not supported (only INR/USD).`,
                actionTaken: 'Skipped row import.',
            });
            hasCriticalError = true;
        }
        // 3. Negative & Zero amounts (Rule 4, Rule 5)
        let rawAmount = row.amount;
        let amount = parseFloat(rawAmount || '');
        if (isNaN(amount)) {
            anomalies.push({
                rowNumber: rowNum,
                anomalyType: 'INVALID_AMOUNT',
                severity: 'ERROR',
                detectedReason: `Amount "${rawAmount}" is not a valid number.`,
                actionTaken: 'Skipped row import.',
            });
            hasCriticalError = true;
        }
        else if (amount < 0) {
            anomalies.push({
                rowNumber: rowNum,
                anomalyType: 'NEGATIVE_AMOUNT',
                severity: 'ERROR',
                detectedReason: `Amount (${amount}) is negative.`,
                actionTaken: 'Skipped row import.',
            });
            hasCriticalError = true;
        }
        else if (amount === 0) {
            anomalies.push({
                rowNumber: rowNum,
                anomalyType: 'ZERO_AMOUNT',
                severity: 'ERROR',
                detectedReason: 'Amount is exactly zero.',
                actionTaken: 'Skipped row import.',
            });
            hasCriticalError = true;
        }
        // 4. Date parsing & Ambiguity (Rule 6, Rule 7)
        const { date, isAmbiguous, error: dateError } = parseDateString(row.date, rowNum);
        if (dateError || !date) {
            anomalies.push({
                rowNumber: rowNum,
                anomalyType: 'INVALID_DATE',
                severity: 'ERROR',
                detectedReason: dateError || 'Invalid Date.',
                actionTaken: 'Skipped row import.',
            });
            hasCriticalError = true;
        }
        else {
            if (date > new Date()) {
                anomalies.push({
                    rowNumber: rowNum,
                    anomalyType: 'INVALID_DATE',
                    severity: 'ERROR',
                    detectedReason: `Expense date ${date.toISOString().split('T')[0]} is in the future.`,
                    actionTaken: 'Skipped row import.',
                });
                hasCriticalError = true;
            }
            if (isAmbiguous) {
                anomalies.push({
                    rowNumber: rowNum,
                    anomalyType: 'AMBIGUOUS_DATE',
                    severity: 'INFO',
                    detectedReason: `Date "${row.date}" could be interpreted as DD/MM/YYYY or MM/DD/YYYY.`,
                    actionTaken: `Parsed using file pattern (${assumedFormat}): ${date.toISOString().split('T')[0]}`,
                });
            }
        }
        // 5. Name Normalization Logging (Rule 8)
        if (payer && payerNormalized) {
            anomalies.push({
                rowNumber: rowNum,
                anomalyType: 'NAME_NORMALIZATION',
                severity: 'INFO',
                detectedReason: `Payer name "${rawPayer}" matches member "${payer.name}".`,
                actionTaken: `Normalized payer name to "${payer.name}".`,
            });
        }
        // Stop checking member timelines/splits if we have critical errors so far
        if (hasCriticalError || !date || !payer || isNaN(amount)) {
            return; // move to next row
        }
        // 6. Member joining/leaving validations (Rule 13, Rule 14)
        const checkUserInTimeline = (user, d, role) => {
            const expTime = d.getTime();
            const joinTime = new Date(user.joinedAt).getTime();
            if (expTime < joinTime) {
                anomalies.push({
                    rowNumber: rowNum,
                    anomalyType: 'MEMBER_BEFORE_JOINING',
                    severity: 'ERROR',
                    detectedReason: `Member ${user.name} was included as ${role} on ${d.toISOString().split('T')[0]} but joined group on ${new Date(user.joinedAt).toISOString().split('T')[0]}.`,
                    actionTaken: 'Skipped row import.',
                });
                return false;
            }
            if (user.leftAt) {
                const leftTime = new Date(user.leftAt).getTime();
                if (expTime > leftTime) {
                    anomalies.push({
                        rowNumber: rowNum,
                        anomalyType: 'MEMBER_AFTER_LEAVING',
                        severity: 'ERROR',
                        detectedReason: `Member ${user.name} was included as ${role} on ${d.toISOString().split('T')[0]} but left group on ${new Date(user.leftAt).toISOString().split('T')[0]}.`,
                        actionTaken: 'Skipped row import.',
                    });
                    return false;
                }
            }
            return true;
        };
        const isPayerActive = checkUserInTimeline(payer, date, 'payer');
        if (!isPayerActive) {
            hasCriticalError = true;
        }
        // 7. Parse splits and validate shares
        let splitType = row.splitType?.trim().toUpperCase() || 'EQUAL';
        if (!['EQUAL', 'EXACT', 'PERCENTAGE', 'WEIGHTED'].includes(splitType)) {
            anomalies.push({
                rowNumber: rowNum,
                anomalyType: 'SPLIT_TYPE_MISMATCH',
                severity: 'ERROR',
                detectedReason: `Invalid split type: "${splitType}"`,
                actionTaken: 'Skipped row import.',
            });
            hasCriticalError = true;
            return;
        }
        // Parse splits string (e.g., "Aisha:50, Rohan:50" or just names "Aisha, Rohan")
        const splitsStr = row.splits?.trim() || '';
        const rawSplits = [];
        if (splitsStr === '') {
            // If splits is blank, default to EQUAL split amongst all active members of the group on the expense date!
            // This is dynamic. Let's see who was a member.
            const activeMembersOnDate = members.filter((m) => {
                const expTime = date.getTime();
                const joinTime = new Date(m.joinedAt).getTime();
                if (expTime < joinTime)
                    return false;
                if (m.leftAt && expTime > new Date(m.leftAt).getTime())
                    return false;
                return true;
            });
            if (activeMembersOnDate.length === 0) {
                anomalies.push({
                    rowNumber: rowNum,
                    anomalyType: 'SPLIT_TYPE_MISMATCH',
                    severity: 'ERROR',
                    detectedReason: 'No active members in group on this expense date.',
                    actionTaken: 'Skipped row import.',
                });
                hasCriticalError = true;
            }
            else {
                activeMembersOnDate.forEach((m) => {
                    rawSplits.push({ rawName: m.name, value: 1 });
                });
                anomalies.push({
                    rowNumber: rowNum,
                    anomalyType: 'SPLIT_TYPE_MISMATCH',
                    severity: 'INFO',
                    detectedReason: 'Splits column was blank.',
                    actionTaken: 'Defaulted to equal split among all active group members.',
                });
            }
        }
        else {
            const parts = splitsStr.split(',');
            parts.forEach((p) => {
                const splitPart = p.trim();
                if (splitPart === '')
                    return;
                const colonIdx = splitPart.indexOf(':');
                if (colonIdx === -1) {
                    // Just a name (e.g. EQUAL splits)
                    rawSplits.push({ rawName: splitPart, value: 1 });
                }
                else {
                    const name = splitPart.substring(0, colonIdx).trim();
                    const val = parseFloat(splitPart.substring(colonIdx + 1).trim());
                    rawSplits.push({ rawName: name, value: isNaN(val) ? 1 : val });
                }
            });
        }
        if (hasCriticalError)
            return;
        // Verify split names and timelines
        const parsedShares = [];
        for (const rawSplit of rawSplits) {
            const { member: splitUser, isNormalized: splitUserNormalized } = matchMember(rawSplit.rawName);
            if (!splitUser) {
                anomalies.push({
                    rowNumber: rowNum,
                    anomalyType: 'SPLIT_TYPE_MISMATCH',
                    severity: 'ERROR',
                    detectedReason: `Split participant "${rawSplit.rawName}" is not a group member.`,
                    actionTaken: 'Skipped row import.',
                });
                hasCriticalError = true;
                break;
            }
            if (splitUserNormalized) {
                anomalies.push({
                    rowNumber: rowNum,
                    anomalyType: 'NAME_NORMALIZATION',
                    severity: 'INFO',
                    detectedReason: `Split participant "${rawSplit.rawName}" normalized to "${splitUser.name}".`,
                    actionTaken: `Normalized participant name.`,
                });
            }
            // Check participant timelines
            const isPartActive = checkUserInTimeline(splitUser, date, 'participant');
            if (!isPartActive) {
                hasCriticalError = true;
                break;
            }
            parsedShares.push({ user: splitUser, value: rawSplit.value });
        }
        if (hasCriticalError)
            return;
        // Validate splits math
        let shareAmountINR = 0;
        const finalShares = [];
        const exchangeRate = currency === 'USD' ? usdRate : 1.0;
        try {
            if (splitType === 'PERCENTAGE') {
                const totalPct = parsedShares.reduce((sum, item) => sum + item.value, 0);
                if (Math.abs(totalPct - 100) > 0.01) {
                    anomalies.push({
                        rowNumber: rowNum,
                        anomalyType: 'PERCENTAGE_NOT_100',
                        severity: 'ERROR',
                        detectedReason: `Percentages sum to ${totalPct}%, which is not 100%.`,
                        actionTaken: 'Skipped row import.',
                    });
                    hasCriticalError = true;
                    return;
                }
            }
            else if (splitType === 'WEIGHTED') {
                const hasInvalidWeights = parsedShares.some((item) => item.value <= 0);
                if (hasInvalidWeights) {
                    anomalies.push({
                        rowNumber: rowNum,
                        anomalyType: 'INVALID_WEIGHTED_SPLIT',
                        severity: 'ERROR',
                        detectedReason: 'Weighted splits contain negative or zero weights.',
                        actionTaken: 'Skipped row import.',
                    });
                    hasCriticalError = true;
                    return;
                }
            }
            // Calculate the splits
            const splitInputs = parsedShares.map((ps) => ({ userId: ps.user.id, value: ps.value }));
            const calculated = (0, splitCalculator_1.calculateSplits)(amount, splitType, splitInputs);
            calculated.forEach((cs) => {
                const userObj = parsedShares.find((ps) => ps.user.id === cs.userId).user;
                finalShares.push({
                    userId: cs.userId,
                    userName: userObj.name,
                    originalShare: cs.originalShare,
                    shareAmount: cs.shareAmount,
                    shareAmountINR: round2(cs.shareAmount * exchangeRate),
                });
            });
        }
        catch (e) {
            anomalies.push({
                rowNumber: rowNum,
                anomalyType: 'SPLIT_TYPE_MISMATCH',
                severity: 'ERROR',
                detectedReason: e.message || 'Math splits failure.',
                actionTaken: 'Skipped row import.',
            });
            hasCriticalError = true;
            return;
        }
        if (hasCriticalError)
            return;
        // 8. Settlement Recorded as Expense (Rule 9)
        const isSettlementDescription = row.description?.toLowerCase().includes('settle') ||
            row.description?.toLowerCase().includes('payment') ||
            row.description?.toLowerCase().includes('paid back') ||
            row.description?.toLowerCase().includes('refund') ||
            row.description?.toLowerCase().includes('transfer');
        const isOneToOne = finalShares.length === 1 && finalShares[0].userId !== payer.id;
        if (isSettlementDescription || (isOneToOne && splitType === 'EXACT')) {
            // Flag as settlement. In this case, we stage it for Import as a SETTLEMENT instead of an Expense!
            anomalies.push({
                rowNumber: rowNum,
                anomalyType: 'SETTLEMENT_AS_EXPENSE',
                severity: 'WARNING',
                detectedReason: `Description "${row.description}" or exact 1-to-1 split suggests this is a debt settlement.`,
                actionTaken: 'Staged for import as a Settlement record instead of an Expense record.',
            });
            processedSettlements.push({
                rowNumber: rowNum,
                payerId: payer.id,
                payerName: payer.name,
                receiverId: finalShares[0]?.userId || payer.id,
                receiverName: finalShares[0]?.userName || payer.name,
                amount: amount,
                currency: currency,
                amountINR: round2(amount * exchangeRate),
                date: date,
            });
            return;
        }
        // 9. Duplicate Expenses (Rule 1)
        const amountINR = round2(amount * exchangeRate);
        const isDuplicate = existingExpenses.some((e) => {
            const dateMatches = e.date.toISOString().split('T')[0] === date.toISOString().split('T')[0];
            const payerMatches = e.payer.name.toLowerCase() === payer.name.toLowerCase();
            const amountMatches = Math.abs(toNumber(e.amountINR) - amountINR) < 0.05;
            const descMatches = e.description.toLowerCase().trim() === row.description?.toLowerCase().trim();
            return dateMatches && payerMatches && amountMatches && descMatches;
        });
        if (isDuplicate) {
            anomalies.push({
                rowNumber: rowNum,
                anomalyType: 'DUPLICATE_EXPENSE',
                severity: 'WARNING',
                detectedReason: `Expense details match another record: ${row.description} paid by ${payer.name} on ${date.toISOString().split('T')[0]}.`,
                actionTaken: 'Allowed import, but marked as warning (potential duplicate).',
            });
        }
        // Store processed expense
        processedExpenses.push({
            rowNumber: rowNum,
            payerId: payer.id,
            payerName: payer.name,
            amount: amount,
            currency: currency,
            amountINR: amountINR,
            description: row.description || 'Imported Expense',
            date: date,
            splitType: splitType,
            shares: finalShares,
        });
    });
    const totalRows = rows.length;
    const flaggedRows = Array.from(new Set(anomalies.map((a) => a.rowNumber))).length;
    const importedRows = totalRows - Array.from(new Set(anomalies.filter((a) => a.severity === 'ERROR').map((a) => a.rowNumber))).length;
    return {
        totalRows,
        importedRows,
        flaggedRows,
        anomalies,
        processedExpenses,
        processedSettlements,
    };
}
