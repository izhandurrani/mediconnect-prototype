import admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.local or .env in the root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// 1. Ensure required environment variables exist
if (!process.env.GOOGLE_PROJECT_ID || !process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
  console.error("❌ Missing Google Service Account environment variables.");
  console.error("   Ensure GOOGLE_PROJECT_ID, GOOGLE_CLIENT_EMAIL, and GOOGLE_PRIVATE_KEY are set in .env.local");
  process.exit(1);
}

console.log("✅ Environment variables loaded:");
console.log(`   - Project ID: ${process.env.GOOGLE_PROJECT_ID}`);
console.log(`   - Client Email: ${process.env.GOOGLE_CLIENT_EMAIL}`);
console.log(`   - Private Key: ${process.env.GOOGLE_PRIVATE_KEY ? "[LOADED - HIDDEN]" : "[MISSING]"}`);

// Fix escaped newlines in the private key (needed when loaded from .env)
const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

// 2. Initialize Firebase Admin
initializeApp({
  credential: cert({
    projectId: process.env.GOOGLE_PROJECT_ID,
    clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
    privateKey: privateKey,
  })
});

const db = getFirestore();

// 3. Top 50 Hospitals Dataset
const hospitals = [
  // Mumbai
  { name: "Lilavati Hospital & Research Centre", lat: 19.0511, lng: 72.8286, city: "Mumbai", phone: "+912226751000", schemes: ["ab", "mj"], capabilities: { icu: true, cardiac: true } },
  { name: "Nanavati Max Super Speciality Hospital", lat: 19.0911, lng: 72.8412, city: "Mumbai", phone: "+912226267500", schemes: ["ab"], capabilities: { icu: true, cardiac: true } },
  { name: "Kokilaben Dhirubhai Ambani Hospital", lat: 19.1315, lng: 72.8252, city: "Mumbai", phone: "+912230666666", schemes: ["mj"], capabilities: { icu: true, cardiac: true, nicu: true } },
  { name: "Fortis Hospital, Mulund", lat: 19.1726, lng: 72.9542, city: "Mumbai", phone: "+912243654365", schemes: ["ab", "mj"], capabilities: { icu: true, cardiac: true } },
  { name: "Jaslok Hospital & Research Centre", lat: 18.9736, lng: 72.8091, city: "Mumbai", phone: "+912266573333", schemes: ["ab"], capabilities: { icu: true, cardiac: true } },
  { name: "H. N. Reliance Foundation Hospital", lat: 18.9582, lng: 72.8202, city: "Mumbai", phone: "+911800221166", schemes: ["mj"], capabilities: { icu: true, cardiac: true, nicu: true } },
  { name: "Breach Candy Hospital", lat: 18.9722, lng: 72.8044, city: "Mumbai", phone: "+912223667788", schemes: ["ab"], capabilities: { icu: true, cardiac: true } },
  { name: "Bombay Hospital & Medical Research Centre", lat: 18.9404, lng: 72.8277, city: "Mumbai", phone: "+912222067676", schemes: ["ab", "mj"], capabilities: { icu: true, cardiac: true } },
  { name: "S. L. Raheja Hospital", lat: 19.0444, lng: 72.8427, city: "Mumbai", phone: "+912266529999", schemes: ["ab"], capabilities: { icu: true, cardiac: true } },
  { name: "Global Hospital, Parel", lat: 19.0062, lng: 72.8415, city: "Mumbai", phone: "+912267670101", schemes: ["mj"], capabilities: { icu: true, cardiac: true } },

  // Pune
  { name: "Jehangir Hospital", lat: 18.5284, lng: 73.8741, city: "Pune", phone: "+912066819999", schemes: ["ab", "mj"], capabilities: { icu: true, cardiac: true } },
  { name: "Ruby Hall Clinic", lat: 18.5323, lng: 73.8767, city: "Pune", phone: "+912066455100", schemes: ["ab"], capabilities: { icu: true, cardiac: true } },
  { name: "Sahyadri Super Speciality Hospital", lat: 18.5133, lng: 73.8322, city: "Pune", phone: "+912067213000", schemes: ["mj"], capabilities: { icu: true, cardiac: true, nicu: true } },
  { name: "Noble Hospital", lat: 18.5088, lng: 73.9189, city: "Pune", phone: "+912066285000", schemes: ["ab", "mj"], capabilities: { icu: true, cardiac: true } },
  { name: "Deenanath Mangeshkar Hospital", lat: 18.5072, lng: 73.8291, city: "Pune", phone: "+912040151000", schemes: ["ab"], capabilities: { icu: true, cardiac: true, nicu: true } },
  { name: "Inlaks & Budhrani Hospital", lat: 18.5372, lng: 73.8867, city: "Pune", phone: "+912066099999", schemes: ["mj"], capabilities: { icu: true, cardiac: true } },
  { name: "Aditya Birla Memorial Hospital", lat: 18.6186, lng: 73.7744, city: "Pune", phone: "+912030717500", schemes: ["ab", "mj"], capabilities: { icu: true, cardiac: true } },
  { name: "Poona Hospital & Research Centre", lat: 18.5094, lng: 73.8444, city: "Pune", phone: "+912066031500", schemes: ["ab"], capabilities: { icu: true, cardiac: true } },
  { name: "Jupiter Hospital", lat: 18.5584, lng: 73.7844, city: "Pune", phone: "+912027219000", schemes: ["mj"], capabilities: { icu: true, cardiac: true, nicu: true } },
  { name: "Columbia Asia Hospital", lat: 18.5517, lng: 73.9344, city: "Pune", phone: "+912071290129", schemes: ["ab"], capabilities: { icu: true, cardiac: true } },

  // Delhi
  { name: "AIIMS Delhi", lat: 28.5672, lng: 77.2100, city: "Delhi", phone: "+911126588500", schemes: ["ab", "mj"], capabilities: { icu: true, cardiac: true, nicu: true } },
  { name: "Indraprastha Apollo Hospital", lat: 28.5414, lng: 77.2847, city: "Delhi", phone: "+911126925858", schemes: ["ab"], capabilities: { icu: true, cardiac: true } },
  { name: "Sir Ganga Ram Hospital", lat: 28.6384, lng: 77.1894, city: "Delhi", phone: "+911125735205", schemes: ["mj"], capabilities: { icu: true, cardiac: true } },
  { name: "Max Super Speciality Hospital, Saket", lat: 28.5272, lng: 77.2117, city: "Delhi", phone: "+911126515050", schemes: ["ab", "mj"], capabilities: { icu: true, cardiac: true, nicu: true } },
  { name: "Fortis Escorts Heart Institute", lat: 28.5604, lng: 77.2731, city: "Delhi", phone: "+911147135000", schemes: ["ab"], capabilities: { icu: true, cardiac: true } },
  { name: "Medanta - The Medicity", lat: 28.4414, lng: 77.0422, city: "Delhi", phone: "+911244141414", schemes: ["mj"], capabilities: { icu: true, cardiac: true } },
  { name: "BLK-Max Super Speciality Hospital", lat: 28.6434, lng: 77.1794, city: "Delhi", phone: "+911130403040", schemes: ["ab", "mj"], capabilities: { icu: true, cardiac: true } },
  { name: "Primus Super Speciality Hospital", lat: 28.5914, lng: 77.1844, city: "Delhi", phone: "+911166206620", schemes: ["ab"], capabilities: { icu: true, cardiac: true } },
  { name: "Moolchand Hospital", lat: 28.5654, lng: 77.2344, city: "Delhi", phone: "+911142000000", schemes: ["mj"], capabilities: { icu: true, cardiac: true } },
  { name: "Holy Family Hospital", lat: 28.5614, lng: 77.2744, city: "Delhi", phone: "+911126845900", schemes: ["ab", "mj"], capabilities: { icu: true, cardiac: true } },

  // Bangalore
  { name: "Narayana Health City", lat: 12.8122, lng: 77.6934, city: "Bangalore", phone: "+918071222222", schemes: ["ab", "mj"], capabilities: { icu: true, cardiac: true, nicu: true } },
  { name: "Manipal Hospital, Old Airport Road", lat: 12.9592, lng: 77.6444, city: "Bangalore", phone: "+918025024444", schemes: ["ab"], capabilities: { icu: true, cardiac: true } },
  { name: "Aster CMI Hospital", lat: 13.0494, lng: 77.5944, city: "Bangalore", phone: "+918043420100", schemes: ["mj"], capabilities: { icu: true, cardiac: true, nicu: true } },
  { name: "Fortis Hospital, Bannerghatta Road", lat: 12.8944, lng: 77.5994, city: "Bangalore", phone: "+918066214444", schemes: ["ab", "mj"], capabilities: { icu: true, cardiac: true } },
  { name: "St. John's Medical College Hospital", lat: 12.9344, lng: 77.6194, city: "Bangalore", phone: "+918022065000", schemes: ["ab"], capabilities: { icu: true, cardiac: true, nicu: true } },
  { name: "Sakra World Hospital", lat: 12.9244, lng: 77.6844, city: "Bangalore", phone: "+918049694969", schemes: ["mj"], capabilities: { icu: true, cardiac: true } },
  { name: "Apollo Hospitals, Sheshadripuram", lat: 12.9884, lng: 77.5744, city: "Bangalore", phone: "+918046688888", schemes: ["ab", "mj"], capabilities: { icu: true, cardiac: true } },
  { name: "Cloudnine Hospital, Jayanagar", lat: 12.9324, lng: 77.5844, city: "Bangalore", phone: "+918067999999", schemes: ["ab"], capabilities: { icu: true, nicu: true } },
  { name: "Sparsh Hospital", lat: 12.9784, lng: 77.5944, city: "Bangalore", phone: "+918067333333", schemes: ["mj"], capabilities: { icu: true, cardiac: true } },
  { name: "Columbia Asia Referral Hospital", lat: 13.0114, lng: 77.5544, city: "Bangalore", phone: "+918039898969", schemes: ["ab", "mj"], capabilities: { icu: true, cardiac: true } },

  // Aurangabad (Chhatrapati Sambhajinagar)
  { name: "United CIIGMA Hospital", lat: 19.8732, lng: 75.3412, city: "Aurangabad", phone: "+912402470000", schemes: ["ab", "mj"], capabilities: { icu: true, cardiac: true } },
  { name: "MGM Medical College & Hospital", lat: 19.8644, lng: 75.3612, city: "Aurangabad", phone: "+912402484693", schemes: ["ab"], capabilities: { icu: true, cardiac: true, nicu: true } },
  { name: "Kamalnayan Bajaj Hospital", lat: 19.8844, lng: 75.3344, city: "Aurangabad", phone: "+912402377999", schemes: ["mj"], capabilities: { icu: true, cardiac: true } },
  { name: "Seth Nandlal Dhoot Hospital", lat: 19.8914, lng: 75.3512, city: "Aurangabad", phone: "+912402489000", schemes: ["ab", "mj"], capabilities: { icu: true, cardiac: true } },
  { name: "Sigma Hospital", lat: 19.8814, lng: 75.3244, city: "Aurangabad", phone: "+912406616666", schemes: ["ab"], capabilities: { icu: true, cardiac: true } },
  { name: "Hedgewar Hospital", lat: 19.8514, lng: 75.3144, city: "Aurangabad", phone: "+912402331111", schemes: ["mj"], capabilities: { icu: true, cardiac: true } },
  { name: "Kodlikeri Hospital", lat: 19.8714, lng: 75.3312, city: "Aurangabad", phone: "+912402334800", schemes: ["ab", "mj"], capabilities: { icu: true } },
  { name: "Manik Hospital", lat: 19.8614, lng: 75.3444, city: "Aurangabad", phone: "+912402482881", schemes: ["ab"], capabilities: { icu: true, cardiac: true } },
  { name: "Apex Hospital", lat: 19.8914, lng: 75.3112, city: "Aurangabad", phone: "+912402345000", schemes: ["mj"], capabilities: { icu: true } },
  { name: "Lifeline Hospital", lat: 19.8514, lng: 75.3544, city: "Aurangabad", phone: "+912402481000", schemes: ["ab", "mj"], capabilities: { icu: true, cardiac: true } }
];

// 4. Seeding Function
async function seed() {
  console.log("🚀 Starting Seeding Process...");
  const batch = db.batch();
  
  hospitals.forEach((h) => {
    const docRef = db.collection('hospitals').doc();
    batch.set(docRef, {
      ...h,
      createdAt: admin.firestore.Timestamp.now()
    });
  });

  try {
    await batch.commit();
    console.log("✅ Success: 50 hospitals seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding Failed:", error);
    process.exit(1);
  }
}

seed();
