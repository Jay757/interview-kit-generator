import dotenv from "dotenv";
dotenv.config();

import { createApp } from "./app.js";
import { connectDB } from "./db/connection.js";
import { Kit } from "./models/Kit.js";

const PORT = process.env.PORT || 4000;
const app = createApp();

async function startServer() {
  // 1. Bind to PORT immediately so Render and cloud health probes succeed instantly
  const server = app.listen(PORT, () => {
    console.log(`Trao API listening on http://localhost:${PORT}`);
  });

  // 2. Connect to MongoDB
  if (process.env.MONGODB_URI) {
    try {
      await connectDB();
      console.log("Connected to MongoDB successfully.");

      // Clean up orphaned generating kits from any previous crashed/interrupted runs
      try {
        const orphaned = await Kit.updateMany(
          { status: "generating" },
          {
            $set: {
              status: "failed",
              errorCode: "SERVER_RESTARTED",
              errorMessage:
                "Generation was interrupted by a server restart. Please create a new kit.",
            },
          }
        );
        if (orphaned.modifiedCount > 0) {
          console.log(
            `Cleaned up ${orphaned.modifiedCount} orphaned kit generation(s) from previous session.`
          );
        }
      } catch (cleanErr) {
        console.warn("Could not sweep orphaned kits on startup:", cleanErr);
      }
    } catch (error: any) {
      console.error("❌ Failed to connect to MongoDB:", error.message);
      console.warn(
        "⚠️ Ensure '0.0.0.0/0' is added to MongoDB Atlas Network Access so Render can connect."
      );
    }
  } else {
    console.warn("MONGODB_URI not set; skipping database connection on startup.");
  }
}

startServer();
