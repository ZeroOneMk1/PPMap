import express from "express"
import { createRelationshipAsPerson, joinRelationshipAsPerson, endRelationshipAsPerson } from "../controller/relationshipController.js"

const relationshipsRouter = express.Router();

relationshipsRouter.post("/relationship", createRelationshipAsPerson);
relationshipsRouter.post("/relationship/join", joinRelationshipAsPerson);
relationshipsRouter.post("/relationship/end", endRelationshipAsPerson);
export default relationshipsRouter;