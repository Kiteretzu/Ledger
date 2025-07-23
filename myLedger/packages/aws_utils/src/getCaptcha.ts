import {
  TextractClient,
  DetectDocumentTextCommand,
} from "@aws-sdk/client-textract";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

// AWS credentials
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID!;
const AWS_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY!;
const AWS_REGION = process.env.AWS_REGION!;

// Initialize Textract client
const client = new TextractClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_KEY,
  },
});

// Function to extract text from image using AWS Textract
async function extractTextFromImage(imagePath) {
  const imageBytes = fs.readFileSync(imagePath);

  const command = new DetectDocumentTextCommand({
    Document: { Bytes: imageBytes },
  });

  try {
    const response = await client.send(command);
    const lines = response.Blocks.filter(
      (block) => block.BlockType === "LINE"
    ).map((block) => block.Text);

    return lines.join("\n").trim();
  } catch (err) {
    console.error("Error extracting text:", err);
    return "";
  }
}

export { extractTextFromImage };
