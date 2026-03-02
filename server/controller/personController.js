import person from "../model/personModel.js"
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// helper to pull token from various request shapes
function extractToken(req) {
    let token;
    if (req.body) {
        if (typeof req.body === 'string') {
            // might be urlencoded like "token=..."
            const m = req.body.match(/token=(.*)/);
            if (m) token = m[1];
        } else if (req.body.token) {
            token = req.body.token;
        }
    }
    if (!token && req.query) {
        token = req.query.token;
    }
    return token;
}

const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 10;

export const createPerson = async (req, res) => {
    try {
        const newPerson = new person(req.body)
        const {nickname} = newPerson
        const nicknameExists = await person.findOne({ nickname })

        if (nicknameExists) {
            return res.status(400).json({ message: "Nickname already taken" })
        }

        const UUID = uuidv4()
        newPerson.UUID = UUID
        const uuidExists = await person.findOne({ UUID })

        while (uuidExists) {
            const newUUID = uuidv4()
            newPerson.UUID = newUUID
            const newUuidExists = await person.findOne({ UUID: newUUID })
            if (!newUuidExists) {
                break
            }
        }

        newPerson.password = await bcrypt.hash(newPerson.password, saltRounds)

        const savedPerson = await newPerson.save()

        const token = jwt.sign({ UUID: savedPerson.UUID }, process.env.JWT_SECRET, { expiresIn: '24h' })

        res.status(201).json({ ...savedPerson.toObject(), password: undefined, token })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const deletePerson = async (req, res) => {
    try {
        const { token } = req.body
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const { UUID } = decoded
        const deletedPerson = await person.findOneAndDelete({ UUID })

        if (!deletedPerson) {
            return res.status(404).json({ message: "Person not found" })
        }

        res.status(200).json({ message: "Person deleted successfully" })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const loginPerson = async (req, res) => {
    try {
        const { nickname, password } = req.body
        const foundPerson = await person.findOne({ nickname })

        if (!foundPerson) {
            return res.status(404).json({ message: "Person not found" })
        }
        const passwordMatch = await bcrypt.compare(password, foundPerson.password)

        if (!passwordMatch) {
            return res.status(401).json({ message: "Invalid password" })
        }

        const token = jwt.sign({ UUID: foundPerson.UUID }, process.env.JWT_SECRET, { expiresIn: '24h' })

        res.status(200).json({ token })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const getAllPersons = async (req, res) => {
    const token = extractToken(req);

    if (!token) {
        return res.status(401).json({ message: "Token is required" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.UUID !== '69420') {
            return res.status(403).json({ message: "Access denied" });
        }
    } catch (error) {
        return res.status(401).json({ message: "Invalid token" });
    }
    try {
        const persons = await person.find().select('-password')
        res.status(200).json(persons)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const getPersonByToken = async (req, res) => {
    try {
        const token = extractToken(req);
        
        if (!token) {
            return res.status(401).json({ message: "Token is required" })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const { UUID } = decoded
        
        const foundPerson = await person.findOne({ UUID }).select('-password')

        if (!foundPerson) {
            return res.status(404).json({ message: "Person not found" })
        }

        res.status(200).json(foundPerson)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const renamePerson = async (req, res) => {
    try {
        const { token, nickname } = req.body
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const { UUID } = decoded
        const updatedPerson = await person.findOneAndUpdate({ UUID }, { nickname }, { new: true })

        if (!updatedPerson) {
            return res.status(404).json({ message: "Person not found" })
        }

        res.status(200).json({ ...updatedPerson.toObject(), password: undefined })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const updatePersonPassword = async (req, res) => {
    try {
        const { token, password, newpassword } = req.body
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const { UUID } = decoded
        const foundPerson = await person.findOne({ UUID })

        if (!foundPerson) {
            return res.status(404).json({ message: "Person not found" })
        }

        const passwordMatch = await bcrypt.compare(password, foundPerson.password)
        if (!passwordMatch) {
            return res.status(401).json({ message: "Invalid password" })
        }

        const hashedNewPassword = await bcrypt.hash(newpassword, saltRounds)
        const updatedPerson = await person.findOneAndUpdate({ UUID }, { password: hashedNewPassword }, { new: true })

        if (!updatedPerson) {
            return res.status(404).json({ message: "Person not found" })
        }

        res.status(200).json({ ...updatedPerson.toObject(), password: undefined })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const toggleDiscoverability = async (req, res) => {
    try {
        const { token, discoverable } = req.body
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const { UUID } = decoded
        const updatedPerson = await person.findOneAndUpdate(
            { UUID },
            { discoverable },
            { new: true }
        )

        if (!updatedPerson) {
            return res.status(404).json({ message: "Person not found" })
        }

        res.status(200).json({ ...updatedPerson.toObject(), password: undefined })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}