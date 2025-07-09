import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const data = await req.json();
  // Save the resume data here (e.g., to a database)
  return NextResponse.json({ success: true, data });
}
