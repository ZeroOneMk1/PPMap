import person from "../model/personModel.js"
import relationship from "../model/relationshipModel.js"
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// simple token extractor (similar to personController helper)
function extractToken(req) {
    let token;
    if (req.body) {
        if (typeof req.body === 'string') {
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

export const getRelatedPersons = async (req, res) => {
    try {
        const token = extractToken(req);
        const depth = req.body?.depth ?? req.query?.depth;
        const mustberomantic = req.body?.mustberomantic ?? req.query?.mustberomantic;
        const mustbesexual = req.body?.mustbesexual ?? req.query?.mustbesexual;

        if (!token) {
            return res.status(401).json({ message: "Token is required" });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const { UUID } = decoded

        const requestingPerson = await person.findOne({ UUID })

        if (!requestingPerson) {
            return res.status(404).json({ message: "Person not found" })
        }
        
        if (depth < 1) {
            return res.status(400).json({ message: "Depth must be at least 1" })
        }

        if (requestingPerson.discoverable === false && depth > 1) {
            return res.status(403).json({ message: "Person is not discoverable. Enable discoverability to access this feature." })
        }

        if (UUID !== 69420 && depth > 2) {
            return res.status(403).json({ message: "Access denied for depth greater than 2" })
        }

        // Initialize a set to keep track of related persons and relationships taken to get to these persons
        const relatedPersonsSet = new Set()
        const relationshipsSet = new Set()

        // Helper function to recursively find related persons
        const findRelatedPersons = async (currentPersonUUID, currentDepth) => {
            if (currentDepth > depth) return

            // Find the current person
            const currentPerson = await person.findOne({ UUID: currentPersonUUID })
            if (!currentPerson) return

            // Iterate through each relationship of the current person
            for (const relationshipUUID of currentPerson.relationships) {
                const rel = await relationship.findOne({ UUID: relationshipUUID })
                if (!rel || (mustberomantic && !rel.romantic) || (mustbesexual && !rel.sexual)) continue

                // Find the person who the current person is in a relationship with
                for (const personUUID of rel.persons) {
                    if (personUUID && personUUID !== currentPersonUUID && !relatedPersonsSet.has(personUUID)) {
                        // Check if the person is discoverable
                        const relatedPerson = await person.findOne({ UUID: personUUID })
                        if (relatedPerson && relatedPerson.discoverable === false) continue
                        // Add the related person UUID to the set and add the relationship too
                        relatedPersonsSet.add(personUUID)
                        relationshipsSet.add(rel.UUID)
                        // Recursively find related persons for the next depth level
                        await findRelatedPersons(personUUID, currentDepth + 1)
                    }
                }
            }
        }

        await findRelatedPersons(UUID, 1)

        // Convert sets to arrays for creation of the matrix
        const relatedPersons = Array.from(relatedPersonsSet)
        const relationships = Array.from(relationshipsSet)

        // Create the 2D Matrix of Persons
        const matrix = []
        for (const personUUID of relatedPersons) {
            const row = []
            for (const otherPersonUUID of relatedPersons) {
                if (personUUID === otherPersonUUID) {
                    row.push(0)
                } else {
                    // Check if there's a relationship between these two persons
                    let isRelated = false
                    for (const relUUID of relationships) {
                        const rel = await relationship.findOne({ UUID: relUUID })
                        if (rel && rel.persons.includes(personUUID) && rel.persons.includes(otherPersonUUID)) {
                            isRelated = true
                            break
                        }
                    }
                    row.push(isRelated ? 1 : 0)
                }
            }
            matrix.push(row)
        }

        res.status(200).json({ relatedPersons, relationships, matrix })

    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const createRelationshipAsPerson = async (req, res) => {
    try {
        const { token, romantic, sexual } = req.body
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const { UUID } = decoded

        const requestingPerson = await person.findOne({ UUID })

        if (!requestingPerson) {
            return res.status(404).json({ message: "Person not found" })
        }

        const newRelationship = new relationship({
            UUID: uuidv4(),
            romantic,
            sexual,
            persons: [UUID, null]
        })

        const savedRelationship = await newRelationship.save()

        // Add the relationship to the requesting person's relationships
        requestingPerson.relationships.push(savedRelationship.UUID)
        await requestingPerson.save()

        const responseObj = savedRelationship.toObject();
        responseObj.joinUrl = `http://localhost:3000/join-relationship/${savedRelationship.UUID}`;
        res.status(201).json(responseObj)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const joinRelationshipAsPerson = async (req, res) => {
    try {
        const { token, relationshipUUID } = req.body
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const { UUID } = decoded

        const requestingPerson = await person.findOne({ UUID })

        if (!requestingPerson) {
            return res.status(404).json({ message: "Person not found" })
        }

        const rel = await relationship.findOne({ UUID: relationshipUUID })

        if (!rel) {
            return res.status(404).json({ message: "Relationship not found" })
        }

        if (rel.persons[1] !== null) {
            return res.status(400).json({ message: "Relationship is already full" })
        }

        if (rel.persons[0] === UUID) {
            return res.status(400).json({ message: "Cannot join your own relationship" })
        }

        rel.persons[1] = UUID
        await rel.save()

        // Add the relationship to the requesting person's relationships
        requestingPerson.relationships.push(rel.UUID)
        await requestingPerson.save()

        res.status(200).json(rel)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const endRelationshipAsPerson = async (req, res) => {
    try {
        const { token, relationshipUUID } = req.body
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const { UUID } = decoded

        const requestingPerson = await person.findOne({ UUID })

        if (!requestingPerson) {
            return res.status(404).json({ message: "Person not found" })
        }

        const rel = await relationship.findOne({ UUID: relationshipUUID })

        if (!rel) {
            return res.status(404).json({ message: "Relationship not found" })
        }

        if (!rel.persons.includes(UUID)) {
            return res.status(403).json({ message: "You are not part of this relationship" })
        }

        // Remove the relationship from both persons
        for (const personUUID of rel.persons) {
            const p = await person.findOne({ UUID: personUUID })
            if (p) {
                p.relationships = p.relationships.filter(rUUID => rUUID !== relationshipUUID)
                await p.save()
            }
        }

        // Delete the relationship
        await relationship.deleteOne({ UUID: relationshipUUID })

        res.status(200).json({ message: "Relationship ended successfully" })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const editRelationshipAsPerson = async (req, res) => {
    try {
        const { token, relationshipUUID, romantic, sexual } = req.body
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const { UUID } = decoded

        const requestingPerson = await person.findOne({ UUID })

        if (!requestingPerson) {
            return res.status(404).json({ message: "Person not found" })
        }

        const rel = await relationship.findOne({ UUID: relationshipUUID })

        if (!rel) {
            return res.status(404).json({ message: "Relationship not found" })
        }

        if (!rel.persons.includes(UUID)) {
            return res.status(403).json({ message: "You are not part of this relationship" })
        }

        // Update relationship details
        if (romantic !== undefined) rel.romantic = romantic
        if (sexual !== undefined) rel.sexual = sexual
        rel.time_updated = new Date()

        await rel.save()

        res.status(200).json(rel)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const deleteAllInvalidRelationships = async (req, res) => {
    // go through all relationships and make sure each one does not contain a nonexistent UUID
    try {
        const persons = await person.find()
        const existingUUIDs = new Set(persons.map(p => p.UUID))

        const relationships = await relationship.find()

        for (const rel of relationships) {
            let shouldDelete = false
            for (const personUUID of rel.persons) {
                if (!personUUID) {
                    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
                    if (rel.time_created < twoWeeksAgo) {
                        shouldDelete = true
                    }
                    break
                }
                if (!existingUUIDs.has(personUUID)) {
                    shouldDelete = true
                    break
                }
                const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
                if (rel.time_created < oneYearAgo) {
                    shouldDelete = true
                    break
                }
            }
            if (shouldDelete) {
                // Remove this relationship from all persons who have it
                for (const personUUID of rel.persons) {
                    const p = await person.findOne({ UUID: personUUID })
                    if (p) {
                        p.relationships = p.relationships.filter(rUUID => rUUID !== rel.UUID)
                        await p.save()
                    }
                }
                // Delete the relationship
                await relationship.deleteOne({ UUID: rel.UUID })
            }
        }

        res.status(200).json({ message: "Cleaned up relationships with nonexistent persons" })
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}

export const getPendingRelationships = async (req, res) => {
    try {
        const token = extractToken(req);
        if (!token) {
            return res.status(401).json({ message: "Token is required" });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const { UUID } = decoded

        const requestingPerson = await person.findOne({ UUID })

        if (!requestingPerson) {
            return res.status(404).json({ message: "Person not found" })
        }

        const pendingRelationships = []

        for (const relationshipUUID of requestingPerson.relationships) {
            const rel = await relationship.findOne({ UUID: relationshipUUID })
            if (rel && rel.persons.includes(UUID) && rel.persons.includes(null)) {
                const relObj = rel.toObject();
                relObj.joinUrl = `http://localhost:3000/join-relationship/${rel.UUID}`;
                pendingRelationships.push(relObj)
            }
        }

        res.status(200).json(pendingRelationships)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
}