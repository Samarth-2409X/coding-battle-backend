import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import { IUser } from "../types";

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [20, "Username cannot exceed 20 characters"],
      match: [/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false, 
    },
    avatar: {
      type: String,
      default: "",
    },
    stats: {
      totalBattles: { type: Number, default: 0 },
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      rank: { type: Number, default: 0 },
      rating: { type: Number, default: 1000 },
    },
  },
  {
    timestamps: true,
  }
);


userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});


userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};


userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete (ret as any).password;
    return ret;
  },
});

const User = mongoose.model<IUser>("User", userSchema);
export default User;