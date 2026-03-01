import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = await params;
    const groupId = resolvedParams.id;

    try {
        const { passcode } = await req.json();

        const group = await prisma.expenseGroup.findUnique({ where: { id: groupId } });
        if (!group) {
            return NextResponse.json({ error: "Group not found" }, { status: 404 });
        }

        if (group.passcode === passcode) {
            const cookieStore = await cookies();
            cookieStore.set(`access_group_${groupId}`, "true", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
                maxAge: 60 * 60 * 24 * 30 // 30 days
            });
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
        }
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
