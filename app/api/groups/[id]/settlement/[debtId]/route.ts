import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string, debtId: string }> }) {
    const resolvedParams = await params;
    const { id: groupId, debtId } = resolvedParams;

    // Check access
    const session = await getServerSession(authOptions);
    const cookieStore = await cookies();
    const hasAccessCookie = cookieStore.get(`access_group_${groupId}`)?.value === "true";

    if (!session?.user?.id && !hasAccessCookie) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const group = await prisma.expenseGroup.findUnique({
        where: { id: groupId },
    });

    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const isAdmin = session?.user?.id === group.adminId;
    const body = await req.json();

    if ('isPaid' in body) {
        // Any participant can mark as paid. Only admin can unmark.
        if (body.isPaid === false && !isAdmin) {
            return NextResponse.json({ error: "Only admin can unmark as paid" }, { status: 403 });
        }

        const updatedDebt = await prisma.settlementDebt.update({
            where: { id: debtId, groupId },
            data: { isPaid: body.isPaid }
        });

        return NextResponse.json(updatedDebt);
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}
