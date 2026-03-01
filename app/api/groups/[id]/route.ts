import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const groupId = resolvedParams.id;

    // A user can access if they are the admin OR if they have the correct passcode cookie
    const session = await getServerSession(authOptions);

    const cookieStore = await cookies();
    const hasAccessCookie = cookieStore.get(`access_group_${groupId}`)?.value === "true";

    const group = await prisma.expenseGroup.findUnique({
        where: { id: groupId },
        include: {
            participants: true,
            expenses: {
                include: {
                    payers: { include: { participant: true } },
                    splits: { include: { participant: true } }
                },
                orderBy: { createdAt: 'desc' }
            },
        }
    });

    if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const isAdmin = session?.user?.id === group.adminId;

    if (!isAdmin && !hasAccessCookie) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ group, isAdmin });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const groupId = resolvedParams.id;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const group = await prisma.expenseGroup.findUnique({
        where: { id: groupId },
        include: { participants: true }
    });

    if (!group || group.adminId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    // If only isClosed is provided (from the quick close/reopen button)
    if (Object.keys(body).length === 1 && 'isClosed' in body) {
        const updatedGroup = await prisma.expenseGroup.update({
            where: { id: groupId },
            data: { isClosed: body.isClosed }
        });
        return NextResponse.json(updatedGroup);
    }

    // Full update
    const { name, passcode, finalCurrency, defaultExpenseCurrency, participants } = body;

    // Handle participants sync if provided
    if (participants && Array.isArray(participants)) {
        // participants is expected to be array of: { id?: string, name: string, _deleted?: boolean }

        for (const p of participants) {
            if (p._deleted && p.id) {
                // Check if they are part of any expenses before deleting
                const hasExpenses = await prisma.expensePayer.findFirst({ where: { participantId: p.id } });
                const hasSplits = await prisma.expenseSplit.findFirst({ where: { participantId: p.id } });

                if (hasExpenses || hasSplits) {
                    return NextResponse.json({ error: `Cannot remove ${p.name} as they are part of existing expenses. Please remove those expenses first.` }, { status: 400 });
                }

                await prisma.groupParticipant.delete({ where: { id: p.id } });
            } else if (p.id && !p._deleted) {
                // Update existing
                await prisma.groupParticipant.update({
                    where: { id: p.id },
                    data: { name: p.name, venmoUsername: p.venmoUsername || null }
                });
            } else if (!p.id && !p._deleted) {
                // Create new
                await prisma.groupParticipant.create({
                    data: {
                        name: p.name,
                        venmoUsername: p.venmoUsername || null,
                        groupId
                    }
                });
            }
        }
    }

    const updatedGroup = await prisma.expenseGroup.update({
        where: { id: groupId },
        data: {
            name: name ?? group.name,
            passcode: passcode ?? group.passcode,
            finalCurrency: finalCurrency ?? group.finalCurrency,
            defaultExpenseCurrency: defaultExpenseCurrency ?? group.defaultExpenseCurrency
        }
    });

    return NextResponse.json(updatedGroup);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const groupId = resolvedParams.id;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const group = await prisma.expenseGroup.findUnique({ where: { id: groupId } });
    if (!group || group.adminId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.expenseGroup.delete({ where: { id: groupId } });
    return NextResponse.json({ success: true });
}
