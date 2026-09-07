// Central place where we set up the connection to Firebase. Every other file
// that needs to read/write data imports `db` from here rather than
// re-initializing Firebase itself — this is standard practice ("single
// source of truth" for a shared connection) so we don't accidentally create
// multiple, inconsistent connections to the same backend.
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

// This config identifies WHICH Firebase project we're talking to. It is not
// a secret — Firebase's actual security comes from Firestore security rules
// (server-side), not from hiding this config, so it's fine for it to be
// visible in the built JavaScript that ships to users' browsers.
// See PROJECT_SPEC.md Section 3 for the full explanation, including the note
// that `databaseURL` below is for a different Firebase product (Realtime
// Database) that this app does not use — we use Firestore instead.
const firebaseConfig = {
  apiKey: 'AIzaSyCg4J920Na5ADzo25pfMyURsEcYzM1XFp8',
  authDomain: 'gen-lang-client-0026826837.firebaseapp.com',
  databaseURL: 'https://gen-lang-client-0026826837-default-rtdb.firebaseio.com',
  projectId: 'gen-lang-client-0026826837',
  storageBucket: 'gen-lang-client-0026826837.firebasestorage.app',
  messagingSenderId: '814240070558',
  appId: '1:814240070558:web:9f54257de40f34364b748f',
}

const app = initializeApp(firebaseConfig)

// `db` is the handle we use everywhere else to read/write Firestore
// collections (users, weeks, games, picks, etc. — see PROJECT_SPEC.md Section 5).
export const db = getFirestore(app)
