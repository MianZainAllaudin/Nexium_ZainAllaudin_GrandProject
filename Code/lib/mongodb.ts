import { MongoClient, ObjectId } from "mongodb";

const uri = process.env.MONGODB_URI!;
const client = new MongoClient(uri);

let isConnected = false;

async function connectToMongo() {
  if (!isConnected) {
    await client.connect();
    isConnected = true;
  }
  return client.db("resume_tailor");
}

export async function saveResumeData(data: {
  userId: string;
  jobDescription: string;
  sampleResume: string;
  tailoredResume: string;
  matchScore?: number;
  keywords?: string[];
  improvements?: string[];
}) {
  try {
    const db = await connectToMongo();

    // Save job description
    const jobDescResult = await db.collection("job_descriptions").insertOne({
      userId: data.userId,
      content: data.jobDescription,
      createdAt: new Date(),
    });

    // Save sample resume (original resume)
    const sampleResumeResult = await db.collection("sample_resumes").insertOne({
      userId: data.userId,
      content: data.sampleResume,
      createdAt: new Date(),
    });

    // Save tailored resume
    const tailoredResumeResult = await db
      .collection("tailored_resumes")
      .insertOne({
        userId: data.userId,
        jobDescriptionId: jobDescResult.insertedId,
        sampleResumeId: sampleResumeResult.insertedId,
        content: data.tailoredResume,
        matchScore: data.matchScore || 0,
        keywords: data.keywords || [],
        improvements: data.improvements || [],
        createdAt: new Date(),
      });

    return {
      jobDescriptionId: jobDescResult.insertedId,
      sampleResumeId: sampleResumeResult.insertedId,
      tailoredResumeId: tailoredResumeResult.insertedId,
    };
  } catch (error) {
    console.error("MongoDB save error:", error);
    throw error;
  }
}

export async function getUserResumes(userId: string) {
  try {
    const db = await connectToMongo();

    const resumes = await db
      .collection("tailored_resumes")
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    return resumes;
  } catch (error) {
    console.error("MongoDB fetch error:", error);
    throw error;
  }
}

export async function getResumeById(resumeId: string) {
  try {
    const db = await connectToMongo();

    const resume = await db
      .collection("tailored_resumes")
      .findOne({ _id: new ObjectId(resumeId) });

    if (!resume) return null;

    // Get related job description and sample resume
    const [jobDesc, sampleResume] = await Promise.all([
      db
        .collection("job_descriptions")
        .findOne({ _id: resume.jobDescriptionId }),
      db.collection("sample_resumes").findOne({ _id: resume.sampleResumeId }),
    ]);

    return {
      ...resume,
      jobDescription: jobDesc?.content || "",
      sampleResume: sampleResume?.content || "",
    };
  } catch (error) {
    console.error("MongoDB fetch by ID error:", error);
    throw error;
  }
}

// Legacy function for backward compatibility
export async function saveToMongo(data: {
  jobDescription: string;
  resume: string;
}) {
  const db = await connectToMongo();
  const result = await db.collection("raw_data").insertOne({
    ...data,
    createdAt: new Date(),
  });
  return result;
}
