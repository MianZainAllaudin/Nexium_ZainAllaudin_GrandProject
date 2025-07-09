import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { jobDescription, resumeText } = await request.json();

  // Mock AI logic: Extract keywords & rewrite resume
  const keywords = jobDescription
    .split(/\s+/)
    .filter((word: string) => word.length > 5)
    .slice(0, 5);

  const tailoredResume = `Tailored Resume for: ${keywords.join(
    ", "
  )}\n\n${resumeText}`;

  return NextResponse.json({ tailoredResume });
}
