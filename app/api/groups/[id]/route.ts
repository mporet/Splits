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

    const group = await prisma.expenseGroup.findUnique({ where: { id: groupId } });
    if (!group || group.adminId !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { isClosed } = await req.json();

    const updatedGroup = await prisma.expenseGroup.update({
        where: { id: groupId },
        data: { isClosed }
    });

    return NextResponse.json(updatedGroup);
}
