import person from "../model/personModel.js"
import relationship from "../model/relationshipModel.js"
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from "./personController.js";

// Direct (depth-1) view: shows the requester's own handle and the handles
// of their direct partners. Pending relationships have otherHandle = null.
// Stable IDs because the user needs them to manage relationships.
export const getDirectRelationships = async (req, res) => {
    try {
        const decoded = requireAuth(req, res);
        if (!decoded) return;
        const { handle } = decoded;

        const me = await person.findOne({ handle });
        if (!me) return res.status(404).json({ message: "Person not found" });

        const directRelationships = [];
        for (const relUUID of me.relationships) {
            const rel = await relationship.findOne({ UUID: relUUID });
            if (!rel) continue;
            const otherHandle = rel.persons.find(h => h !== handle) || null;
            directRelationships.push({
                relationshipUUID: rel.UUID,
                otherHandle,
                romantic: rel.romantic,
                sexual: rel.sexual,
            });
        }

        res.status(200).json({ handle, directRelationships });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal error" });
    }
}

// Wider-graph view: BFS the requester's connected component through discoverable
// users, return edges only with per-request shuffled integer IDs. No handles leak.
export const getRelationshipGraph = async (req, res) => {
    try {
        const decoded = requireAuth(req, res);
        if (!decoded) return;

        let mustberomantic = req.query?.mustberomantic;
        let mustbesexual = req.query?.mustbesexual;
        if (typeof mustberomantic === 'string') mustberomantic = mustberomantic === 'true';
        if (typeof mustbesexual === 'string') mustbesexual = mustbesexual === 'true';
        if (mustberomantic === undefined) mustberomantic = false;
        if (mustbesexual === undefined) mustbesexual = false;
        if (typeof mustberomantic !== 'boolean' || typeof mustbesexual !== 'boolean') {
            return res.status(400).json({ message: "Invalid input" });
        }

        const { handle } = decoded;
        const me = await person.findOne({ handle });
        if (!me) return res.status(404).json({ message: "Person not found" });

        // Discoverability gates both who appears as a node AND who can run the
        // graph at all. If you opt out of being on the wider map, you opt out
        // of seeing it. This preserves symmetry.
        if (me.discoverable === false) {
            return res.status(403).json({ message: "Enable discoverability to view the wider graph." });
        }

        const visited = new Set([handle]);
        const queue = [handle];
        const edges = []; // [handleA, handleB, romantic, sexual]
        const seenRels = new Set();

        while (queue.length > 0) {
            const currentHandle = queue.shift();
            const currentPerson = await person.findOne({ handle: currentHandle });
            if (!currentPerson) continue;

            for (const relUUID of currentPerson.relationships) {
                if (seenRels.has(relUUID)) continue;
                const rel = await relationship.findOne({ UUID: relUUID });
                if (!rel) continue;
                if ((mustberomantic && !rel.romantic) || (mustbesexual && !rel.sexual)) continue;

                for (const otherHandle of rel.persons) {
                    if (!otherHandle || otherHandle === currentHandle) continue;
                    const other = await person.findOne({ handle: otherHandle });
                    if (!other || other.discoverable === false) continue;

                    if (!visited.has(otherHandle)) {
                        visited.add(otherHandle);
                        queue.push(otherHandle);
                    }
                    if (!seenRels.has(relUUID)) {
                        seenRels.add(relUUID);
                        edges.push([currentHandle, otherHandle, rel.romantic, rel.sexual]);
                    }
                }
            }
        }

        // Shuffle the handle order before assigning integer IDs so the ID
        // a node gets is unrelated to BFS discovery order. New IDs on every request.
        const handlesArr = Array.from(visited);
        for (let i = handlesArr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [handlesArr[i], handlesArr[j]] = [handlesArr[j], handlesArr[i]];
        }
        const handleToId = new Map(handlesArr.map((h, i) => [h, i]));

        const ephemeralEdges = edges.map(([a, b, romantic, sexual]) => [
            handleToId.get(a),
            handleToId.get(b),
            romantic,
            sexual
        ]);

        // Map of ephemeral ID to handle for the requester's direct neighbours only.
        // The client already knows these handles (via /direct), so this is not a
        // new leak. It lets the client bridge the direct ring (real handles) into
        // the wider graph (ephemeral IDs) without ambiguity.
        const directNeighborHandles = {};
        for (const relUUID of me.relationships) {
            const rel = await relationship.findOne({ UUID: relUUID });
            if (!rel) continue;
            const otherHandle = rel.persons.find(h => h !== handle);
            if (!otherHandle) continue;
            if (handleToId.has(otherHandle)) {
                directNeighborHandles[handleToId.get(otherHandle)] = otherHandle;
            }
        }

        res.status(200).json({
            edges: ephemeralEdges,
            selfNodeId: handleToId.get(handle),
            nodeCount: handlesArr.length,
            directNeighborHandles,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal error" });
    }
}

export const createRelationshipAsPerson = async (req, res) => {
    try {
        const decoded = requireAuth(req, res)
        if (!decoded) return
        const { romantic, sexual } = req.body || {}
        if (typeof romantic !== "boolean" || typeof sexual !== "boolean") {
            return res.status(400).json({ message: "Invalid input" })
        }
        const { handle } = decoded

        const requestingPerson = await person.findOne({ handle })

        if (!requestingPerson) {
            return res.status(404).json({ message: "Person not found" })
        }

        const newRelationship = new relationship({
            UUID: uuidv4(),
            romantic,
            sexual,
            persons: [handle, null]
        })

        const savedRelationship = await newRelationship.save()

        requestingPerson.relationships.push(savedRelationship.UUID)
        await requestingPerson.save()

        res.status(201).json(savedRelationship.toObject())
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal error" })
    }
}

export const joinRelationshipAsPerson = async (req, res) => {
    try {
        const decoded = requireAuth(req, res)
        if (!decoded) return
        const { relationshipUUID } = req.body || {}
        if (typeof relationshipUUID !== "string") {
            return res.status(400).json({ message: "Invalid input" })
        }
        const { handle } = decoded

        const requestingPerson = await person.findOne({ handle })

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

        if (rel.persons[0] === handle) {
            return res.status(400).json({ message: "Cannot join your own relationship" })
        }

        const relationships_arr = requestingPerson.relationships;
        const relationships_dict = await relationship.find({ UUID: { $in: relationships_arr } })
        for (const curr of relationships_dict) {
            if (curr.persons.includes(handle) && curr.persons.includes(rel.persons[0]) && curr.UUID !== relationshipUUID) {
                return res.status(400).json({ message: "You already have a relationship with that person" })
            }
        }

        rel.persons[1] = handle
        await rel.save()

        await person.updateOne(
            { handle },
            { $addToSet: { relationships: rel.UUID } }
        )

        res.status(200).json(rel)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal error" })
    }
}

export const endRelationshipAsPerson = async (req, res) => {
    try {
        const decoded = requireAuth(req, res)
        if (!decoded) return
        const { relationshipUUID } = req.body || {}
        if (typeof relationshipUUID !== "string") {
            return res.status(400).json({ message: "Invalid input" })
        }
        const { handle } = decoded

        const requestingPerson = await person.findOne({ handle })

        if (!requestingPerson) {
            return res.status(404).json({ message: "Person not found" })
        }

        const rel = await relationship.findOne({ UUID: relationshipUUID })

        if (!rel) {
            return res.status(404).json({ message: "Relationship not found" })
        }

        if (!rel.persons.includes(handle)) {
            return res.status(403).json({ message: "You are not part of this relationship" })
        }

        for (const personHandle of rel.persons) {
            const p = await person.findOne({ handle: personHandle })
            if (p) {
                p.relationships = p.relationships.filter(rUUID => rUUID !== relationshipUUID)
                await p.save()
            }
        }

        await relationship.deleteOne({ UUID: relationshipUUID })

        res.status(200).json({ message: "Relationship ended successfully" })
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal error" })
    }
}

export const editRelationshipAsPerson = async (req, res) => {
    try {
        const decoded = requireAuth(req, res)
        if (!decoded) return
        const { relationshipUUID, romantic, sexual } = req.body || {}
        if (typeof relationshipUUID !== "string") {
            return res.status(400).json({ message: "Invalid input" })
        }
        if (romantic !== undefined && typeof romantic !== "boolean") {
            return res.status(400).json({ message: "Invalid input" })
        }
        if (sexual !== undefined && typeof sexual !== "boolean") {
            return res.status(400).json({ message: "Invalid input" })
        }
        const { handle } = decoded

        const requestingPerson = await person.findOne({ handle })

        if (!requestingPerson) {
            return res.status(404).json({ message: "Person not found" })
        }

        const rel = await relationship.findOne({ UUID: relationshipUUID })

        if (!rel) {
            return res.status(404).json({ message: "Relationship not found" })
        }

        if (!rel.persons.includes(handle)) {
            return res.status(403).json({ message: "You are not part of this relationship" })
        }

        if (romantic !== undefined) rel.romantic = romantic
        if (sexual !== undefined) rel.sexual = sexual
        rel.time_updated = new Date()

        await rel.save()

        res.status(200).json(rel)
    } catch (error) {
        console.error(error)
        res.status(500).json({ message: "Internal error" })
    }
}

export const deleteAllInvalidRelationships = async (req, res) => {
    try {
        const persons = await person.find()
        const existingHandles = new Set(persons.map(p => p.handle))

        const relationships = await relationship.find()

        const uniqueRelationshipPairs = new Set()
        for (const rel of relationships) {
            let shouldDelete = false
            for (const personHandle of rel.persons) {
                if (!personHandle) {
                    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
                    if (rel.time_created < twoWeeksAgo) shouldDelete = true
                    break
                }
                if (!existingHandles.has(personHandle)) {
                    shouldDelete = true
                    break
                }
            }
            const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
            if (rel.time_created < oneYearAgo) shouldDelete = true

            // Only deduplicate completed relationships. Multiple pending invites
            // from the same person all share persons=[handle, null] and would
            // otherwise be incorrectly treated as duplicates of each other.
            const isPending = rel.persons.includes(null);
            if (!isPending) {
                const pairKey = [...rel.persons].sort().join('-');
                if (uniqueRelationshipPairs.has(pairKey)) {
                    shouldDelete = true;
                } else if (!shouldDelete) {
                    uniqueRelationshipPairs.add(pairKey);
                }
            }

            if (shouldDelete) {
                for (const personHandle of rel.persons) {
                    const p = await person.findOne({ handle: personHandle })
                    if (p) {
                        p.relationships = p.relationships.filter(rUUID => rUUID !== rel.UUID)
                        await p.save()
                    }
                }
                await relationship.deleteOne({ UUID: rel.UUID })
            }
        }

        for (const p of persons) {
            const unique = []
            for (const curr of p.relationships) {
                if (!unique.includes(curr)) unique.push(curr)
            }
            p.relationships = unique
            for (const curr of p.relationships) {
                if (!relationships.some(r => r.UUID === curr)) {
                    p.relationships = p.relationships.filter(r => r !== curr)
                }
            }
            await p.save()
        }
        if (res) {
            res.status(200).json({ message: "Cleaned up relationships with nonexistent persons, and duplicate relationships in people." })
        } else {
            console.log("Cleanup completed successfully.")
        }
    } catch (error) {
        console.error(error)
        if (res) {
            res.status(500).json({ message: "Internal error" })
        }
    }
}

