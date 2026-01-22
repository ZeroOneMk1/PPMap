import express from "express"
import { createPerson, deletePerson, getPersonByToken, getAllPersons, renamePerson, updatePersonPassword, loginPerson, toggleDiscoverability } from "../controller/personController.js"

const peopleRouter = express.Router();

peopleRouter.post("/person", createPerson);
peopleRouter.post("/person/delete", deletePerson);
peopleRouter.get("/person/get", getPersonByToken);
peopleRouter.get("/person/getAll", getAllPersons);
peopleRouter.post("/person/rename", renamePerson);
peopleRouter.post("/person/updatepassword", updatePersonPassword);
peopleRouter.post("/person/login", loginPerson);
peopleRouter.post("/person/togglediscoverability", toggleDiscoverability);

export default peopleRouter;