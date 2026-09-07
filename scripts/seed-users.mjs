// One-time (but safe to rerun) script to populate the `users` collection
// with the 5 named players, per PROJECT_SPEC.md Section 3 ("5 named people,
// no passwords — pick your name from a dropdown"). Run it with:
//
//   node scripts/seed-users.mjs
//
// This is a plain Node.js script, not part of the React app — it uses the
// same Firebase client SDK and config as the app itself (there's no
// separate "admin" backend here, since Firestore has no auth to log into;
// see PROJECT_SPEC.md Section 3).
import { initializeApp } from 'firebase/app'
import { doc, getFirestore, setDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCg4J920Na5ADzo25pfMyURsEcYzM1XFp8',
  authDomain: 'gen-lang-client-0026826837.firebaseapp.com',
  databaseURL: 'https://gen-lang-client-0026826837-default-rtdb.firebaseio.com',
  projectId: 'gen-lang-client-0026826837',
  storageBucket: 'gen-lang-client-0026826837.firebasestorage.app',
  messagingSenderId: '814240070558',
  appId: '1:814240070558:web:9f54257de40f34364b748f',
}

// Fixed, human-readable document IDs (rather than Firestore's random
// auto-IDs) so this script is idempotent — rerunning it updates the same 5
// documents instead of creating duplicates.
const USERS = [
  { id: 'keanan', name: 'Keanan' },
  { id: 'scuba', name: 'Scuba' },
  { id: 'luke', name: 'Luke' },
  { id: 'andrew', name: 'Andrew' },
  { id: 'matt', name: 'Matt' },
]

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

for (const user of USERS) {
  await setDoc(doc(db, 'users', user.id), { name: user.name })
  console.log(`Seeded user: ${user.name}`)
}

console.log('Done.')
process.exit(0)
