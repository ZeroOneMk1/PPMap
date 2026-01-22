import express from "express"
import { createRelationship } from "../controller/relationshipController.js"

const relationshipsRouter = express.Router();

relationshipsRouter.post("/relationship", createRelationship);

export default relationshipsRouter;