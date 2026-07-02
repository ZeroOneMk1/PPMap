import express from "express"
import rateLimit from "express-rate-limit"
import { createPerson, deletePerson, getPersonByToken, updatePersonPassword, loginPerson, logoutPerson, toggleDiscoverability } from "../controller/personController.js"

const peopleRouter = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    message: { message: "Too many login attempts. Try again later." },
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { message: "Too many registrations from this IP. Try again later." },
});

peopleRouter.post("/person", registerLimiter, createPerson);
peopleRouter.post("/person/delete", deletePerson);
peopleRouter.get("/person/get", getPersonByToken);
peopleRouter.post("/person/updatepassword", updatePersonPassword);
peopleRouter.post("/person/login", loginLimiter, loginPerson);
peopleRouter.post("/person/logout", logoutPerson);
peopleRouter.post("/person/togglediscoverability", toggleDiscoverability);

export default peopleRouter;