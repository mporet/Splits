import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

type PayerData = { participantId: string, amountPaid: number };
type SplitData = { participantId: string, amountSplit: number, splitType: "EQUAL" | "EXACT" | "PERCENTAGE", percentage?: number };

export async function GET(req: Request, { params }: { params: Promise<{ id: string, expenseId: string }> }) {
    const resolvedParams = await params;
    const { id: groupId, expenseId } = resolvedParams;

    const session = await getServerSession(authOptions);
    const cookieStore = await cookies();
    const hasAccessCookie = cookieStore.get(`access_group_${groupId}`)?.value === "true";

    const group = await prisma.expenseGroup.findUnique({
        where: { id: groupId }
    });

    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const isAdmin = session?.user?.id === group.adminId;

    if (!isAdmin && !hasAccessCookie) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const expense = await prisma.expense.findUnique({
        where: { id: expenseId, groupId },
        include: {
            payers: {
                include: { participant: true }
            },
            splits: {
                include: { participant: true }
            }
        }
    });

    if (!expense) return NextResponse.json({ error: "Expense not found" }, { status: 404 });

    return NextResponse.json(expense);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string, expenseId: string }> }) {
    const resolvedParams = await params;
    const { id: groupId, expenseId } = resolvedParams;

    const session = await getServerSession(authOptions);
    const cookieStore = await cookies();
    const hasAccessCookie = cookieStore.get(`access_group_${groupId}`)?.value === "true";

    const group = await prisma.expenseGroup.findUnique({ where: { id: groupId } });
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    if (group.isClosed) return NextResponse.json({ error: "Group is closed" }, { status: 400 });

    const isAdmin = session?.user?.id === group.adminId;

    if (!isAdmin && !hasAccessCookie) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { description, amount, currency, payers, splits } = await req.json();

        if (!description || typeof amount !== 'number' || !payers || !splits) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        // Verify amounts match
        const totalPaid = (payers as PayerData[]).reduce((sum, p) => sum + p.amountPaid, 0);
        const totalSplit = (splits as SplitData[]).reduce((sum, s) => sum + s.amountSplit, 0);

        if (Math.abs(totalPaid - amount) > 1 || Math.abs(totalSplit - amount) > 1) {
            return NextResponse.json({ error: "Amounts do not add up to total" }, { status: 400 });
        }

        // Verify expense exists
        const existingExpense = await prisma.expense.findUnique({ where: { id: expenseId, groupId } });
        if (!existingExpense) {
            return NextResponse.json({ error: "Expense not found" }, { status: 404 });
        }

        const updatedExpense = await prisma.expense.update({
            where: { id: expenseId },
            data: {
                description,
                amount,
                currency: currency || "USD",
                payers: {
                    deleteMany: {},
                    create: (payers as PayerData[]).map(p => ({
                        participantId: p.participantId,
                        amountPaid: p.amountPaid
                    }))
                },
                splits: {
                    deleteMany: {},
                    create: (splits as SplitData[]).map(s => ({
                        participantId: s.participantId,
                        amountSplit: s.amountSplit,
                        splitType: s.splitType,
                        percentage: s.percentage
                    }))
                }
            },
            include: { payers: true, splits: true }
        });

        return NextResponse.json(updatedExpense);

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string, expenseId: string }> }) {
    const resolvedParams = await params;
    const { id: groupId, expenseId } = resolvedParams;

    // Only admin can delete expenses
    const session = await getServerSession(authOptions);
    const group = await prisma.expenseGroup.findUnique({ where: { id: groupId } });

    if (!group || session?.user?.id !== group.adminId) {
        return NextResponse.json({ error: "Forbidden. Only Admin can delete." }, { status: 403 });
    }

    if (group.isClosed) return NextResponse.json({ error: "Group is closed" }, { status: 400 });

    try {
        await prisma.expense.delete({ where: { id: expenseId, groupId } });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to delete expense or it doesn't exist" }, { status: 400 });
    }
}
