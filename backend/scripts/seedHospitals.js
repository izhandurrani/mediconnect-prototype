import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { geohashForLocation } from "geofire-common";

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Hardcoded Firebase Config reading from the loaded .env.local values
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase locally without importing from src/lib/firebase.js
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const hospitals = [
  {
    name: "Government Medical College and Hospital (GHATI)",
    lat: 19.8850,
    lng: 75.3200,
    phone: "+91 240 240 2412",
    schemes: ["ab", "mj"],
    capabilities: { icu: true, cardiac: true, nicu: true },
    type: "Government"
  },
  {
    name: "MGM Medical College & Hospital",
    lat: 19.8821,
    lng: 75.3400,
    phone: "+91 240 660 1100",
    schemes: ["ab", "mj"],
    capabilities: { icu: true, cardiac: true, nicu: true },
    type: "Private"
  },
  {
    name: "United CIIGMA Hospital",
    lat: 19.8700,
    lng: 75.3350,
    phone: "+91 240 236 1999",
    schemes: ["mj"],
    capabilities: { icu: true, cardiac: true, nicu: false },
    type: "Private"
  },
  {
    name: "Kamalnayan Bajaj Hospital",
    lat: 19.8450,
    lng: 75.3100,
    phone: "+91 240 237 7999",
    schemes: ["ab", "mj"],
    capabilities: { icu: true, cardiac: true, nicu: true },
    type: "Trust"
  },
  {
    name: "Sigma Hospital",
    lat: 19.8750,
    lng: 75.3500,
    phone: "+91 240 232 2222",
    schemes: ["mj"],
    capabilities: { icu: true, cardiac: false, nicu: false },
    type: "Private"
  }
];

async function seedHospitals() {
  console.log("Seeding hospitals into Firestore...");
  const hospitalsRef = collection(db, "hospitals");

  for (const hospital of hospitals) {
    const beds = Math.floor(Math.random() * 16) + 5;
    const geohash = geohashForLocation([hospital.lat, hospital.lng]);

    const docData = {
      ...hospital,
      beds,
      geohash,
      createdAt: new Date()
    };

    try {
      const docRef = await addDoc(hospitalsRef, docData);
      console.log(`✅ Added ${hospital.name} with ID: ${docRef.id}`);
    } catch (error) {
      console.error(`❌ Failed to add ${hospital.name}:`, error);
    }
  }
  
  console.log("🎉 Seeding complete!");
  process.exit(0);
}

seedHospitals();
