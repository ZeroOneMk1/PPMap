import mongoose from "mongoose"

const personSchema = new mongoose.Schema({
    handle: { type: String, required: true, unique: true, sparse: true },
    password: { type: String, required: true },
    relationships: { type: [String], default: [] },
    discoverable: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false }
})

export default mongoose.model("Person", personSchema)
