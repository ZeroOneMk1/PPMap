import express from "express"
import { createPerson } from "../controller/personController.js"

const peopleRouter = express.Router();

peopleRouter.post("/person", createPerson);

export default peopleRouter;