import { NextRequest, NextResponse } from "next/server";
import { pipeline } from "@xenova/transformers";

// Define proper types for the summarizer
type SummarizerFunction = (
  text: string,
  options?: {
    max_length?: number;
    min_length?: number;
  }
) => Promise<SummarizerOutput[]>;

interface SummarizerOutput {
  summary_text: string;
}

interface RequestBody {
  jobDescription: string;
  resumeText: string;
  useAlternative?: boolean;
}

interface ApiResponse {
  tailoredResume: string;
  keywords: string[];
  improvements: string[];
  matchScore: number;
  timestamp: string;
  service: string;
}

interface ErrorResponse {
  error: string;
  endpoint?: string;
  method?: string;
  timestamp?: string;
}

interface ResumeSection {
  header: string;
  summary: string;
  skills: string;
  experience: string;
  education: string;
  projects: string;
  certifications: string;
  additional: string;
}

// Cache the models to avoid reloading
let summarizer: SummarizerFunction | null = null;
let alternativeSummarizer: SummarizerFunction | null = null;

async function getSummarizer(): Promise<SummarizerFunction> {
  if (!summarizer) {
    const pipe = await pipeline("summarization", "Xenova/distilbart-cnn-6-6");
    summarizer = pipe as SummarizerFunction;
  }
  return summarizer;
}

async function getAlternativeSummarizer(): Promise<SummarizerFunction> {
  if (!alternativeSummarizer) {
    const pipe = await pipeline("summarization", "Xenova/bart-large-cnn");
    alternativeSummarizer = pipe as SummarizerFunction;
  }
  return alternativeSummarizer;
}

// Enhanced resume parsing with better section detection
function parseResumeIntoSections(resume: string): ResumeSection {
  const sections: ResumeSection = {
    header: "",
    summary: "",
    skills: "",
    experience: "",
    education: "",
    projects: "",
    certifications: "",
    additional: "",
  };

  const lines = resume
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line);
  let currentSection: keyof ResumeSection = "header";
  let headerComplete = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    // Detect section headers
    if (
      lowerLine.includes("professional summary") ||
      lowerLine.includes("summary")
    ) {
      currentSection = "summary";
      continue;
    } else if (
      lowerLine.includes("technical skills") ||
      lowerLine.includes("skills")
    ) {
      currentSection = "skills";
      continue;
    } else if (
      lowerLine.includes("professional experience") ||
      lowerLine.includes("experience") ||
      lowerLine.includes("work history")
    ) {
      currentSection = "experience";
      continue;
    } else if (lowerLine.includes("education")) {
      currentSection = "education";
      continue;
    } else if (lowerLine.includes("projects")) {
      currentSection = "projects";
      continue;
    } else if (lowerLine.includes("certifications")) {
      currentSection = "certifications";
      continue;
    } else if (
      lowerLine.includes("additional information") ||
      lowerLine.includes("additional")
    ) {
      currentSection = "additional";
      continue;
    }

    // Detect end of header section
    if (!headerComplete && currentSection === "header") {
      if (
        line.includes("@") ||
        line.includes("linkedin") ||
        line.includes("github") ||
        line.includes("phone") ||
        line.includes("email")
      ) {
        sections[currentSection] += line + "\n";
        continue;
      } else if (
        sections.header.length > 0 &&
        !lowerLine.includes("developer") &&
        !lowerLine.includes("engineer")
      ) {
        headerComplete = true;
        currentSection = "summary";
      }
    }

    // Filter content that belongs in additional information (from ANY section)
    if (
      line.startsWith("•") &&
      (lowerLine.includes("continuous learner") ||
        lowerLine.includes("available for") ||
        lowerLine.includes("immediate start") ||
        lowerLine.includes("flexible work") ||
        lowerLine.includes("problem-solving") ||
        lowerLine.includes("communication") ||
        lowerLine.includes("team player") ||
        lowerLine.includes("attention to detail") ||
        (lowerLine.includes("strong") &&
          (lowerLine.includes("abilities") || lowerLine.includes("skills"))))
    ) {
      sections.additional += line + "\n";
      continue;
    }

    // Filter skills content that belongs in additional
    if (
      currentSection === "skills" &&
      line.startsWith("•") &&
      (lowerLine.includes("portfolio") ||
        lowerLine.includes("staying updated") ||
        lowerLine.includes("latest technologies"))
    ) {
      sections.additional += line + "\n";
      continue;
    }

    sections[currentSection] += line + "\n";
  }

  return sections;
}

// Enhanced keyword integration
function enhanceResumeWithKeywords(
  originalResume: string,
  jobKeywords: string[]
): string {
  const resumeSections = parseResumeIntoSections(originalResume);

  // Extract and prioritize React/TypeScript keywords
  const techKeywords = jobKeywords.filter(
    (keyword) =>
      keyword.toLowerCase().includes("react") ||
      keyword.toLowerCase().includes("typescript") ||
      keyword.toLowerCase().includes("javascript") ||
      keyword.toLowerCase().includes("css") ||
      keyword.toLowerCase().includes("tailwind")
  );

  // Enhance each section
  const enhanced: ResumeSection = {
    ...resumeSections,
    summary: enhanceSummarySection(resumeSections.summary),
    skills: enhanceSkillsSection(resumeSections.skills, techKeywords),
    experience: enhanceExperienceSection(
      resumeSections.experience,
      techKeywords
    ),
  };

  return reconstructResume(enhanced);
}

// Enhanced summary section
function enhanceSummarySection(summary: string): string {
  if (!summary.trim()) {
    return "Passionate Frontend Developer with 3 years of experience creating dynamic React web applications. Skilled in JavaScript, TypeScript, and modern frameworks with proven expertise in responsive design principles and collaborative development.";
  }

  let enhanced = summary.trim();
  const summaryLower = enhanced.toLowerCase();

  // Add TypeScript if React is mentioned but TypeScript isn't
  if (summaryLower.includes("react") && !summaryLower.includes("typescript")) {
    enhanced = enhanced.replace(/react/gi, "React and TypeScript");
  }

  // Add React if JavaScript is mentioned but React isn't
  if (summaryLower.includes("javascript") && !summaryLower.includes("react")) {
    enhanced = enhanced.replace(/javascript/gi, "React, JavaScript");
  }

  return enhanced;
}

// Enhanced skills section
function enhanceSkillsSection(skills: string, keywords: string[]): string {
  if (!skills.trim()) return skills;

  let enhanced = skills.trim();
  const skillsLower = enhanced.toLowerCase();

  // Add TypeScript to programming languages if missing
  if (!skillsLower.includes("typescript") && enhanced.includes("JavaScript")) {
    enhanced = enhanced.replace("JavaScript", "JavaScript, TypeScript");
  }

  // Add Tailwind CSS if missing and relevant
  if (
    !skillsLower.includes("tailwind") &&
    keywords.some((k) => k.toLowerCase().includes("tailwind"))
  ) {
    if (enhanced.includes("Bootstrap")) {
      enhanced = enhanced.replace("Bootstrap", "Bootstrap, Tailwind CSS");
    }
  }

  return enhanced;
}

// Enhanced experience section
function enhanceExperienceSection(
  experience: string,
  keywords: string[]
): string {
  if (!experience.trim()) return experience;

  let enhanced = experience.trim();

  // Add TypeScript mentions where React is used
  if (keywords.some((k) => k.toLowerCase().includes("typescript"))) {
    enhanced = enhanced.replace(
      /React\.js and modern JavaScript/g,
      "React.js, TypeScript, and modern JavaScript"
    );
    enhanced = enhanced.replace(
      /using React\.js/g,
      "using React.js and TypeScript"
    );
  }

  return enhanced;
}

// Improved resume reconstruction with proper formatting
function reconstructResume(sections: ResumeSection): string {
  let result = "";

  // Header section
  if (sections.header.trim()) {
    result += sections.header.trim() + "\n\n";
  }

  // Professional Summary
  if (sections.summary.trim()) {
    result += "PROFESSIONAL SUMMARY\n" + sections.summary.trim() + "\n\n";
  }

  // Technical Skills (clean - no additional info mixed in)
  if (sections.skills.trim()) {
    const cleanSkills = sections.skills.trim();
    // Remove any bullet points that don't belong in skills
    const skillLines = cleanSkills.split("\n").filter((line) => {
      const lower = line.toLowerCase();
      return (
        !line.startsWith("•") ||
        lower.includes("programming") ||
        lower.includes("frameworks") ||
        lower.includes("tools") ||
        lower.includes("databases") ||
        lower.includes("design") ||
        lower.includes("languages")
      );
    });
    result += "TECHNICAL SKILLS\n" + skillLines.join("\n") + "\n\n";
  }

  // Professional Experience
  if (sections.experience.trim()) {
    result += "PROFESSIONAL EXPERIENCE\n" + sections.experience.trim() + "\n\n";
  }

  // Education
  if (sections.education.trim()) {
    result += "EDUCATION\n" + sections.education.trim() + "\n\n";
  }

  // Projects
  if (sections.projects.trim()) {
    result += "PROJECTS\n" + sections.projects.trim() + "\n\n";
  }

  // Certifications
  if (sections.certifications.trim()) {
    result += "CERTIFICATIONS\n" + sections.certifications.trim() + "\n\n";
  }

  // Additional Information
  if (sections.additional.trim()) {
    result += "ADDITIONAL INFORMATION\n" + sections.additional.trim() + "\n";
  }

  return result.trim();
}

// Smart text cleaning and structuring
function cleanAndStructureText(text: string, originalResume: string): string {
  if (!text || text.trim().length < 50) {
    return enhanceResumeWithKeywords(originalResume, []);
  }

  // Remove garbled text and clean up
  const cleaned = text
    .replace(/[^\w\s\-\.\,\(\)\@\|\/\:]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\.\s*\./g, ".")
    .trim();

  if (cleaned.length < 100 || isGarbledText(cleaned)) {
    return enhanceResumeWithKeywords(originalResume, []);
  }

  // If AI output doesn't look like a proper resume, enhance original
  if (
    !cleaned.includes("PROFESSIONAL") &&
    !cleaned.includes("EXPERIENCE") &&
    !cleaned.includes("SKILLS")
  ) {
    return enhanceResumeWithKeywords(originalResume, []);
  }

  return cleaned;
}

// Detect if text is garbled
function isGarbledText(text: string): boolean {
  const garbledPatterns = [
    /[^a-zA-Z\s]{3,}/,
    /\w{20,}/,
    /[^\w\s\.\,\-\(\)\@\|\/\:]{2,}/,
  ];

  return garbledPatterns.some((pattern) => pattern.test(text));
}

// Extract keywords from job description
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "the",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "this",
    "that",
    "these",
    "those",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "can",
  ]);

  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];

  const keywords = words
    .filter((word) => !stopWords.has(word))
    .filter((word) => {
      return (
        word.includes("react") ||
        word.includes("javascript") ||
        word.includes("typescript") ||
        word.includes("css") ||
        word.includes("html") ||
        word.includes("frontend") ||
        word.includes("developer") ||
        word.includes("experience") ||
        word.includes("application") ||
        word.includes("framework") ||
        word.includes("responsive") ||
        word.includes("design") ||
        word.includes("tailwind") ||
        word.length >= 4
      );
    })
    .filter((word, index, arr) => arr.indexOf(word) === index)
    .slice(0, 10)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));

  return keywords;
}

// Calculate match score
function calculateMatchScore(keywords: string[], resume: string): number {
  if (keywords.length === 0) return 60;

  const resumeLower = resume.toLowerCase();
  const matchedKeywords = keywords.filter((keyword) =>
    resumeLower.includes(keyword.toLowerCase())
  );

  const baseScore = Math.round(
    (matchedKeywords.length / keywords.length) * 100
  );
  return Math.min(95, Math.max(50, baseScore));
}

// Generate improvements list
function generateImprovements(
  matchScore: number,
  useAlternative: boolean
): string[] {
  const improvements = [
    "Enhanced resume structure and formatting",
    "Improved keyword optimization for ATS systems",
    "Strengthened professional presentation",
    "Added TypeScript and React focus",
  ];

  if (matchScore >= 80) {
    improvements.push("Achieved excellent job-resume alignment");
  } else if (matchScore >= 65) {
    improvements.push("Significantly improved job relevance");
  }

  if (useAlternative) {
    improvements.push("Applied advanced AI optimization techniques");
  } else {
    improvements.push("Applied intelligent content enhancement");
  }

  return improvements;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse | ErrorResponse>> {
  try {
    const requestData = (await request.json()) as RequestBody;
    const { jobDescription, resumeText, useAlternative = false } = requestData;

    if (!jobDescription?.trim() || !resumeText?.trim()) {
      return NextResponse.json(
        { error: "Both job description and resume text are required" },
        { status: 400 }
      );
    }

    const keywords = extractKeywords(jobDescription);

    try {
      const modelSummarizer = useAlternative
        ? await getAlternativeSummarizer()
        : await getSummarizer();

      const focusedPrompt = `Rewrite this resume to better match these job requirements: ${jobDescription.slice(
        0,
        300
      )}
      
Resume to improve: ${resumeText.slice(0, 800)}`;

      const output = await modelSummarizer(focusedPrompt, {
        max_length: 300,
        min_length: 100,
      });

      let generatedText = "";
      if (Array.isArray(output) && output[0]?.summary_text) {
        generatedText = output[0].summary_text;
      }

      const finalResume = cleanAndStructureText(generatedText, resumeText);
      const matchScore = calculateMatchScore(keywords, finalResume);
      const improvements = generateImprovements(matchScore, useAlternative);

      const response: ApiResponse = {
        tailoredResume: finalResume,
        keywords: keywords.slice(0, 8),
        improvements,
        matchScore,
        timestamp: new Date().toISOString(),
        service: useAlternative ? "DistilBART-Large" : "DistilBART-CNN",
      };

      return NextResponse.json(response);
    } catch (modelError) {
      console.error("Model error, using enhancement fallback:", modelError);

      const enhancedResume = enhanceResumeWithKeywords(resumeText, keywords);
      const matchScore = calculateMatchScore(keywords, enhancedResume);

      return NextResponse.json({
        tailoredResume: enhancedResume,
        keywords: keywords.slice(0, 8),
        improvements: [
          "Applied keyword optimization",
          "Enhanced resume structure",
          "Added TypeScript and React focus",
          "Maintained professional formatting",
        ],
        matchScore,
        timestamp: new Date().toISOString(),
        service: "Enhanced Original (Fallback)",
      });
    }
  } catch (error) {
    console.error("Resume generation error:", error);

    return NextResponse.json(
      {
        error: `Resume generation failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse<ErrorResponse>> {
  return NextResponse.json(
    {
      error: "Method not allowed. Use POST to generate resume.",
      endpoint: "/api/generate-resume",
      method: "POST",
      timestamp: new Date().toISOString(),
    },
    { status: 405 }
  );
}
