import mongoose from "mongoose";

const MONGODB_URI =
  "mongodb+srv://designdynasty84_db_user:7gxChkyKhSIBBe8l@cluster0.om8d8e8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

export async function connectMongo() {
  if (
    mongoose.connection.readyState === 1 ||
    mongoose.connection.readyState === 2
  ) {
    return mongoose;
  }
  mongoose.set("strictQuery", true);
  await mongoose.connect(MONGODB_URI);
  console.log("MongoDB connected:", MONGODB_URI);
  return mongoose;
}

export default mongoose;
