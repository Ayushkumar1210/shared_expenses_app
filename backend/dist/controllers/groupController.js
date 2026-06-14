"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGroup = createGroup;
exports.getGroups = getGroups;
exports.getGroupById = getGroupById;
exports.joinGroup = joinGroup;
exports.leaveGroup = leaveGroup;
const db_1 = require("../utils/db");
const zod_1 = require("zod");
const groupSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    description: zod_1.z.string().optional(),
});
async function createGroup(req, res) {
    try {
        if (!req.userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const validated = groupSchema.parse(req.body);
        const group = await db_1.prisma.group.create({
            data: {
                name: validated.name,
                description: validated.description,
                memberships: {
                    create: {
                        userId: req.userId,
                        joinedAt: new Date(),
                    },
                },
            },
            include: {
                memberships: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                },
            },
        });
        return res.status(201).json(group);
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors[0].message });
        }
        return res.status(500).json({ error: 'Internal server error' });
    }
}
async function getGroups(req, res) {
    try {
        if (!req.userId)
            return res.status(401).json({ error: 'Unauthorized' });
        // Find groups where the user is currently or has been a member
        const memberships = await db_1.prisma.membership.findMany({
            where: { userId: req.userId },
            include: {
                group: {
                    include: {
                        memberships: {
                            include: {
                                user: {
                                    select: { id: true, name: true, email: true },
                                },
                            },
                        },
                    },
                },
            },
        });
        // Map to return distinct groups
        const groupsMap = new Map();
        memberships.forEach((m) => {
            groupsMap.set(m.group.id, m.group);
        });
        return res.json(Array.from(groupsMap.values()));
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
}
async function getGroupById(req, res) {
    try {
        const { id } = req.params;
        const group = await db_1.prisma.group.findUnique({
            where: { id },
            include: {
                memberships: {
                    include: {
                        user: {
                            select: { id: true, name: true, email: true },
                        },
                    },
                    orderBy: { joinedAt: 'asc' },
                },
            },
        });
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        return res.json(group);
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
}
async function joinGroup(req, res) {
    try {
        if (!req.userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { id: groupId } = req.params;
        // Check if group exists
        const group = await db_1.prisma.group.findUnique({ where: { id: groupId } });
        if (!group)
            return res.status(404).json({ error: 'Group not found' });
        // Check active membership
        const activeMembership = await db_1.prisma.membership.findFirst({
            where: {
                groupId,
                userId: req.userId,
                leftAt: null,
            },
        });
        if (activeMembership) {
            return res.status(400).json({ error: 'You are already an active member of this group.' });
        }
        const membership = await db_1.prisma.membership.create({
            data: {
                userId: req.userId,
                groupId,
                joinedAt: new Date(),
            },
        });
        return res.status(201).json(membership);
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
}
async function leaveGroup(req, res) {
    try {
        if (!req.userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { id: groupId } = req.params;
        const { date } = req.body;
        const activeMembership = await db_1.prisma.membership.findFirst({
            where: {
                groupId,
                userId: req.userId,
                leftAt: null,
            },
        });
        if (!activeMembership) {
            return res.status(400).json({ error: 'You are not an active member of this group.' });
        }
        const leaveDate = date ? new Date(date) : new Date();
        if (leaveDate < activeMembership.joinedAt) {
            return res.status(400).json({ error: 'Leave date cannot be before join date.' });
        }
        const updated = await db_1.prisma.membership.update({
            where: { id: activeMembership.id },
            data: { leftAt: leaveDate },
        });
        return res.json(updated);
    }
    catch (error) {
        return res.status(500).json({ error: 'Internal server error' });
    }
}
