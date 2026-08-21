import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, limit } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf-8"));
const app = initializeApp(config);
const db = getFirestore(app);

async function count() {
  const col = collection(db, "requests");
  const snap = await getDocs(col);
  console.log("Total requests in Firestore:", snap.size);
  process.exit(0);
}
count();
