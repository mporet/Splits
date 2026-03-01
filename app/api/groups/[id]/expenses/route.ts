import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

type PayerData = { participantId: string, amountPaid: number };
type SplitData = { participantId: string, amountSplit: number, splitType: "EQUAL" | "EXACT" | "PERCENTAGE", percentage?: number };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const groupId = resolvedParams.id;

    const session = await getServerSession(authOptions);

    const group = await prisma.expenseGroup.findUnique({ where: { id: groupId } });
    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    if (group.isClosed) return NextResponse.json({ error: "Group is closed" }, { status: 400 });

    const isAdmin = session?.user?.id === group.adminId;
    const cookieStore = await cookies();
    const hasAccessCookie = cookieStore.get(`access_group_${groupId}`)?.value === "true";

    if (!isAdmin && !hasAccessCookie) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { description, amount, currency, payers, splits } = await req.json();

        if (!description || !amount || typeof amount !== 'number' || !payers || !splits) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        }

        // Verify amounts match
        const totalPaid = (payers as PayerData[]).reduce((sum, p) => sum + p.amountPaid, 0);
        const totalSplit = (splits as SplitData[]).reduce((sum, s) => sum + s.amountSplit, 0);

        // Allowing 1 cent difference due to rounding errors occasionally in exact calculations from frontend
        if (Math.abs(totalPaid - amount) > 1 || Math.abs(totalSplit - amount) > 1) {
            return NextResponse.json({ error: "Amounts do not add up to total" }, { status: 400 });
        }

        const expense = await prisma.expense.create({
            data: {
                groupId,
                description,
                amount,
                currency: currency || "USD",
                payers: {
                    create: (payers as PayerData[]).map(p => ({
                        participantId: p.participantId,
                        amountPaid: p.amountPaid
                    }))
                },
                splits: {
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

        return NextResponse.json(expense);

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const groupId = resolvedParams.id;
    const url = new URL(req.url);
    const expenseId = url.searchParams.get("expenseId");

    if (!expenseId) return NextResponse.json({ error: "Missing expenseId" }, { status: 400 });

    // Only admin can delete expenses
    const session = await getServerSession(authOptions);
    const group = await prisma.expenseGroup.findUnique({ where: { id: groupId } });

    if (!group || session?.user?.id !== group.adminId) {
        return NextResponse.json({ error: "Forbidden. Only Admin can delete." }, { status: 403 });
    }

    if (group.isClosed) return NextResponse.json({ error: "Group is closed" }, { status: 400 });

    await prisma.expense.delete({ where: { id: expenseId } });

    return NextResponse.json({ success: true });
}
