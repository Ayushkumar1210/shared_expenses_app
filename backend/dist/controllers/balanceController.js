"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGroupBalances = getGroupBalances;
const balanceCalculator_1 = require("../services/balanceCalculator");
async function getGroupBalances(req, res) {
    try {
        const { id: groupId } = req.params;
        const balances = await (0, balanceCalculator_1.calculateBalances)(groupId);
        return res.json(balances);
    }
    catch (error) {
        return res.status(500).json({ error: error.message || 'Internal server error' });
    }
}
