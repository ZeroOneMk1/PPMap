import mongoose from "mongoose"

const personSchema = new mongoose.Schema({
    UUID: { type: String, required: true, unique: true },
    nickname: { type: String, required: true },
    password: { type: String, required: true },
    relationships: { type: [String], default: [] },
})

export default mongoose.model("Person", personSchema)