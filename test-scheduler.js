
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // mismo directorio que este archivo

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://<tu-proyecto>.firebaseio.com"
});

const db = admin.firestore();

const { runComprobarYDesactivarEncuestasCaducadas } = require("./functions");

setInterval(() => {
  runComprobarYDesactivarEncuestasCaducadas(db)
    .then(() => console.log("✅ Ejecutado manualmente"))
    .catch(console.error);
}, 10 * 1000); // cada minuto
