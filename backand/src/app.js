const express=require("express");
const cookieParser=require("cookie-parser")
const cors = require("cors");

const app=express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser())

const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:3000", "https://resume-jd-analyzer-kpf1.vercel.app"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}

app.use(cors(corsOptions));

//require all the routes here
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")

//using all the routes here
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)

// Generic error handler to provide clearer JSON responses for upload and parsing errors
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err && (err.stack || err.message || err))

  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'Uploaded file is too large. Max size is 10MB.' })
  }

  if (err && err.message && err.message.includes('Unsupported file type')) {
    return res.status(400).json({ message: err.message })
  }

  res.status(500).json({ message: 'Internal server error', error: err && err.message })
})

module.exports = app