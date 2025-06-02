
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require("firebase-functions/v2/https"); 
const { onSchedule } = require("firebase-functions/v2/scheduler"); // Para funciones programadas
const { logger } = require("firebase-functions");
const { defineString } = require("firebase-functions/params");

//const moment = require('moment-timezone'); // Para un manejo robusto de fechas con zonas horarias

///Email///
const nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars").default;
console.log("Tipo de hbs:", typeof hbs); // ¿Es 'function', 'object' u otro?
console.log("Contenido de hbs:", hbs); // Ver todas sus propiedades
const path = require("path");


///const gmailEmail = defineString("GMAIL_EMAIL");
//const gmailPass = defineString("GMAIL_PASS");
//Comandoos
//npm install nodemailer nodemailer-express-handlebars --save



initializeApp();

const db = getFirestore();




///////////// Función registrar voto /////////////////////////////////////////////////////

exports.registrarVotoEncuesta = onCall({ cors: true , allowUnauthenticated: true },async (request, context) => {
  // Cambiado 'data' a 'request' para mayor claridad y consistencia con la documentación.
  try {
    // Accede a los datos a través de request.data
    const { encuestaId, alimentoId, alimentoNombre, emailVotante, requiereEmail } = request.data;

    // Logs para verificar los datos de entrada
    console.log("input encuestaId: " + encuestaId);
    console.log("input alimentoId: " + alimentoId);
    console.log("input alimentoNombre: " + alimentoNombre);
    console.log("input emailVotante: " + emailVotante);
    console.log("input requiereEmail: " + requiereEmail);

    await db.runTransaction(async (transaction) => {
      comprobarDatosEncuesta(encuestaId, alimentoId, alimentoNombre);
      const encuestaRef = db.collection('encuestas').doc(encuestaId);
      const docSnapshot = await transaction.get(encuestaRef);

      comprobarSiEncuestaExiste(docSnapshot); // Lanza error si no existe
      const datosEncuesta = docSnapshot.data();
      comprobarSiEncuestaEstaActiva(datosEncuesta); // Lanza error si no está activa
      const updates = crearActulización(datosEncuesta, alimentoId, alimentoNombre, requiereEmail, emailVotante);
      transaction.update(encuestaRef, updates);
    });


    return { success: true, message: "Datos recibidos correctamente en la función." };

  } catch (error) {
    console.log(error);
    console.error("Error dentro de registrarVotoEncuesta:", error); // Loguea el error real en Cloud Functions

    // Lanza un HttpsError para que el cliente lo maneje correctamente
    throw new HttpsError('internal', 'Ocurrió un error interno al procesar el voto. Por favor, inténtalo de nuevo.');
    // También puedes usar 'invalid-argument', 'unauthenticated', etc., dependiendo de la causa real del error.
  }
});

////////////// Funciones privadas ///////////////////////
function comprobarDatosEncuesta(encuestaId, alimentoId, nombreAlimento) {
  // Aseguramos que la variable existe y luego que .trim() se pueda llamar.
  // Si es undefined/null, la condición !variable la captura.
  if (!encuestaId || (typeof encuestaId === 'string' && encuestaId.trim() === '') || 
      !alimentoId || (typeof alimentoId === 'string' && alimentoId.trim() === '') || 
      !nombreAlimento || (typeof nombreAlimento === 'string' && nombreAlimento.trim() === '')) {
    throw new HttpsError( 
      'invalid-argument',
      'Faltan parámetros requeridos: encuestaId, alimentoId, nombreAlimento.'
    );
  }
}
  
  // *** FUNCIÓN AJUSTADA: crearActulización
  function crearActulización(datosEncuesta, alimentoId, nombreAlimento, requiereEmail, emailVotante) {
    const updates = {
      votos: crearVoto(datosEncuesta, alimentoId, nombreAlimento)
    };
    
    if (requiereEmail && emailVotante && emailVotante !== 'NoEmail' && typeof emailVotante === 'string' && emailVotante.trim() !== '') {
      console.log("FieldValue definido:", FieldValue); // debe imprimir un objeto, no undefined

      updates.emails = FieldValue.arrayUnion(emailVotante);
    }
    
    return updates;
  }
  
  // Las siguientes funciones están correctas, solo las incluyo para que tengas el bloque completo:
  
function crearVoto(datosEncuesta, idAlimento, nombreAlimento) {
  let votosActuales = Array.isArray(datosEncuesta.votos) ? datosEncuesta.votos : [];

  
  let alimentoYaVotado = false;
  const nuevosVotos = votosActuales.map(voto => {
    if (voto.idAlimento === idAlimento) {
      alimentoYaVotado = true;
      return {
        idAlimento: voto.idAlimento,
        nombreAlimento: voto.nombreAlimento,
        conteo: voto.conteo + 1
      };
    }
    return voto;
  });
  
  if (!alimentoYaVotado) {
    nuevosVotos.push({
      idAlimento: idAlimento,
      nombreAlimento: nombreAlimento,
      conteo: 1
    });
  }
  return nuevosVotos;
}
  
function comprobarSiEncuestaExiste(docSnapshot) {
  if (!docSnapshot.exists) {
    throw new HttpsError(
      'not-found',
      'La encuesta no existe o fue eliminada.'
    );
  }
}
  
  function comprobarSiEncuestaEstaActiva(datosEncuesta) {
  if (!datosEncuesta.activa) {
    throw new HttpsError(
      'failed-precondition',
      'Esta encuesta ya no está activa y no acepta más votos.'
    );
  }
}










//////// Función desactivar encuesta ///////////////////////////////////


exports.desactivarEncuesta = onCall({ cors: true, allowUnauthenticated: true }, async (request, context) => {
  const { encuestaId } = request.data
  const result = await desactivarEncuestaLogica(encuestaId,db);

  if (!result.success) {
    // Si la lógica interna falla, lanzamos un HttpsError apropiado para el frontend.
    if (result.message.includes('no válido')) {
      throw new HttpsError('invalid-argument', result.message);
    } else if (result.message.includes('no encontrada')) {
      throw new HttpsError('not-found', result.message);
    } else {
      throw new HttpsError('internal', result.message);
    }
  }
  return result; // Devuelve el resultado de éxito al frontend
});

////// Lógica ////////

async function desactivarEncuestaLogica(encuestaId,db) {
  if (!encuestaId || typeof encuestaId !== 'string' || encuestaId.trim() === '') {
    console.error("Error (deactivateSurveyCoreLogic): ID de encuesta no válido.");
    return { success: false, message: 'ID de encuesta no válido.' };
  }

  try {
    const encuestaRef = db.collection('encuestas').doc(encuestaId);
    const docSnapshot = await encuestaRef.get();

    if (!docSnapshot.exists) {
      console.warn(`(deactivateSurveyCoreLogic) Encuesta ${encuestaId} no encontrada.`);
      return { success: false, message: 'Encuesta no encontrada.' };
    }

    const datosEncuesta = docSnapshot.data();

    if (datosEncuesta.activa) {
      await encuestaRef.update({ activa: false });

      await mandarResultadosAUsuarios(datosEncuesta.emails, datosEncuesta.votos,datosEncuesta.descripcion,datosEncuesta.nombre,db);
      console.log(`(deactivateSurveyCoreLogic) Encuesta ${encuestaId} desactivada.`);
      return { success: true, message: `Encuesta ${encuestaId} desactivada.` };
    } else {
      console.log(`(deactivateSurveyCoreLogic) Encuesta ${encuestaId} ya estaba inactiva.`);
      return { success: true, message: `Encuesta ${encuestaId} ya estaba inactiva.` };
    }

  } catch (error) {
    console.error(`Error (deactivateSurveyCoreLogic) al desactivar ${encuestaId}:`, error);
    return { success: false, message: `Error interno: ${error.message}` };
  }
}







//user: "noreply.tastypoll@gmail.com",
  //  pass: "eynz pxkp edvh lacm",



////// Email ///////////

function getTransporter() {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "noreply.tastypoll@gmail.com",
      pass: "eynz pxkp edvh lacm",
    },
  });

  // AÑADIR ESTA CONFIGURACIÓN:
  const handlebarOptions = {
    viewEngine: {
      extName: ".handlebars",
      defaultLayout: false,
    },
    viewPath: path.resolve(__dirname, "views"),
    extName: ".handlebars",
  };


  transporter.use("compile", hbs(handlebarOptions)); // ← ESTA LÍNEA ES CLAVE
  
  return transporter;
}
//transporter.use("compile", hbs(handlebarOptions));

/// Función enviar emails ////////////

async function mandarResultadosAUsuarios(listaEmails, votos, descripcion, nombre, db){
  if(listaEmails && votos && Array.isArray(listaEmails) && Array.isArray(votos)) { // AÑADIR Array.isArray(votos)
    const listaAlimentos = await extraerDatosVotos(votos, db); 
    await enviarEmails(listaAlimentos, listaEmails, descripcion, nombre);
  } else {
    console.log("No se pueden enviar emails: datos inválidos");
  }
}
async function enviarEmails(listaAlimentos, emails, descripcion, nombre){

  console.log("enviando emails");
  console.log(emails);
  const transporter = getTransporter(); 
  const emailContext = {
    nombreEncuesta: nombre,         // Viene del parámetro nombreEncuesta
    descripcionEncuesta: descripcion, // Viene del parámetro descripcionEncuesta
    topAlimentos: listaAlimentos,          // Viene del parámetro listaAlimentos
  };

  const baseMailOptions = {
    from: '"Tu App de Encuestas" <noreply.tastypoll@gmail.com>', // Remitente
    subject: "Resultados de la encuesta",
    template: "resumenEncuesta", // El nombre del archivo .handlebars sin la extensión
    context: emailContext, // Datos para la plantilla
  };

  for(const email of emails){
    const emailOptions = {...baseMailOptions,
      to:email};
    try {
      const info = await transporter.sendMail(emailOptions);
      console.log(`Email enviado con éxito a ${email}: `, info);

    } catch (error) {
      console.log(`Error al enviar email a ${email}: `, error);
    }
  }
}
  

async function  extraerDatosVotos(votos,db){
  const listaAlimentos = []

  const alimentosMasVotados = votos.sort((a, b) => b.conteo - a.conteo)
    .slice(0, 3);
    

  console.log("extrayendo datos");
  for (const alimento of alimentosMasVotados) {
    const alimentoRef = db.collection('alimentos').doc(alimento.idAlimento);
    const snapshot = await alimentoRef.get();
    if(snapshot.exists){
      const datosAlimento = snapshot.data();

      listaAlimentos.push({
        nombre: datosAlimento.nombre, 
        votos: alimento.conteo, 
        urlImagen: datosAlimento.urlImagen 
      });
    }
  } 
  
  console.log(listaAlimentos);
  return listaAlimentos;
}

















///Función comprobarYDescactivarEncuestasCaducadas
//Se usara solo en cloud //
exports.comprobarYDescactivarEncuestasCaducadas = onSchedule("every 60 seconds", async (event) => {
  await runComprobarYDesactivarEncuestasCaducadas(db);
});

/// Lógica //
async function runComprobarYDesactivarEncuestasCaducadas(db) {
  try {
    const encuestasActivas = await db.collection('encuestas')
      .where('activa', '==', true) 
      .get();

    //Si estan vacias sale
    if (encuestasActivas.empty) {
      console.log("No hay encuestas activas para comprobar en este momento.");
      return;
    }
    const fechaActual = new Date();
    for (const doc of encuestasActivas.docs) {
      const datosEncuesta = doc.data(); 
         
      if(fechaActual > datosEncuesta.fechaVencimiento.toDate()){
        const encuestaId = doc.id;  
        console.log("Desactivando enceusta con id: "+ encuestaId);
        await desactivarEncuestaLogica(encuestaId,db);
      }
    }

    
  } catch (error) {
    console.error(error);
  }
}


module.exports = { runComprobarYDesactivarEncuestasCaducadas };







































  