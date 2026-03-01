import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { prisma } from "@/lib/db";
import { generateHumanReadableId } from "@/lib/generateId";

// GET all groups owned by the logged in admin
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const groups = await prisma.expenseGroup.findMany({
        where: { adminId: session.user.id },
        include: {
            _count: {
                select: { participants: true, expenses: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(groups);
}

// POST create a new group
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { name, passcode, participants, finalCurrency, defaultExpenseCurrency } = await req.json();

        if (!name || !passcode || !participants || !Array.isArray(participants)) {
            return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
        }

        let newGroupId = "";
        let isIdUnique = false;
        let attempts = 0;

        while (!isIdUnique && attempts < 5) {
            newGroupId = generateHumanReadableId();
            const existingGroup = await prisma.expenseGroup.findUnique({
                where: { id: newGroupId }
            });
            if (!existingGroup) {
                isIdUnique = true;
            }
            attempts++;
        }

        if (!isIdUnique) {
            return NextResponse.json({ error: "Could not generate a unique group ID. Please try again." }, { status: 500 });
        }

        const newGroup = await prisma.expenseGroup.create({
            data: {
                id: newGroupId,
                name,
                passcode, // Storing in plain text for simplicity of sharing/ad-hoc events (per requirements usually ok for small adhoc apps, but could be hashed. I will leave as plain text for simplicity).
                finalCurrency: finalCurrency || "USD",
                defaultExpenseCurrency: defaultExpenseCurrency || "USD",
                adminId: session.user.id,
                participants: {
                    create: participants.map((pName: string) => ({ name: pName }))
                }
            },
        });

        return NextResponse.json(newGroup);
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
