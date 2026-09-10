import dotenv from "dotenv";
dotenv.config();

import { createApp } from "./app.js";
import { connectDB } from "./db/connection.js";

const PORT = process.env.PORT || 4000;
const app = createApp();

async function startServer() {
  try {
    if (process.env.MONGODB_URI) {
      await connectDB();
      console.log("Connected to MongoDB successfully.");
    } else {
      console.warn("MONGODB_URI not set; skipping database connection on startup.");
    }

    app.listen(PORT, () => {
      console.log(`Trao API listening on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
