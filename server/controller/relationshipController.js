import relationship from "../model/relationshipModel.js"

export const createRelationship = async (req, res) => {
    try {
        const newRelationship = new relationship(req.body)
        const {UUID, type, persons} = newRelationship
        const relationshipExists = await relationship.findOne({
            $or: [
            { UUID },
            { persons: { $all: persons.filter(p => p !== null) }, $expr: { $eq: [{ $size: "$persons" }, persons.length] } }
            ]
        })

        if (relationshipExists) {
            return res.status(400).json({ message: "UUID already taken" })
        }

        const savedRelationship = await newRelationship.save()

        res.status(201).json(savedRelationship)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}   

export const getAllRelationships = async (req, res) => {
    try {
        const relationships = await relationship.find()
        res.status(200).json(relationships)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const getRelationshipById = async (req, res) => {
    try {
        const { id } = req.params
        const foundRelationship = await relationship.findById(id)

        if (!foundRelationship) {
            return res.status(404).json({ message: "Relationship not found" })
        }

        res.status(200).json(foundRelationship)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const updateRelationship = async (req, res) => {
    try {
        const { id } = req.params
        const updatedRelationship = await relationship.findByIdAndUpdate(id, req.body, { new: true })

        if (!updatedRelationship) {
            return res.status(404).json({ message: "Relationship not found" })
        }

        res.status(200).json(updatedRelationship)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const deleteRelationship = async (req, res) => {
    try {
        const { id } = req.params
        const deletedRelationship = await relationship.findByIdAndDelete(id)

        if (!deletedRelationship) {
            return res.status(404).json({ message: "Relationship not found" })
        }

        res.status(200).json({ message: "Relationship deleted successfully" })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}