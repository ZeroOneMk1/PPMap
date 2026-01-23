import express from "express"
import { createRelationshipAsPerson, joinRelationshipAsPerson, endRelationshipAsPerson, editRelationshipAsPerson, deleteAllInvalidRelationships, getRelatedPersons } from "../controller/relationshipController.js"

const relationshipsRouter = express.Router();

relationshipsRouter.post("/relationship", createRelationshipAsPerson);
relationshipsRouter.post("/relationship/join", joinRelationshipAsPerson);
relationshipsRouter.post("/relationship/end", endRelationshipAsPerson);
relationshipsRouter.post("/relationship/edit", editRelationshipAsPerson);
relationshipsRouter.post("/relationship/deleteinvalid", deleteAllInvalidRelationships);
relationshipsRouter.get("/relationship/getrelatedpersons", getRelatedPersons);
export default relationshipsRouter;