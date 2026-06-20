import express from "express";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import dotenv from "dotenv";
import cron from "node-cron"; // 1. Import node-cron
import path from "path";
import { fileURLToPath } from "url";
import peopleRouter from "./routes/personRoute.js";
import relationshipsRouter from "./routes/relationshipRoute.js";
// Assuming this is the function that performs the cleanup
import { deleteAllInvalidRelationships } from "./controller/relationshipController.js";

dotenv.config();

const app = express();
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

// In production, trust the X-Forwarded-Proto header from a single reverse proxy
// (so req.secure and the rate limiter's IP detection work correctly), and bounce
// any plain-HTTP request to HTTPS.
if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
    app.use((req, res, next) => {
        if (req.secure) return next();
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
    });
}

app.use(helmet());
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(bodyParser.json());
app.use(cookieParser());

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters long");
}

const PORT = process.env.PORT || 8000;
const MONGODB_URL = process.env.MONGODB_URL || "mongodb://localhost:27017/PPMapDB";

// 2. Schedule the task to run every minute
// Cron syntax: 'minute hour day-of-month month day-of-week'
cron.schedule('* * * * *', async () => {
    console.log("--- Scheduled Task: Cleaning invalid relationships ---");
    try {
        // We call the controller function directly
        await deleteAllInvalidRelationships();
        console.log("Cleanup completed successfully.");
    } catch (error) {
        console.error("Error during scheduled cleanup:", error);
    }
});

mongoose.connect(MONGODB_URL)
    .then(() => {
        console.log("Connected to MongoDB");
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error("Error connecting to MongoDB:", error);
    });

app.use("/api", peopleRouter);
app.use("/api", relationshipsRouter);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.join(__dirname, "..", "client", "build");
app.use(express.static(buildDir));
app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(buildDir, "index.html")));
