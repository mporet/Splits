import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

export async function GET() {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();

    // Find all cookies matching access_group_${id}
    const savedGroupIds = allCookies
        .filter(cookie => cookie.name.startsWith("access_group_") && cookie.value === "true")
        .map(cookie => cookie.name.replace("access_group_", ""));

    if (savedGroupIds.length === 0) {
        return NextResponse.json({ groups: [] });
    }

    try {
        const groups = await prisma.expenseGroup.findMany({
            where: {
                id: { in: savedGroupIds }
            },
            select: {
                id: true,
                name: true,
                isClosed: true
            }
        });

        return NextResponse.json({ groups });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to fetch saved groups" }, { status: 500 });
    }
}
