
// firebase-init.js

// Importa los módulos necesarios de Firebase desde la CDN.
// Es crucial usar las URLs de la CDN para que el navegador pueda cargarlos correctamente.
// Revisa siempre la documentación oficial de Firebase para la versión más reciente del SDK:
// https://firebase.google.com/docs/web/setup#available-libraries

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getFirestore,
  // Para los emuladores (si los usas)
  connectFirestoreEmulator, 
  // Funciones principales de Firestore que usas en main.js (y posiblemente en otras funciones de firebase-init.js)
  collection,
  getDocs,
  query,
  where,
  limit,
  startAfter,
  orderBy,
  doc, 
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { getFunctions, connectFunctionsEmulator,httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-functions.js";

// Tu configuración de Firebase (¡mantén tus claves reales aquí!)
const firebaseConfig = {
  apiKey: "AIzaSyCaPg09Rty5Ob3o_jBD1gHwb1hTcv0uqgY",
  authDomain: "tastypoll.firebaseapp.com",
  projectId: "tastypoll",
  storageBucket: "tastypoll.firebasestorage.app",
  messagingSenderId: "439663223508",
  appId: "1:439663223508:web:a1c79c7f80552eeefe1141",
  measurementId: "G-ERPK8703GW"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const functions = getFunctions(app);
export { 
  db, 
  functions,
  collection, // <-- Re-exporta estas también
  getDocs,
  query,
  where,
  limit,
  startAfter,
  orderBy,
  doc,
  getDoc,
  httpsCallable
};



const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

if (isLocalhost) {
  console.log("Detectado entorno local. Conectando a emuladores.");

  // Functions Emulator
  try {
    connectFunctionsEmulator(functions, 'localhost', 5001); // Asegúrate de que el puerto 5001 es correcto
    console.log("Conectado al emulador de Functions en localhost:5001");
  } catch (e) {
    console.error("Error al conectar al emulador de Functions:", e);
  }

  // Firestore Emulator (Si lo usas también)
  // try {
  //   connectFirestoreEmulator(db, 'localhost', 8080);
  //   console.log("Conectado al emulador de Firestore en localhost:8080");
  // } catch (e) {
  //   console.error("Error al conectar al emulador de Firestore:", e);
  // }

} else {
  console.log("Detectado entorno de producción. Conectando a servicios de Firebase desplegados.");
}