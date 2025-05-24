import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
apiKey: "AIzaSyBxGWPUAiwZ2agUR_tkFoCK6UDLIv5JTC8",
authDomain: "cerebrashackathon.firebaseapp.com",
projectId: "cerebrashackathon",
storageBucket: "cerebrashackathon.firebasestorage.app",
messagingSenderId: "118997242905",
appId: "1:118997242905:web:90f43019de59bbf6c50688",
measurementId: "G-LCSZ846VJC"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export { auth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, db, collection, addDoc, query, orderBy, limit, getDocs };
