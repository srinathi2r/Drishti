import { copyFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const htmlPath = path.join(root, "pdf", "blank-ira-form.html");
const pdfPath = path.join(root, "pdf", "drishti_blank_ira_form.pdf");
const publicPdfPath = path.join(root, "public", "drishti_blank_ira_form.pdf");

const chromeCandidates = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
];

async function exists(filePath) {
  try {
    await import("node:fs/promises").then((fs) => fs.access(filePath));
    return true;
  } catch {
    return false;
  }
}

const chromePath = (await Promise.all(chromeCandidates.map(async (candidate) => ((await exists(candidate)) ? candidate : "")))).find(Boolean);

if (!chromePath) {
  throw new Error("Chrome or Edge was not found for HTML-to-PDF generation.");
}

await mkdir(path.dirname(pdfPath), { recursive: true });
await mkdir(path.dirname(publicPdfPath), { recursive: true });

const args = [
  "--headless=new",
  "--disable-gpu",
  "--no-sandbox",
  "--print-to-pdf-no-header",
  `--print-to-pdf=${pdfPath}`,
  pathToFileURL(htmlPath).href,
];

await new Promise((resolve, reject) => {
  const child = spawn(chromePath, args, { stdio: "inherit" });
  child.on("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`Chrome exited with code ${code}`));
  });
  child.on("error", reject);
});

await copyFile(pdfPath, publicPdfPath);
console.log(`Wrote ${pdfPath}`);
console.log(`Copied ${publicPdfPath}`);
