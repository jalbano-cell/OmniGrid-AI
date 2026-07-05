import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const results = await prisma.business.findMany({
    where: {
      deletedAt: null,
      OR: [
        { name: { contains: q } },
        { city: { contains: q } },
        { industry: { contains: q } },
        { website: { contains: q } },
      ],
    },
    select: { id: true, name: true, city: true, industry: true, status: true },
    take: 8,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ results });
}
