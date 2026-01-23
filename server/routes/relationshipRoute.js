import express from "express"
import { createRelationshipAsPerson, joinRelationshipAsPerson, endRelationshipAsPerson, editRelationshipAsPerson, deleteAllInvalidRelationships, getRelatedPersons, getPendingRelationships } from "../controller/relationshipController.js"

const relationshipsRouter = express.Router();

relationshipsRouter.post("/relationship", createRelationshipAsPerson);
relationshipsRouter.post("/relationship/join", joinRelationshipAsPerson);
relationshipsRouter.post("/relationship/end", endRelationshipAsPerson);
relationshipsRouter.post("/relationship/edit", editRelationshipAsPerson);
relationshipsRouter.post("/relationship/clean", deleteAllInvalidRelationships);
relationshipsRouter.get("/relationship/related", getRelatedPersons);
relationshipsRouter.get("/relationship/pending", getPendingRelationships);
export default relationshipsRouter;