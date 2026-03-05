import express from "express";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import cron from "node-cron"; // 1. Import node-cron
import peopleRouter from "./routes/personRoute.js";
import relationshipsRouter from "./routes/relationshipRoute.js";
// Assuming this is the function that performs the cleanup
import { deleteAllInvalidRelationships } from "./controller/relationshipController.js"; 

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// provide a fallback secret so jwt.sign always has a value
process.env.JWT_SECRET = process.env.JWT_SECRET || "defaultsecret";

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