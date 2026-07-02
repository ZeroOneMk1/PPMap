import express from "express"
import rateLimit from "express-rate-limit"
import {
    createRelationshipAsPerson,
    joinRelationshipAsPerson,
    endRelationshipAsPerson,
    editRelationshipAsPerson,
    getDirectRelationships,
    getRelationshipGraph,
    checkConnection,
} from "../controller/relationshipController.js"

const relationshipsRouter = express.Router();

// The graph endpoint walks the whole connected component; throttle it.
const graphLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many requests. Slow down." },
});

relationshipsRouter.post("/relationship", createRelationshipAsPerson);
relationshipsRouter.post("/relationship/join", joinRelationshipAsPerson);
relationshipsRouter.post("/relationship/end", endRelationshipAsPerson);
relationshipsRouter.post("/relationship/edit", editRelationshipAsPerson);
relationshipsRouter.get("/relationship/direct", getDirectRelationships);
relationshipsRouter.get("/relationship/connected", checkConnection);
relationshipsRouter.get("/relationship/graph", graphLimiter, getRelationshipGraph);

export default relationshipsRouter;
