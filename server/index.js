import express from "express";
import mongoose from "mongoose";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import peopleRouter from "./routes/personRoute.js";
import relationshipsRouter from "./routes/relationshipRoute.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());
dotenv.config();
// provide a fallback secret so jwt.sign always has a value
process.env.JWT_SECRET = process.env.JWT_SECRET || "defaultsecret";

const PORT = process.env.PORT || 8000;
const MONGODB_URL = process.env.MONGODB_URL || "mongodb://localhost:27017/PPMapDB";
const JWT_SECRET = process.env.JWT_SECRET || "defaultsecret";

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
