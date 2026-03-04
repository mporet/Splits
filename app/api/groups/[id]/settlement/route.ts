import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { calculateSettlement } from "@/lib/calculateSettlement";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const group = await prisma.expenseGroup.findUnique({
        where: { id },
        include: {
            participants: true,
            expenses: {
                include: { payers: true, splits: true }
            },
            debts: true
        }
    });

    if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (group.isClosed && group.settlementData) {
        const settlementData = JSON.parse(group.settlementData);
        const transactions = group.debts.map((d: any) => ({
            id: d.id,
            from: d.fromId,
            to: d.toId,
            amount: d.amount,
            isPaid: d.isPaid
        }));

        return NextResponse.json({
            group,
            ...settlementData,
            transactions
        });
    }

    // Dynamic calculation for open groups
    const result = await calculateSettlement(group as any);

    return NextResponse.json({
        group,
        ...result
    });
}
