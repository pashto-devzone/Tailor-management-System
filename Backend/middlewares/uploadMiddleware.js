// Simple multipart/form-data parser fallback without external deps.
// Supports a single file field named "file".
// This avoids MODULE_NOT_FOUND for multer.

const { StringDecoder } = require("string_decoder");

function parseMultipart(req, boundary, cb) {
  let data = Buffer.alloc(0);
  req.on("data", (chunk) => {
    data = Buffer.concat([data, chunk]);
  });
  req.on("end", () => {
    try {
      const parts = data
        .toString("binary")
        .split(`--${boundary}`);

      const filePart = parts.find((p) => p.includes('name="file"'));
      if (!filePart) return cb(new Error("File field 'file' not found"));

      const headerEnd = filePart.indexOf("\r\n\r\n");
      const contentStart = headerEnd + 4;
      const contentEnd = filePart.lastIndexOf("\r\n");
      const fileBuffer = Buffer.from(
        filePart.slice(contentStart, contentEnd),
        "binary",
      );

      cb(null, {
        file: {
          buffer: fileBuffer,
          originalname: "backup.zip",
        },
      });
    } catch (e) {
      cb(e);
    }
  });
}

module.exports = {
  single: (fieldName) => {
    return (req, res, next) => {
      const contentType = req.headers["content-type"] || "";
      const match = contentType.match(/boundary=([^;]+)/i);
      if (!match) {
        return res.status(400).json({ message: "Invalid multipart request" });
      }

      parseMultipart(req, match[1], (err, result) => {
        if (err) return res.status(400).json({ message: err.message });
        req.file = result.file;
        next();
      });
    };
  },
};


