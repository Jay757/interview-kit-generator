import mongoose from "mongoose";

let isConnected = false;

export async function connectDB(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error(
      "Missing required environment variable: MONGODB_URI. Please set MONGODB_URI in your .env file."
    );
  }

  if (isConnected) {
    return mongoose;
  }

  try {
    const conn = await mongoose.connect(uri);
    isConnected = true;
    return conn;
  } catch (error: any) {
    if (uri.startsWith("mongodb+srv") && error?.message?.includes("querySrv")) {
      try {
        const dns = await import("dns");
        dns.setServers(["8.8.8.8", "1.1.1.1"]);
        const conn = await mongoose.connect(uri);
        isConnected = true;
        return conn;
      } catch (retryErr) {
        console.error("Failed to connect to MongoDB with DNS fallback:", retryErr);
        throw retryErr;
      }
    }
    console.error("Failed to connect to MongoDB:", error);
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
  }
}
