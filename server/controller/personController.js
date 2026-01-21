import person from "../model/personModel.js"

export const createPerson = async (req, res) => {
    try {
        const newPerson = new person(req.body)
        const {nickname, UUID, relationships} = newPerson
        const personExists = await person.findOne({ nickname })

        if (personExists) {
            return res.status(400).json({ message: "Nickname already taken" })
        }

        const savedPerson = await newPerson.save()

        res.status(201).json(savedPerson)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}   

export const getAllPersons = async (req, res) => {
    try {
        const persons = await person.find()
        res.status(200).json(persons)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const getPersonById = async (req, res) => {
    try {
        const { id } = req.params
        const foundPerson = await person.findById(id)

        if (!foundPerson) {
            return res.status(404).json({ message: "Person not found" })
        }

        res.status(200).json(foundPerson)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const updatePerson = async (req, res) => {
    try {
        const { id } = req.params
        const updatedPerson = await person.findByIdAndUpdate(id, req.body, { new: true })

        if (!updatedPerson) {
            return res.status(404).json({ message: "Person not found" })
        }

        res.status(200).json(updatedPerson)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const deletePerson = async (req, res) => {
    try {
        const { id } = req.params
        const deletedPerson = await person.findByIdAndDelete(id)

        if (!deletedPerson) {
            return res.status(404).json({ message: "Person not found" })
        }

        res.status(200).json({ message: "Person deleted successfully" })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}