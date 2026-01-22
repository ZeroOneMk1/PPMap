import mongoose from "mongoose"

const relationshipSchema = new mongoose.Schema({
    UUID: { type: String, required: true, unique: true },
    romantic: { type: Boolean, required: true },
    sexual: { type: Boolean, required: true },
    persons: { type: [String], required: true, minlength: 2, maxlength: 2 }
})

export default mongoose.model("Relationship", relationshipSchema)