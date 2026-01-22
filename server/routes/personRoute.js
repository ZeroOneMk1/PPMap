import express from "express"
import { createPerson, deletePerson, getPersonByToken, getAllPersons, renamePerson, updatePersonPassword, loginPerson, toggleDiscoverability } from "../controller/personController.js"

const peopleRouter = express.Router();

peopleRouter.post("/person", createPerson);
peopleRouter.post("/deleteperson", deletePerson);
peopleRouter.get("/getperson", getPersonByToken);
peopleRouter.get("/getallpersons", getAllPersons);
peopleRouter.post("/renameperson", renamePerson);
peopleRouter.post("/updatepassword", updatePersonPassword);
peopleRouter.post("/login", loginPerson);
peopleRouter.post("/togglediscoverability", toggleDiscoverability);

export default peopleRouter;