const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const UPLOAD_DIR = path.join(ROOT, "uploads");
const DATA_FILE = path.join(ROOT, "documents.json");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]");
app.use(express.static(PUBLIC_DIR));

function readDocuments() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
  catch { return []; }
}
function writeDocuments(items) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2));
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safeOriginal = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${crypto.randomUUID()}-${safeOriginal}`);
  }
});
const allowedExtensions = new Set([".pdf", ".doc", ".docx", ".txt", ".png", ".jpg", ".jpeg"]);
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.has(ext)) return cb(null, true);
    cb(new Error("Unsupported file type. Use PDF, DOC, DOCX, TXT, PNG or JPG."));
  }
});

app.get("/api/documents", (req, res) => {
  const q = String(req.query.q || "").toLowerCase().trim();
  const docs = readDocuments().filter(d =>
    [d.title, d.category, d.originalName].some(v => String(v || "").toLowerCase().includes(q))
  );
  res.json(docs);
});

app.post("/api/documents", (req, res) => {
  upload.single("document")(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    const title = String(req.body.title || "").trim();
    const category = String(req.body.category || "").trim();
    if (!title || !category || !req.file) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Title, category and a document file are required." });
    }
    const docs = readDocuments();
    const doc = {
      id: crypto.randomUUID(), title, category,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      uploadedAt: new Date().toISOString()
    };
    docs.unshift(doc);
    writeDocuments(docs);
    res.status(201).json(doc);
  });
});

app.get("/api/documents/:id/file", (req, res) => {
  const doc = readDocuments().find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  const filePath = path.join(UPLOAD_DIR, path.basename(doc.storedName));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found." });
  res.download(filePath, doc.originalName);
});

app.delete("/api/documents/:id", (req, res) => {
  const docs = readDocuments();
  const doc = docs.find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: "Document not found." });
  const filePath = path.join(UPLOAD_DIR, path.basename(doc.storedName));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  writeDocuments(docs.filter(d => d.id !== doc.id));
  res.json({ message: "Document deleted." });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error." });
});

app.listen(PORT, () => console.log(`DDMS running at http://localhost:${PORT}`));
