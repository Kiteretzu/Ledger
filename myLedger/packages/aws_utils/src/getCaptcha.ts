import {
  TextractClient,
  DetectDocumentTextCommand,
} from "@aws-sdk/client-textract";
import fs from "fs";

import dotenv from "dotenv";
dotenv.config({ path: __dirname + "/../.env" }); // Initialize Textract client

console.log("REgion", process.env.AWS_REGION);

const client = new TextractClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Function to extract text from image using AWS Textract
async function extractTextFromImage(imagePath: string) {
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
