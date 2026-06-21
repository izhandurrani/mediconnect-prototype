import admin from 'firebase-admin';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { geohashForLocation } from 'geofire-common';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (!process.env.GOOGLE_PROJECT_ID || !process.env.GOOGLE_CLIENT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
  console.error('Missing Google service account variables in .env.local');
  process.exit(1);
}

const privateKey = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.GOOGLE_PROJECT_ID,
      clientEmail: process.env.GOOGLE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

const db = getFirestore();

const hospitals = [
  {
    name: 'Government Medical College and Hospital (GHATI)',
    city: 'Aurangabad',
    lat: 19.885,
    lng: 75.32,
    phone: '+912402402412',
    schemes: ['ab', 'mj'],
    capabilities: { icu: true, cardiac: true, nicu: true, emergency24x7: true },
    type: 'Government',
    isActive: true,
  },
  {
    name: 'MGM Medical College & Hospital',
    city: 'Aurangabad',
    lat: 19.8644,
    lng: 75.3612,
    phone: '+912402484693',
    schemes: ['ab', 'mj'],
    capabilities: { icu: true, cardiac: true, nicu: true, emergency24x7: true },
    type: 'Private',
    isActive: true,
  },
  {
    name: 'United CIIGMA Hospital',
    city: 'Aurangabad',
    lat: 19.8732,
    lng: 75.3412,
    phone: '+912402470000',
    schemes: ['ab', 'mj'],
    capabilities: { icu: true, cardiac: true, emergency24x7: true },
    type: 'Private',
    isActive: true,
  },
  {
    name: 'Kamalnayan Bajaj Hospital',
    city: 'Aurangabad',
    lat: 19.8844,
    lng: 75.3344,
    phone: '+912402377999',
    schemes: ['ab', 'mj'],
    capabilities: { icu: true, cardiac: true, nicu: true, emergency24x7: true, trauma: true },
    type: 'Trust',
    isActive: true,
  },
  {
    name: 'Seth Nandlal Dhoot Hospital',
    city: 'Aurangabad',
    lat: 19.8914,
    lng: 75.3512,
    phone: '+912402489000',
    schemes: ['ab', 'mj'],
    capabilities: { icu: true, cardiac: true, emergency24x7: true },
    type: 'Private',
    isActive: true,
  },
  {
    name: 'Sigma Hospital',
    city: 'Aurangabad',
    lat: 19.8814,
    lng: 75.3244,
    phone: '+912406616666',
    schemes: ['ab', 'mj'],
    capabilities: { icu: true, cardiac: true, emergency24x7: true },
    type: 'Private',
    isActive: true,
  },
  {
    name: 'Hedgewar Hospital',
    city: 'Aurangabad',
    lat: 19.8514,
    lng: 75.3144,
    phone: '+912402331111',
    schemes: ['mj'],
    capabilities: { icu: true, cardiac: true, emergency24x7: true },
    type: 'Private',
    isActive: true,
  },
  {
    name: 'Apex Hospital',
    city: 'Aurangabad',
    lat: 19.8914,
    lng: 75.3112,
    phone: '+912402345000',
    schemes: ['mj'],
    capabilities: { icu: true, emergency24x7: true },
    type: 'Private',
    isActive: true,
  },
  {
    name: 'Kodlikeri Hospital',
    city: 'Aurangabad',
    lat: 19.8714,
    lng: 75.3312,
    phone: '+912402334800',
    schemes: ['ab', 'mj'],
    capabilities: { icu: true, emergency24x7: true },
    type: 'Private',
    isActive: true,
  },
  {
    name: 'Manik Hospital',
    city: 'Aurangabad',
    lat: 19.8614,
    lng: 75.3444,
    phone: '+912402482881',
    schemes: ['ab'],
    capabilities: { icu: true, cardiac: true, emergency24x7: true },
    type: 'Private',
    isActive: true,
  },
];

async function upsertHospital(hospital) {
  const geohash = geohashForLocation([hospital.lat, hospital.lng]);
  const payload = {
    ...hospital,
    geohash,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const snapshot = await db
    .collection('hospitals')
    .where('name', '==', hospital.name)
    .where('city', '==', hospital.city)
    .get();

  if (snapshot.empty) {
    await db.collection('hospitals').add({
      ...payload,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`Added: ${hospital.name}`);
    return;
  }

  const writes = snapshot.docs.map((docSnap) => docSnap.ref.set(payload, { merge: true }));
  await Promise.all(writes);
  console.log(`Updated ${snapshot.size} doc(s): ${hospital.name}`);
}

async function main() {
  for (const hospital of hospitals) {
    await upsertHospital(hospital);
  }

  console.log('Aurangabad hospital upsert complete.');
}

main().catch((error) => {
  console.error('Failed to seed hospitals:', error);
  process.exit(1);
});
