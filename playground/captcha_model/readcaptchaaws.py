import boto3
import os
from pathlib import Path

# Initialize AWS Textract client
textract = boto3.client("textract")

IMAGE_DIR = "captchas"
RESULTS_CSV = "captcha_textract_results.csv"

def extract_text_from_image(image_path):
    with open(image_path, "rb") as img_file:
        image_bytes = img_file.read()

    try:
        response = textract.detect_document_text(Document={"Bytes": image_bytes})
        text = "".join([block["Text"] for block in response["Blocks"] if block["BlockType"] == "LINE"])
        return text
    except Exception as e:
        print(f"❌ Textract failed for {image_path.name}: {e}")
        return "ERROR"

def main():
    image_paths = sorted(Path(IMAGE_DIR).glob("*.png"))
    output_lines = ["filename,text"]

    for image_path in image_paths:
        print(f"🔍 Processing: {image_path.name}")
        result = extract_text_from_image(image_path)
        print(f"✅ Result: {result}")
        output_lines.append(f"{image_path.name},{result}")

    with open(RESULTS_CSV, "w", encoding="utf-8") as f:
        f.write("\n".join(output_lines))

    print(f"\n📄 Saved results to {RESULTS_CSV}")

if __name__ == "__main__":
    main()
