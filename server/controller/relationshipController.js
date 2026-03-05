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
        let depth = req.body?.depth ?? req.query?.depth;
        let mustberomantic = req.body?.mustberomantic ?? req.query?.mustberomantic;
        let mustbesexual = req.body?.mustbesexual ?? req.query?.mustbesexual;

        // Parse booleans from strings if needed
        if (typeof mustberomantic === 'string') mustberomantic = mustberomantic === 'true';
        if (typeof mustbesexual === 'string') mustbesexual = mustbesexual === 'true';
        if (typeof depth === 'string') depth = parseInt(depth, 10);

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

        if (UUID !== "69420" && depth > 2) {
            return res.status(403).json({ message: "Access denied for depth greater than 2" })
        }

        // Initialize a set to keep track of related persons and relationships taken to get to these persons
        const relatedPersonsSet = new Set([UUID])
        const relationshipsSet = new Set()

        // Helper function to recursively find related persons
        const findRelatedPersons = async (currentPersonUUID, currentDepth) => {
            console.log(`[DEBUG] ` + `    `.repeat(currentDepth-1) + `findRelatedPersons called: UUID=${currentPersonUUID}, depth=${currentDepth}, maxDepth=${depth}`);
            if (currentDepth > depth) {
                console.log(`[DEBUG] ` + `    `.repeat(currentDepth-1) + `Depth exceeded: ${currentDepth} > ${depth}, returning`);
                return;
            }

            // Find the current person
            const currentPerson = await person.findOne({ UUID: currentPersonUUID })
            if (!currentPerson) {
                console.log(`[DEBUG] ` + `    `.repeat(currentDepth-1) + `Person not found: ${currentPersonUUID}`);
                return;
            }
            console.log(`[DEBUG] ` + `    `.repeat(currentDepth-1) + `Found person: ${currentPerson.nickname}, relationships: ${currentPerson.relationships.length}`);

            // Iterate through each relationship of the current person
            for (const relationshipUUID of currentPerson.relationships) {
                console.log(`[DEBUG] ` + `    `.repeat(currentDepth-1) + `Checking relationship: ${relationshipUUID}`);
                const rel = await relationship.findOne({ UUID: relationshipUUID })
                if (!rel) {
                    console.log(`[DEBUG] ` + `    `.repeat(currentDepth-1) + `Relationship not found: ${relationshipUUID}`);
                    continue;
                }
                console.log(`[DEBUG] ` + `    `.repeat(currentDepth-1) + `Relationship found - romantic: ${rel.romantic}, sexual: ${rel.sexual}`);
                if ((mustberomantic && !rel.romantic) || (mustbesexual && !rel.sexual)) {
                    console.log(`[DEBUG] ` + `    `.repeat(currentDepth-1) + `Skipping: filters don't match (mustRomantic=${mustberomantic}, relRomantic=${rel.romantic}, mustSexual=${mustbesexual}, relSexual=${rel.sexual})`);
                    continue;
                }

                // Find the person who the current person is in a relationship with
                for (const personUUID of rel.persons) {
                    console.log(`[DEBUG] ` + `    `.repeat(currentDepth-1) + `Checking person in relationship: ${personUUID}`);
                    if (personUUID && personUUID !== currentPersonUUID && !relatedPersonsSet.has(personUUID)) {
                        // Check if the person is discoverable
                        const relatedPerson = await person.findOne({ UUID: personUUID })
                        if (relatedPerson && relatedPerson.discoverable === false) {
                            console.log(`[DEBUG] ` + `    `.repeat(currentDepth-1) + `Skipping undiscoverable person: ${relatedPerson.nickname}`);
                            continue;
                        }
                        console.log(`[DEBUG] ` + `    `.repeat(currentDepth-1) + `Adding person: ${relatedPerson?.nickname || personUUID}`);
                        // Add the related person UUID to the set and add the relationship too
                        relatedPersonsSet.add(personUUID)
                        relationshipsSet.add(rel.UUID)
                        // Recursively find related persons for the next depth level
                        console.log(`[DEBUG] ` + `    `.repeat(currentDepth-1) + `Recursing into: ${personUUID}`);
                        await findRelatedPersons(personUUID, currentDepth + 1)
                    } else {
                        if (!personUUID) console.log(`[DEBUG] ` + `    `.repeat(currentDepth-1) + `Skipping null person`);
                        if (personUUID === currentPersonUUID) console.log(`[DEBUG] ` + `    `.repeat(currentDepth-1) + `Skipping self: ${personUUID}`);
                        if (relatedPersonsSet.has(personUUID)){
                            console.log(`[DEBUG] ` + `    `.repeat(currentDepth-1) + `Already in set: ${personUUID}. Not Recursing.`);
                            relationshipsSet.add(rel.UUID)
                        }
                    }
                }
            }
        }

        await findRelatedPersons(UUID, 1)

        // Convert sets to arrays for creation of the matrix
        const relatedPersons = Array.from(relatedPersonsSet)
        const relationships = Array.from(relationshipsSet)
        console.log(`[DEBUG] Building matrix: ${relatedPersons.length} persons, ${relationships.length} relationships`);

        // Create the 2D Matrix of Persons
        const matrix = []
        for (const personUUID of relatedPersons) {
            console.log(`[DEBUG] Processing person: ${personUUID}`);
            const row = []
            for (const otherPersonUUID of relatedPersons) {
                if (personUUID === otherPersonUUID) {
                    console.log(`[DEBUG]   Self-relationship: ${personUUID} -> ${otherPersonUUID}, value=0`);
                    row.push(0)
                } else {
                    // Check if there's a relationship between these two persons
                    let isRelated = false
                    for (const relUUID of relationships) {
                        const rel = await relationship.findOne({ UUID: relUUID })
                        if (rel && rel.persons.includes(personUUID) && rel.persons.includes(otherPersonUUID)) {
                            console.log(`[DEBUG]   Found relationship: ${personUUID} <-> ${otherPersonUUID} (${relUUID}), value=1`);
                            isRelated = true
                            break
                        }
                    }
                    if (!isRelated) {
                        console.log(`[DEBUG]   No relationship: ${personUUID} <-> ${otherPersonUUID}, value=0`);
                    }
                    row.push(isRelated ? 1 : 0)
                }
            }
            matrix.push(row)
        }
        console.log(`[DEBUG] Matrix complete: ${matrix.length}x${matrix[0]?.length || 0}`);

        // build a UUID to nickname mapping for matrix labels
        const nicknameMap = {};
        for (const uuid of relatedPersons) {
            const p = await person.findOne({ UUID: uuid });
            nicknameMap[uuid] = p ? p.nickname : uuid;
        }

        const nicknames = [];
        for (const uuid of relatedPersons) {
            nicknames.push(nicknameMap[uuid]);
        }

        // if only looking one degree deep, provide a friendlier list of direct relationships
        let directRelationships = [];
        if (depth === 1) {
            for (const relUUID of relationships) {
                const rel = await relationship.findOne({ UUID: relUUID });
                if (rel && rel.persons.includes(UUID)) {
                    const otherUUID = rel.persons.find(u => u !== UUID);
                    let otherNickname = otherUUID;
                    const otherPerson = await person.findOne({ UUID: otherUUID });
                    if (otherPerson) otherNickname = otherPerson.nickname;
                    directRelationships.push({
                        relationshipUUID: relUUID,
                        otherUUID,
                        otherNickname,
                        romantic: rel.romantic,
                        sexual: rel.sexual
                    });
                }
            }
        }

        res.status(200).json({ relatedPersons, relationships, matrix, directRelationships, nicknames })

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

        // If you already have a different unique relationship with that person, don't join
        const relationships_arr = requestingPerson.relationships;
        const relationships_dict = await relationship.find({ UUID: { $in: relationships_arr } })
        for (const curr_relationships of relationships_dict) {
            if (curr_relationships.persons.includes(UUID) && curr_relationships.UUID !== relationshipUUID) {
                return res.status(400).json({ message: "You already have a relationship with that person" })
            }
        }

        rel.persons[1] = UUID
        await rel.save()

        // Add the relationship to the requesting person's relationships
        await person.updateOne(
        { UUID },
        { $addToSet: { relationships: rel.UUID } }
        )

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
    try {
        const persons = await person.find()
        const existingUUIDs = new Set(persons.map(p => p.UUID))

        const relationships = await relationship.find()
        console.log(`[DEBUG] ${relationships} relationships`)

        // go through all relationships
        const uniqueRelationshipPairs = new Set()
        for (const rel of relationships) {
            let shouldDelete = false
            // Checking person-based conditions (null person, nonexistent person)
            for (const personUUID of rel.persons) {
                // If the relationship has been pending for two weeks, delete it.
                if (!personUUID) {
                    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
                    if (rel.time_created < twoWeeksAgo) {
                        shouldDelete = true
                    }
                    break
                }
                // If the relationship has a person that doesn't exist anymore, delete it.
                if (!existingUUIDs.has(personUUID)) {
                    shouldDelete = true
                    break
                }
            }
            // If the relationship is older than a year, delete it.
            const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
            if (rel.time_created < oneYearAgo) {
                shouldDelete = true
                break
            }
            // If the relationship between the two people already exists
            if (uniqueRelationshipPairs.has(rel.persons.sort().join('-'))) {
                shouldDelete = true
            } else if (!shouldDelete) {
                uniqueRelationshipPairs.add(rel.persons.sort().join('-'))
            }
            // Remove relationships from database
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

        // go through all people
        for (const person of persons) {
            // Remove duplicate relationships in the relationships array
            const uniqueRelationships = []
            for (const curr_relationship of person.relationships) {
                console.log(`[DEBUG] Checking relationship ${curr_relationship} for person ${person.UUID}`)
                if (!uniqueRelationships.includes(curr_relationship)) {
                    console.log(`[DEBUG] Adding relationship ${curr_relationship} for person ${person.UUID}`)
                    uniqueRelationships.push(curr_relationship)
                }else{
                    console.log(`[DEBUG] Skipping relationship ${curr_relationship} for person ${person.UUID}`)
                }
            }
            person.relationships = uniqueRelationships
            console.log(`[DEBUG] Unique relationships for ${person.UUID}:`, uniqueRelationships)
            // Remove any relationships that don't exist anymore
            for (const curr_relationship of person.relationships) {
                // if the current relationship is not in relationships (declared above) delete it from the array
                if (!relationships.some(r => r.UUID === curr_relationship)) {
                    console.log(`[DEBUG] Removing relationship ${curr_relationship} from person ${person.UUID}`)
                    person.relationships = person.relationships.filter(r => r !== curr_relationship)
                }
            }
            console.log(`[DEBUG] Unique relationships for ${person.UUID}:`, uniqueRelationships)
            await person.save()
        }

        res.status(200).json({ message: "Cleaned up relationships with nonexistent persons, and duplicate relationships in people." })
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