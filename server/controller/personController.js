import person from "../model/personModel.js"
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator';

// `secure` is gated on production so the dev server can run over http://localhost.
// In prod (NODE_ENV=production) the cookie is only sent over HTTPS.
const SESSION_TTL_MS = 60 * 60 * 1000; // 1h, matches JWT expiry
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_TTL_MS
};

const MIN_PASSWORD_LENGTH = 12;

export function setSessionCookie(res, token) {
    res.cookie("token", token, COOKIE_OPTIONS);
}

export function clearSessionCookie(res) {
    const { maxAge, ...clearOpts } = COOKIE_OPTIONS;
    res.clearCookie("token", clearOpts);
}

// Verify the session cookie. Returns the decoded payload (with `handle`) or null.
// On failure, writes a 401 to the response.
// On success, refreshes the session cookie so the TTL slides forward on each
// authenticated request. An idle user is logged out after one hour; an active
// user stays logged in indefinitely.
export function requireAuth(req, res) {
    const token = req.cookies?.token;
    if (typeof token !== "string") {
        res.status(401).json({ message: "Not authenticated" });
        return null;
    }
    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
        res.status(401).json({ message: "Not authenticated" });
        return null;
    }
    const refreshed = jwt.sign({ handle: decoded.handle }, process.env.JWT_SECRET, { expiresIn: '1h' });
    setSessionCookie(res, refreshed);
    return decoded;
}

const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;

// Used to keep login timing constant when a handle does not exist, so an
// attacker cannot enumerate accounts by measuring response time.
const TIMING_DUMMY_HASH = bcrypt.hashSync("not-a-real-password", saltRounds);

// Three random words joined by hyphens, e.g. "brave-purple-otter".
// ~70 million combinations from the bundled dictionaries.
// Server-generated; the user does not pick this.
function newHandle() {
    return uniqueNamesGenerator({
        dictionaries: [adjectives, colors, animals],
        separator: "-",
        style: "lowerCase",
        length: 3,
    });
}

async function generateUniqueHandle() {
    for (let i = 0; i < 5; i++) {
        const candidate = newHandle();
        const existing = await person.findOne({ handle: candidate });
        if (!existing) return candidate;
    }
    throw new Error("Could not generate a unique handle");
}

export const createPerson = async (req, res) => {
    try {
        const { password } = req.body || {}
        if (typeof password !== "string") {
            return res.status(400).json({ message: "Invalid input" })
        }
        if (password.length < MIN_PASSWORD_LENGTH) {
            return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` })
        }
        const hashed = await bcrypt.hash(password, saltRounds)
        const handle = await generateUniqueHandle()
        const newPerson = new person({ handle, password: hashed })
        newPerson.isAdmin = false

        const savedPerson = await newPerson.save()

        const token = jwt.sign({ handle: savedPerson.handle }, process.env.JWT_SECRET, { expiresIn: '1h' })
        setSessionCookie(res, token)

        res.status(201).json({ ...savedPerson.toObject(), password: undefined })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal error" })
    }
}

export const deletePerson = async (req, res) => {
    try {
        const decoded = requireAuth(req, res)
        if (!decoded) return
        const { handle } = decoded
        const deletedPerson = await person.findOneAndDelete({ handle })

        if (!deletedPerson) {
            return res.status(404).json({ message: "Person not found" })
        }

        clearSessionCookie(res)
        res.status(200).json({ message: "Person deleted successfully" })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal error" })
    }
}

export const loginPerson = async (req, res) => {
    try {
        const { handle, password } = req.body || {}
        if (typeof handle !== "string" || typeof password !== "string") {
            return res.status(400).json({ message: "Invalid input" })
        }
        const foundPerson = await person.findOne({ handle })

        if (!foundPerson) {
            await bcrypt.compare(password, TIMING_DUMMY_HASH)
            return res.status(401).json({ message: "Invalid credentials" })
        }

        const passwordMatch = await bcrypt.compare(password, foundPerson.password)
        if (!passwordMatch) {
            return res.status(401).json({ message: "Invalid credentials" })
        }

        const token = jwt.sign({ handle: foundPerson.handle }, process.env.JWT_SECRET, { expiresIn: '1h' })
        setSessionCookie(res, token)

        res.status(200).json({ ok: true })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal error" })
    }
}

export const getAllPersons = async (req, res) => {
    const decoded = requireAuth(req, res)
    if (!decoded) return
    try {
        const requestingPerson = await person.findOne({ handle: decoded.handle })
        if (!requestingPerson || !requestingPerson.isAdmin) {
            return res.status(403).json({ message: "Access denied" })
        }
        const persons = await person.find().select('-password')
        res.status(200).json(persons)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal error" })
    }
}

export const getPersonByToken = async (req, res) => {
    try {
        const decoded = requireAuth(req, res)
        if (!decoded) return
        const foundPerson = await person.findOne({ handle: decoded.handle }).select('-password')

        if (!foundPerson) {
            return res.status(404).json({ message: "Person not found" })
        }

        res.status(200).json(foundPerson)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal error" })
    }
}

export const logoutPerson = (req, res) => {
    clearSessionCookie(res)
    res.status(200).json({ ok: true })
}

export const updatePersonPassword = async (req, res) => {
    try {
        const decoded = requireAuth(req, res)
        if (!decoded) return
        const { password, newpassword } = req.body || {}
        if (typeof password !== "string" || typeof newpassword !== "string") {
            return res.status(400).json({ message: "Invalid input" })
        }
        if (newpassword.length < MIN_PASSWORD_LENGTH) {
            return res.status(400).json({ message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` })
        }
        const { handle } = decoded
        const foundPerson = await person.findOne({ handle })

        if (!foundPerson) {
            return res.status(404).json({ message: "Person not found" })
        }

        const passwordMatch = await bcrypt.compare(password, foundPerson.password)
        if (!passwordMatch) {
            return res.status(401).json({ message: "Invalid password" })
        }

        const hashedNewPassword = await bcrypt.hash(newpassword, saltRounds)
        const updatedPerson = await person.findOneAndUpdate({ handle }, { password: hashedNewPassword }, { new: true })

        if (!updatedPerson) {
            return res.status(404).json({ message: "Person not found" })
        }

        res.status(200).json({ ...updatedPerson.toObject(), password: undefined })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal error" })
    }
}

export const toggleDiscoverability = async (req, res) => {
    try {
        const decoded = requireAuth(req, res)
        if (!decoded) return
        const { discoverable } = req.body || {}
        if (typeof discoverable !== "boolean") {
            return res.status(400).json({ message: "Invalid input" })
        }
        const { handle } = decoded
        const updatedPerson = await person.findOneAndUpdate(
            { handle },
            { discoverable },
            { new: true }
        )

        if (!updatedPerson) {
            return res.status(404).json({ message: "Person not found" })
        }

        res.status(200).json({ ...updatedPerson.toObject(), password: undefined })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal error" })
    }
}
