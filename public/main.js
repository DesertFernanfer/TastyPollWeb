import {
    db, 
    functions,
  collection, // <-- Re-exporta estas también
  getDocs,
  httpsCallable,
  doc,
  getDoc
} from "./firebase-init.js";

const registrarVotoCF = httpsCallable(functions, 'registrarVotoEncuesta');

/// Elementos del doom ///
const spinnerDieta = document.getElementById('tipo-dieta');
const spinnerCategoriaPlato = document.getElementById('categoria-plato');
const inputNombre = document.getElementById('input-Nombre');

const contenedorAlimentos = document.getElementById('lista-comidas');
const botonBuscar = document.getElementById('boton-buscar');

const nombreEncuesta = document.getElementById('nombre-encuesta');
const descripcionEncuesta = document.getElementById('descripcion-encuesta');

const botonVotar = document.getElementById('boton-votar');
const inputEmail = document.getElementById('input-email');
const ALIMENTOS_POR_CARGA = 10;


let encuesta = null;
let todosAlimentos = [];
let alimentosMostrar = [];


class Alimento {
    constructor(id, nombre, dieta, categoria, urlImagen) {
      this.id = id;
      this.nombre = nombre;
      this.dieta = dieta;
      this.categoria = categoria;
      this.urlImagen = urlImagen;
    }
}


async function main(){
    const existeEncuesta = await verificarSiEncuestaExiste();

    if (!existeEncuesta) {
        mostrarEncuestaNoDisponible();
        return;
    }

    let tieneAlimentosPredeterminados = encuesta.tienealimentosPredeterminados;

    if (tieneAlimentosPredeterminados) {
        console.log("Tiene alimentos predterminados");
        todosAlimentos = await obtenerAlimentosPorIds(encuesta.alimentos);
        //todosAlimentos = convetirALimentosPredterminadosEnAlimentos(encuesta.alimentos);
        alimentosMostrar = todosAlimentos;
    } else {
        console.log("No tiene alimentos predeterminados");

        todosAlimentos = await cargarAlimentos(encuesta.tipoDieta);
        alimentosMostrar = todosAlimentos.slice(0,ALIMENTOS_POR_CARGA);
        

    }
    renderizarAlimentos(alimentosMostrar);

    //Inicializar cosas
    contenedorAlimentos.addEventListener('scroll', manejarScroll);
    botonBuscar.addEventListener('click', () => {
        aplicarFiltros(spinnerCategoriaPlato.value.toLowerCase(),spinnerDieta.value.toLowerCase(),inputNombre.value);
    });

    nombreEncuesta.textContent=encuesta.nombre;
    descripcionEncuesta.textContent=encuesta.descripcion;
    botonVotar.addEventListener('click',() => {
        manejarVoto();
    });
 
    if(!encuesta.tieneEmail){
        inputEmail.style.display = 'none';
        emailInput.disabled = false;           

    }

}
async function manejarVoto(){
    let email = 'NoEmail';
    console.log("votando");
    const idAlimentoSeleccionado = document.querySelector('input[name="alimento"]:checked')?.value;
    if (!idAlimentoSeleccionado) {
        alert('Por favor, selecciona un alimento antes de votar.');
    } else{
    
        if(encuesta.tieneEmail === true){
            if(verificarEmail() ){
                console.log("tiene email");
                email = inputEmail.value.trim();
            } else{
                console.log("no tiene email");
                alert("Introduce un email valido");
                return;
            }
          
        } else if(encuesta.tieneEmail != false ) {
            //alert('introduce email valido');
            console.log("email" + email);
        }
        llamarAFuncionRegistrarVotoFunction(buscarAimentoPorId(idAlimentoSeleccionado),email);

    }
}
function buscarAimentoPorId(id){
    let alimento =  todosAlimentos.find(alimento => alimento.id === id);
    console.log(alimento);
    return alimento;
}

async function  llamarAFuncionRegistrarVotoFunction(alimento, email){
    try {
        const dataToSend = {
            encuestaId: encuesta.id,
            alimentoId: alimento.id,
            alimentoNombre: alimento.nombre,
            emailVotante: email,
            requiereEmail: encuesta.tieneEmail
        };
        console.log("5. Datos que se enviarán a Cloud Function:", dataToSend);

        // ¡Fundamental usar 'await' para esperar la respuesta de la función!
        const result = await registrarVotoCF(dataToSend);

        if (result.data && result.data.success) {
            alert(`¡Voto por "${alimento.nombre}" registrado con éxito!`);
            botonVotar.disabled = true;
        } else {
            alert(`Error al votar: ${result.data ? result.data.message : 'Ocurrió un error desconocido en el servidor.'}`);
        }

    } catch (error) {
        console.error("Error al llamar a la Cloud Function 'registrarVotoEncuesta':", error);
        let errorMessage = 'Hubo un problema al conectar con el servidor. Por favor, inténtalo de nuevo.';
        if (error.code) {
            errorMessage = `Error ${error.code.replace(/-/g, ' ').toUpperCase()}: ${error.message}`;
        }
        alert(errorMessage);
    }
}
function verificarEmail(){
    const emailValue = inputEmail.value;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
}


/*
async function cargarAlimentos(tipoDieta ) {
    let alimentos = []
    
    try {
        const querySnapshot = await getDocs(collection(db, 'alimentos'));
        console.log("n alimentos " + querySnapshot.length);

        querySnapshot.forEach((doc) => {
            alimentos.push(convertirDocAAlimento(doc));
        });
        console.log("alimentos cargados");

    } catch (error) {
        console.error("Error al obtener todos los alimentos:", error);

    }
    return alimentos;
}

*/
async function cargarAlimentos(tipoDietaEncuesta) {
    let alimentos = []
    
    try {
        const querySnapshot = await getDocs(collection(db, 'alimentos'));
        console.log("n alimentos " + querySnapshot.length);

        querySnapshot.forEach((doc) => {
            const alimento = convertirDocAAlimento(doc);
            
            // Lógica de filtrado por tipo de dieta
            let incluirAlimento = false;
            
            switch (tipoDietaEncuesta.toUpperCase()) {
                case 'OMNIVORA':
                    incluirAlimento = true; // Incluye todos
                    break;
                case 'VEGETARIANA':
                    incluirAlimento = alimento.dieta.toUpperCase() === 'VEGETARIANA' || 
                                    alimento.dieta.toUpperCase() === 'VEGANA';
                    break;
                case 'VEGANA':
                    incluirAlimento = alimento.dieta.toUpperCase() === 'VEGANA';
                    break;
                case 'CARNIVORA':
                    incluirAlimento = alimento.dieta.toUpperCase() === 'CARNIVORA';
                    break;
                default:
                    incluirAlimento = true; // Por seguridad, incluir todos si no reconoce el tipo
            }
            
            if (incluirAlimento) {
                alimentos.push(alimento);
            }
        });
        
        console.log(`Alimentos cargados para dieta ${tipoDietaEncuesta}: ${alimentos.length}`);

    } catch (error) {
        console.error("Error al obtener alimentos:", error);
    }
    return alimentos;
}

function manejarScroll() {
    const { scrollTop, scrollHeight, clientHeight } = contenedorAlimentos;
    const cercaDelFinal = scrollTop + clientHeight >= scrollHeight - 100;
    if (cercaDelFinal) {
        cargarMasAlimentos();
    }
}
function cargarMasAlimentos() {
    // 1. Calcula cuántos alimentos nuevos cargar (sin exceder el total)
    const inicio = alimentosMostrar.length;
    const fin = Math.min(inicio + ALIMENTOS_POR_CARGA, alimentosMostrar.length);
    const nuevosAlimentos = alimentosMostrar.slice(inicio, fin);
  
    // 2. Si no hay más alimentos, detener
    if (nuevosAlimentos.length === 0) return;
  
    // 3. Agrega a la lista actual y renderiza
    alimentosMostrar.push(...nuevosAlimentos);
    renderizarAlimentos(nuevosAlimentos); // Solo renderiza los nuevos
  }

  function aplicarFiltros(categoria, dieta, nombre) {
    console.log("Filtrando")
    alimentosMostrar = todosAlimentos.filter(alimento => {
      const cumpleCategoria = compararCategoria(categoria,alimento.categoria.toLowerCase());
      const cumpleDieta = compararTipoDieta(dieta,alimento.dieta.toLowerCase());
      const cumpleNombre = !nombre || alimento.nombre.toLowerCase().includes(nombre.toLowerCase());

      console.log(categoria + " ? " + alimento.categoria  + " = " + cumpleCategoria);
      console.log(dieta + " ? " + alimento.dieta  + " = " + cumpleDieta);
      console.log(nombre + " ? " + alimento.nombre  + " = " + cumpleNombre);


      return cumpleCategoria && cumpleDieta && cumpleNombre;
      
    });
  
    console.log("longitud " + alimentosMostrar.length);
    //alimentosMostrar = [];
    contenedorAlimentos.innerHTML = '';
  
    renderizarAlimentos(alimentosMostrar);
  }

function compararTipoDieta(inputDieta,tipoDieta){
    let igual = false;
    if(inputDieta.includes('omnivora') || inputDieta.includes(tipoDieta)){
        igual = true;
    } else if(inputDieta.includes("vegetariana") && tipoDieta.includes("vegana") ){
        igual = true;
    }
    return igual;
}
function compararCategoria(inpuCategoria,categoria){
    let igual = false;
    if(inpuCategoria.includes('todos') || inpuCategoria.includes(categoria)){
        igual = true;
    }
    return igual;
}

function renderizarAlimentos(listaAlimentosARenderizar) {
    const fragment = document.createDocumentFragment();
    listaAlimentosARenderizar.forEach(alimento => {
        const div = document.createElement('div');
        div.className = 'item-alimento';
        div.innerHTML = `
          <img src="${alimento.urlImagen}" loading="lazy" onerror="this.onerror=null;this.src='img/default.png'">

        <label>
            <input type="radio" name="alimento" value="${alimento.id}">${alimento.nombre}

        </label>
        `;
        fragment.appendChild(div);
    });

    contenedorAlimentos.appendChild(fragment);
}
///////////////////// Funciones varias ////////////////////////////////
function mostrarEncuestaNoDisponible(){
    document.body.innerHTML =
    `<div id="error">
        <h1> No existe la encuesta o no disponible </h1>
        <img id="error-imagen" src="img/error.png" alt="Error" />
    </div>`;
}
async function verificarSiEncuestaExiste(){
    
    const idEncuesta = window.location.pathname.split('/').filter(segment => segment !== '').pop()
   

   
    let existeEncuesta = false;

    try {
        // 1. Obtener la referencia al documento de la encuesta
        const encuestaRef = doc(db, 'encuestas', idEncuesta);

        // 2. Obtener el snapshot del documento usando getDoc (¡singular!)
        const docSnapshot = await getDoc(encuestaRef); // Usamos getDoc para un solo documento

        console.log(idEncuesta); // Esto ya estaba, para depuración

        if (docSnapshot.exists()) { // Usamos .exists() con paréntesis
            const datosEncuesta = docSnapshot.data(); // Usamos .data() con paréntesis
           //encuesta = datosEncuesta;
            encuesta = { id: docSnapshot.id, ...docSnapshot.data() };
            existeEncuesta = true;
            console.log("La encuesta existe.");
        } else {
            console.log("La encuesta no existe.");
        }
    } catch (error) {
        console.error("Error al obtener la encuesta:", error);
    }
    return existeEncuesta;
}
async function obtenerAlimentosPorIds(ids) {

    const alimentos = [];

    if (Array.isArray(ids) && ids.length != 0) {
        const promesas = ids.map(id => getDoc(doc(db, 'alimentos', id)));

        try {
            const docsSnapshots = await Promise.all(promesas);
            docsSnapshots.forEach(doc => {
                if (doc.exists) {
                    alimentos.push(convertirDocAAlimento(doc));
                } else {
                     console.warn("Alimento con ID", doc.id, "no encontrado.");
                }
            });
        } catch (error) {
            console.error("Error al obtener alimentos por IDs:", error);
        }
    }
    return alimentos;
}

function convertirDocAAlimento(doc) {
    const data = doc.data();
    return new Alimento(
      doc.id,
      data.nombre,
      data.dieta.toLowerCase().trim(),
      data.tipo.toLowerCase().trim(),
      data.urlImagen,
    );
}
main();