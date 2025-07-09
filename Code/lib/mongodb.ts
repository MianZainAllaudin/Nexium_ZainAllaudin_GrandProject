import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI!;
const client = new MongoClient(uri);

export async function saveToMongo(data: {
  jobDescription: string;
  resume: string;
}) {
  await client.connect();
  const db = client.db("resume_tailor");
  await db.collection("raw_data").insertOne(data);
  await client.close();
}
