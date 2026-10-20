// para abrir en el navegador: http://localhost:3000/appCliente/
// para lanzar servidor: node --env-file=.env servidor.js
 
//ES LA APLICACION CLIENTE QUE REALIZA UNA PETICION AL index.html DEL SERVIDOR
 
// rest.get(url, callback)
// rest.post(url, body, callback)
// rest.put(url, body, callback)
// rest.delete(url, callback)
// function callback(estado, respuesta) {...}

var seccionActual = "login_gestor"; //variable para guardar la seccion actual en la que esta, inicializada con la seccion "login_gestor" (la primera que se ve)
var seccionAnterior = ""; //variable para saber donde volver a atras


var token_gestor = null; // para guardar el tokendel gestor que tiene abierta su sesión
var id_gestor = null; //identificador del usuario (el gestor) que ha iniciado sesion [en la funcion entrar() toma valor].
var id_recurso = null; // identificador del recurso especifico que tienes abierto en pantalla
var modoNuevo = false; // dice a la aplicacion si estamos "Creando" o "Editando" un recurso [en la funcion guardarRecurso() ].
//aqui se anyadirian id_resenya o id_reserva si se necesitan crear mas de cualquiera de ambas

// Estas listas nos van a permitir tener los arrays de estas variables con sus objetos (que contienen el id y el nombre).
// Asi no se tendran que realizar los gets cada vez que se necesiten 
var listaModelos = [];
var listaCategorias = [];
var listaUbicaciones = [];

// ---- WEBSOCKET (Parte 3) ----
// Conexion al servidor WebSocket para recibir avisos en tiempo real
// Se abre tras el login y se cierra al salir
var socketGestor = null;
var nombreGestor = ""; // Guardamos el nombre del gestor logueado para los avisos

var rest = window.rest;


// ------------------------------------------- FUNCIONES CORRESPONDIENTES A CARGAR LA PAGINA DE INICIO -------------------------------------------

//    1. Funcion para guardar los datos del registro del gestor.
//    2. Funcion para cargar los valores de los select del inicio.
//       a. Utilizamos la funcion "filtrarModelos()" para que se seleccionen los modelos correspondientes a la categoria.

function cargarDatosGestor(){
    rest.get("/api/gestores/" + id_gestor + "?token=" + token_gestor, function(estado, respuesta){
        if(estado == 200){
            document.getElementById("inicio_usuario").textContent = respuesta.nombre + " " + respuesta.apellidos;
            // Guardamos el nombre para usarlo en los avisos WS
            nombreGestor = respuesta.nombre + " " + respuesta.apellidos;
            //compueba si no hay un socket abierto (como en editar datos), y abre uno nuevo
            if (!socketGestor || socketGestor.readyState === WebSocket.CLOSED) {
                abrirWebSocket();
            }
        }
        else{
            alert(respuesta);
        }
    });
}

function cargarRecursos(){
    rest.get("/api/ubicaciones?token=" + token_gestor, function(estado, respuesta){
        listaUbicaciones = respuesta; // ? GUARDAR EN MEMORIA
        var lista = document.getElementById("filtro_ubicacion"); // llamamos a la etiqueta html del index para rellenar el select
        lista.innerHTML = "<option value='' selected>Todos</option>";        
        for(var i = 0; i < respuesta.length; i++){ 
            lista.innerHTML += "<option value='" + respuesta[i].id + "'>" + respuesta[i].nom + "</option>"; 
        }
    });
    rest.get("/api/categorias?token=" + token_gestor, function(estado, respuesta){
        listaCategorias = respuesta;   // ? GUARDAR EN MEMORIA
        var lista = document.getElementById("filtro_categoria"); // llamamos a la etiqueta html del index para rellenar el select
        lista.innerHTML = "<option value=''>Todos</option>";
        for(var i = 0; i < respuesta.length; i++){
            lista.innerHTML += "<option value='" + respuesta[i].id + "'>" + respuesta[i].nom + "</option>";
        }
        lista.addEventListener("change", filtrarModelos); // Cuando este <select> cambie de valor, ejecuta la funcion filtrarModelos
    });
    rest.get("/api/modelos?token=" + token_gestor, function(estado, respuesta){
        listaModelos = respuesta;   // ? GUARDAR EN MEMORIA
        filtrarModelos();           // Ahora si se pueden filtrar
    });
}

function filtrarModelos(){ 
    var categoriaSeleccionada = document.getElementById("filtro_categoria").value; //obtiene la categoria selected
    // Obtiene el array de modelos gracias al servidor y carga aquellos que paertenezcan a la categoria seleccionada
    rest.get("/api/modelos?token=" + token_gestor, function(estado, respuesta){
        var lista = document.getElementById("filtro_modelo");
        lista.innerHTML = "<option value=''>Todos</option>";
        for(var i = 0; i < respuesta.length; i++){
            if(categoriaSeleccionada == "" || respuesta[i].cat == categoriaSeleccionada){
                lista.innerHTML += "<option value='" + respuesta[i].id + "'>" + respuesta[i].nom + "</option>";
            }
        }
    });
}
// ----------------------------------------- FIN FUNCIONES CORRESPONDIENTES A CARGAR LA PAGINA DE INICIO -----------------------------------------




//********************************************************** BOTONES DEL LOGIN **********************************************************

//BOTON DEL LOGIN PARA ACCEDER AL INICIO 
function entrar(){
    var acceso = { //Informacion del index
        usuario: document.getElementById("usuario").value,
        password: document.getElementById("password").value
    };
    rest.post("/api/gestores/login", acceso, function (estado, respuesta) {
        if (estado == 200) { //correcto
            id_gestor = respuesta.id; // ? GUARDAR EN MEMORIA ID DEL GESTOR LOGUEADO
            token_gestor = respuesta.token; // guardar en memoria el token del gestor logueado

            cargarDatosGestor(); //para mostrar nombre y apellidos en inicio Y ABRIR EL WEBSOCKET
            cambiarSeccion("inicio");
            cargarRecursos(); //para cargar los option de los select
            cargarRankingMinisterio();
            return;
        } else{ //si el estado es 403, ha habido un login incorrecto
            alert(respuesta); // muestra la alerta, mensaje que cubre pantalla
        }        
    });
}

//BOTON DEL LOGIN PARA CAMBIAR PANTALLA A REGISTRO
function registrar(){
    cambiarSeccion("registro_gestor");
}


//******************************************************** FIN BOTONES DEL LOGIN ********************************************************




//???????????????????????????????????????????????????????? BOTONES DEL REGISTRO ????????????????????????????????????????????????????????

// Este boton puede aparecer en dos ocaciones
//    1. Cuando guardas los datos para registrarte. Su seccion anterior es login.
//    2. Cuando guardas los datos luego de editarlos. SU seccion anterior es inicio.

function guardar(){
    var acceso_nuevo = { //esto es el BODY
        nombre: document.getElementById("nombre").value,
        apellidos: document.getElementById("apellidos").value,
        usuario: document.getElementById("reg_usuario").value,
        password: document.getElementById("reg_password").value

    };

   if(seccionAnterior == "login_gestor"){
        rest.post("/api/gestores", acceso_nuevo, function(estado, respuesta){
            if(estado == 201){
                alert("Registrado correctamente. Ahora inicia sesión.");
                cambiarSeccion("login_gestor");
                return;
            }
            else{
                alert(respuesta);
            }
        });
    } else{ //su seccion anterior es "inicio"
        rest.put("/api/gestores/" + id_gestor + "?token=" + token_gestor, acceso_nuevo, function(estado, respuesta){ //actualizo gestor
            if(estado == 200){
                alert("Actualizado correctamente");
                cambiarSeccion("inicio");
                cargarRecursos();
                cargarDatosGestor(); // aqui no abre websocket porque ya tiene uno
            }
            else{
                alert(respuesta);
            }
        });
    }
}

function cancelar(){
    if(seccionAnterior == "login_gestor"){
            cambiarSeccion("login_gestor");
    } else{
        cambiarSeccion("inicio");
        cargarRecursos();
    }
}

//?????????????????????????????????????????????????????? FIN BOTONES DEL REGISTRO ??????????????????????????????????????????????????????



// +++++++++++++++++++++++++++++++++++++++++ BOTONES Y FUNCIONES DEL INICIO (+aspecto registro) +++++++++++++++++++++++++++++++++++++++++

// FUNCIONES NECESARIAS PARA OBTENER LOS DATOS DE LOS SELECTS DE "RECURSOS" Y MOSTRARLOS EN LA TABLA DE RECURSOS
//       0. Funcion para cambiar seccion a "regitro" y editar datos (no hace falta para los recursos)
//       1. Funcion para obtener el nombre del Modelo
//       2. Funcion para obtener el nombre de la categoria
//       3. Funcion para obtener el nombre de la ubicacion
//       --> En estas 3 funciones comparamos con los arrays rellenados en cargarRecursos()
//       4. Funcion para obtener el nombre del estado.
//       5. Boton buscar.
//          a. funcion para borrar el recurso especifico
//          b. funcion para ver el recurso especifico

function editar_datos(){ // Para actualizar un gestor
    cambiarSeccion("registro_gestor");
}

function nombreModelo(idModelo){
    for(var i = 0; i < listaModelos.length; i++){
        if(listaModelos[i].id == idModelo){
            return listaModelos[i].nom;
        }
    }
    return ""; //si no existe ese id en los modelos cargados en el select del recurso
}

function nombreCategoria(idModelo){
    // 1. buscar modelo
    var modeloEncontrado = null;

    for(var i = 0; i < listaModelos.length; i++){
        if(listaModelos[i].id == idModelo){
            modeloEncontrado = listaModelos[i];
            break;
        }
    }

    if(!modeloEncontrado) return ""; //si no existe ese id en los modelos cargados en el select del recurso
    // 2. buscar categoria del modelo
    for(var j = 0; j < listaCategorias.length; j++){
        if(listaCategorias[j].id == modeloEncontrado.cat){ //si coincide la categoria del modelo (parametro) con alguno de la lista
            return listaCategorias[j].nom;
        }
    }
    return "";
}

function nombreUbicacion(id){
    for(var i = 0; i < listaUbicaciones.length; i++){
        if(listaUbicaciones[i].id == id){
            return listaUbicaciones[i].nom;
        }
    }
    return "";
}

function nombreEstado(idEstado){
    switch(parseInt(idEstado)){
        case 0: return "Operativo";
        case 1: return "De baja o defectuoso";
        case 2: return "Mantenimiento";
    }
}

// Busca los recursos que cumplen con los filtros de los select y los escribe en las filas de la tabla de recursos
function buscar(){
    var categoria = document.getElementById("filtro_categoria").value;
    var modelo = document.getElementById("filtro_modelo").value;
    var ubicacion = document.getElementById("filtro_ubicacion").value;
    var estado = document.getElementById("filtro_estado").value;

    // Url generada a partir de los valores de los select para hacer el GET de los recursos filtrados
    var url = "/api/recursos?";

    //si la opcion es "Todos" -> .value = "" -> no haria lo del if
    if (categoria) url += "categoria=" + categoria + "&";
    if (modelo) url += "modelo=" + modelo + "&";
    if (ubicacion) url += "ubicacion=" + ubicacion + "&";
    if (estado) url += "estado=" + estado + "&";

    rest.get(url + "token=" + token_gestor, function(estado, respuesta){
        var tabla_recursos = document.getElementById("tabla_recursos");
        tabla_recursos.innerHTML = ""; //la vacia para evitar duplicados.
       
        respuesta.forEach(function(recurso){ //recorre cada recurso del array de la respuesta
            var fila = document.createElement("tr"); //crea la fila del recurso que va a mostrar
            //rellena cada columna de la fila
            fila.innerHTML = `
                <td data-label="N. Serie">${recurso.numero_serie}</td> 
                <td data-label="Categoria">${nombreCategoria(recurso.modelo)}</td>
                <td data-label="Modelo">${nombreModelo(recurso.modelo)}</td>
                <td data-label="Ubicacion">${nombreUbicacion(recurso.ubicacion)}</td>
                <td data-label="Estado">${nombreEstado(recurso.estado)}</td>
                <td class="accion"><button onclick="verRecurso(${recurso.id})">Abrir</button></td>
                <td class="accion"><button onclick="borrarRecurso(${recurso.id})">Borrar</button></td>
            `;
            tabla_recursos.appendChild(fila); //anyade la fila nueva al final de la tabla
        });
    })
}

// funcion que se inicializa confome se pulsa el boton de "borrar" de la tabla de recursos
function borrarRecurso(id){
    if(!confirm("?Seguro que quieres borrar este recurso?")){
        return;
    }
    rest.delete("/api/recursos/" + id + "?token=" + token_gestor, function(estado, respuesta){
        if (estado == 200){
            buscar(); // Volver a cargar la tabla con los filtros actuales
        }
        else{
            alert(respuesta);
        }
    });
}



//FUNCIONES NECESARIAS PARA CARGAR LA "PAGINA" DE RECURSO (desde el boton de "ver recurso" del inicio)
//     1. verRecursos --> funcion para que aparezcan los recursos 
//     2. actualizarModelosEdicion --> para filtrar los modelos segun categoria (como en inicio)
//     3. CargarTablasDetalle --> carga tanto las tablas de reservas como de resenyas.

function verRecurso(id) {
    modoNuevo = false;   // Estamos editando
    id_recurso = id;     // Guardamos el id del recurso

    // 1. Pedimos los datos del recurso especifico para mostrarlos en los select y los rellenamos
    rest.get("/api/recursos/" + id + "?token=" + token_gestor, function(estado, recurso){
        
        if (estado==200){

            cambiarSeccion("recurso");
            
            // Rellenamos el numero de serie (input de texto)
            document.getElementById("rec_numSerie").value = recurso.numero_serie;

            // Rellenamos el select de ubicaciones
            var ubicaciones = document.getElementById("rec_ubicacion");
            ubicaciones.innerHTML = "";
            for (var i = 0; i < listaUbicaciones.length; i++) {
                ubicaciones.innerHTML += "<option value='" + listaUbicaciones[i].id + "'>" + listaUbicaciones[i].nom + "</option>";
            }
            ubicaciones.value = recurso.ubicacion; // Seleccionamos la que tiene el recurso (selected)

            // Rellenamos el select de estado
            var estados = document.getElementById("rec_estado");
            estados.innerHTML = "<option value='0'>Operativo</option>" +
                                    "<option value='1'>De baja o defectuoso</option>" +
                                    "<option value='2'>Mantenimiento</option>";
            estados.value = recurso.estado; // Seleccionamos el estado actual

            // Rellenamos el select de categoria y modelo
            // 1. Buscamos a que categoria pertenece el modelo del recurso
            var idCatDelRecurso = "";
            for (var j = 0; j < listaModelos.length; j++) {
                if (listaModelos[j].id == recurso.modelo) {
                    idCatDelRecurso = listaModelos[j].cat;// Guardamos el ID de la categoria
                    break;
                }
            }

            // 2. Rellenamos categorias
            var categorias = document.getElementById("rec_categoria");
            categorias.innerHTML = "";
            for (var k = 0; k < listaCategorias.length; k++) {
                categorias.innerHTML += "<option value='" + listaCategorias[k].id + "'>" + listaCategorias[k].nom + "</option>";
            }
            categorias.value = idCatDelRecurso;

            // Rellenamos modelos filtrados por esa categoria
            actualizarModelosEdicion(idCatDelRecurso, recurso.modelo);

            // Programamos que si cambia la categoria en la edicion, se actualicen los modelos
            categorias.onchange = function() {
                actualizarModelosEdicion(this.value, "");
            };

            // 2. Cargamos las tablas de la parte inferior
            cargarTablasDetalle(id);
        }
    });
}

// Funcion simple para filtrar los modelos en la pantalla de edicion
function actualizarModelosEdicion(idCat, idModeloSeleccionado) {
    var modelos = document.getElementById("rec_modelo");
    modelos.innerHTML = "";
    for (var i = 0; i < listaModelos.length; i++) {
        if (listaModelos[i].cat == idCat) {
            modelos.innerHTML += "<option value='" + listaModelos[i].id + "'>" + listaModelos[i].nom + "</option>";
        }
    }
    if (idModeloSeleccionado != "") {
        modelos.value = idModeloSeleccionado;
    }
}

//Funcion para llenar las tablas de reservas y resenyas
function cargarTablasDetalle(id) {

    rest.get("/api/recursos/" + id + "/reservas?token=" + token_gestor, function(estado, listaReservas){
        var tabla = document.getElementById("tabla_reservas");
        tabla.innerHTML = "";
        
        if (estado == 200) {
            var ahora = new Date();

            listaReservas.forEach(function(r) { //recorre todas las reservas
                // 1. Preparamos los datos de la reserva. Pasamos las fechas a String
                // condicion ? valor_si_true : valor_si_false
                var f_pet = r.fecha_peticion ? new Date(r.fecha_peticion).toLocaleString() : "-";
                var f_ini = r.fecha_inicio ? new Date(r.fecha_inicio).toLocaleString() : "-";
                var f_fin = r.fecha_fin ? new Date(r.fecha_fin).toLocaleString() : "-";

                var claseColor = "";

                // 2. Asignamos el color correspondiente
                if (r.fecha_fin && r.fecha_fin !== "") { 
                    claseColor = "reserva-finalizada";
                } else if (!r.fecha_inicio || r.fecha_inicio === "") {
                    claseColor = "reserva-pendiente";
                } else {
                    var fechaInicio = new Date(r.fecha_inicio); //lo vuelve a obtener en formato Date, antes era String
                    var diffHoras = (ahora - fechaInicio) / (1000 * 60 * 60); //lo da en milisegundos y lo pasa a horas
                    claseColor = (diffHoras > r.h_estimada) ? "reserva-excedida" : "reserva-en-uso";
                }

                // 3. Petici?n del sanitario
                rest.get("/api/sanitarios/" + r.sanitario + "?token=" + token_gestor, function(estadoSan, datosSanitario){
                    // Validaci?n de seguridad para evitar que el c?digo crashee
                    var nombre = (estadoSan == 200 && datosSanitario) ? datosSanitario.nombre : "Desconocido";
                    
                    var fila = `
                        <tr class="${claseColor}">
                            <td data-label="Sanitario">${nombre}</td>
                            <td data-label="H. estim.">${r.h_estimada || "-"}h</td>
                            <td data-label="F. Peticion">${f_pet}</td>
                            <td data-label="F. Inicio">${f_ini}</td>
                            <td data-label="F. Fin">${f_fin}</td>
                        </tr>
                        `;
                    
                    tabla.innerHTML += fila;
                });
            });
        }
    });


    rest.get("/api/recursos/" + id + "/resenyas?token=" + token_gestor, function(estado, respuesta){
        var tabla = document.getElementById("tabla_resenyas");
        tabla.innerHTML = "";
        
        if (estado == 200) {
            respuesta.forEach(function(res) {
                var fechaResenya = res.fecha ? new Date(res.fecha).toLocaleString() : "-";      
                
                rest.get("/api/sanitarios/" + res.sanitario + "?token=" + token_gestor, function(estado2, respuesta2){
                    if (estado2 == 200) {
                        var nombre_sanitario = respuesta2.nombre;
                        
                        tabla.innerHTML += `
                        <tr>
                            <td data-label="Fecha">${fechaResenya}</td>
                            <td data-label="Sanitario">${nombre_sanitario}</td>
                            <td data-label="Valoracion">${res.valor}/5</td>
                            <td data-label="Comentario">${res.descripcion}</td>
                        </tr>
                        `;
                    }
                });
            });
        }
    });
}



// FUNCIONES PARA CARGAR LA PAGINA DE RECURSO (a partir del boton "Anyadir recurso") 
//    1. Funcion ppal 
//    2. Funcion para filtrar los modelos segun la categoria a la que pertenecen en recurso

function anyadir_recurso(){
    modoNuevo = true; //se actualiza para que la funcion de guardar() sepa que es nuevo recurso
    id_recurso = null; //se limpia la variable

    cambiarSeccion("recurso");

    // inicializamos los selects y las tablas
    cargarRecursosSelect();
    document.getElementById("rec_numSerie").value = ""; //se elimina para que anyada uno nuevo
    var tabla1 = document.getElementById("tabla_resenyas");
        tabla1.innerHTML = "";
    var tabla2 = document.getElementById("tabla_reservas");
        tabla2.innerHTML = "";
}

function cargarRecursosSelect(){
    rest.get("/api/ubicaciones?token=" + token_gestor, function(estado, respuesta){
        var lista = document.getElementById("rec_ubicacion");
        lista.innerHTML = "";      
        for(var i = 0; i < respuesta.length; i++){ 
            lista.innerHTML += "<option value='" + respuesta[i].id + "'>" + respuesta[i].nom + "</option>"; 
        }
    });
    rest.get("/api/categorias?token=" + token_gestor, function(estado, respuesta){
        var lista = document.getElementById("rec_categoria");
        lista.innerHTML = "";

        for(var i = 0; i < respuesta.length; i++){
            lista.innerHTML += 
                "<option value='" + respuesta[i].id + "'>" 
                + respuesta[i].nom + 
                "</option>";
        }
        // IMPORTANTE: anyadir evento change
        lista.addEventListener("change", filtrarModelosSelect);
    });

    rest.get("/api/modelos?token=" + token_gestor, function(estado, respuesta){
        filtrarModelosSelect();     // Ahora si se pueden filtrar
    });

}
function filtrarModelosSelect(){
    var categoriaSeleccionada = document.getElementById("rec_categoria").value;

    rest.get("/api/modelos?token=" + token_gestor, function(estado, respuesta){
        var lista = document.getElementById("rec_modelo");
        lista.innerHTML = "";

        for(var i = 0; i < respuesta.length; i++){
            if(categoriaSeleccionada == "" || respuesta[i].cat == categoriaSeleccionada){
                lista.innerHTML += "<option value='" + respuesta[i].id + "'>" + respuesta[i].nom + "</option>";
            }
        }
    });
}


// FUNCION PARA VOLVER AL LOGIN DESDE REGISTRO
function salir(){
    // Cerramos la conexion WebSocket al salir (Parte 3)
    if (socketGestor) {
        socketGestor.close();
        socketGestor = null;
    }
    id_gestor = null;
    token_gestor = null;
    cambiarSeccion("login_gestor");
}

// ---- FUNCIONES WEBSOCKET (Parte 3) ----

// Abre la conexion WS, se registra como gestor y escucha avisos entrantes
function abrirWebSocket() {
    // Si ya habia una conexion abierta la cerramos primero
    if (socketGestor) {
        socketGestor.close();
    }

    socketGestor = new WebSocket(
         (window.location.protocol === "https:" ? "wss://" : "ws://") + // obtiene si estamos utilizando http: o https; HTTPS -> wss://    HTTP -> ws://
         window.location.host // obtiene el dominio y, cuando corresponde, el puerto de la aplicación
     );

    socketGestor.onopen = function() { // Cuando la conexi�n WebSocket se abra correctamente, ejecuta esta funci�n
        // Nos registramos en el servidor WS como gestor
        var registro = {
            tipo: "registro",
            rol: "gestor",
            id: id_gestor,
            nombre: nombreGestor
        };
        socketGestor.send(JSON.stringify(registro)); // el cliente env�a un mensaje al servidor WS
    };

    socketGestor.onmessage = function(evento) { // Cuando llegue un mensaje del servidor WebSocket
        var aviso = JSON.parse(evento.data); // Lo convierto de JSON a objeto JavaScript
        anyadirAviso(aviso);  // Lo mando a anyadirAviso() para pintarlo en la tabla
    };

    socketGestor.onerror = function() {
        console.log("Error en la conexion WebSocket del gestor");
    };
}

// Anyade un aviso recibido a la tabla de avisos del inicio
function anyadirAviso(aviso) {
    var tabla = document.getElementById("tabla_avisos");

    // Clases CSS segun el color del aviso
    var claseColor = "";
    if (aviso.color === "rojo")  claseColor = "aviso-rojo";
    if (aviso.color === "azul")  claseColor = "aviso-azul";
    if (aviso.color === "verde") claseColor = "aviso-verde";

    var fila = `
        <tr class="${claseColor}">
            <td data-label="Fecha">${aviso.fecha}</td>
            <td data-label="Origen">${aviso.origen}</td>
            <td data-label="Texto">${aviso.texto}</td>
        </tr>
    `;

    // Anyadimos al principio para que los mas recientes salgan arriba
    tabla.innerHTML = fila + tabla.innerHTML;
}

// comparar fechas -> if (fecha1.substring(0,10) == fecha2.substring(0,10))
// comparar fechas y horas -> if (new Date(fecha1).getTime() == new Date(fecha2).getTime())
// comparar texto -> [.value].trim().toLowerCase()


// +++++++++++++++++++++++++++++++++++++++ FIN BOTONES Y FUNCIONES DEL INICIO (+aspecto registro) +++++++++++++++++++++++++++++++++++++++




// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< BOTONES DE LA PANTALLA DE RECURSO >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

//Funcion para volver a "inicio" desde "registro"
function volver_listado() {
    cambiarSeccion("inicio");
    buscar(); // Refrescamos la tabla por si hubo cambios
}

// Esta funcion se puede inicializar en dos ocasiones
//  1. Cuando edito un recurso en especifico desde el boton  "verRecursos"
//  2. Cuando quiero anyadir un nuevo recurso a la tabla.
// Para identificar cual de las dos formas es, tenemos la var modoNuevo:
//   a. modoNuevo == True --> boton "anyadir_recurso"
//   b. modoNuevo == False --> boton "verRecursos"
function guardar_recurso(){

    var nuevo_recurso = {
        modelo : document.getElementById("rec_modelo").value, 
        ubicacion : document.getElementById("rec_ubicacion").value,
        numero_serie : document.getElementById("rec_numSerie").value,
        estado : document.getElementById("rec_estado").value,
        nombre_gestor : nombreGestor // Para el aviso WebSocket (Parte 3)
    };

    if(modoNuevo){
        // ANYADIR RECURSO -> CREAR UNO NUEVO
        rest.post("/api/recursos?token=" + token_gestor, nuevo_recurso, function(estado, respuesta){
            if(estado == 201){
                alert("Recurso creado correctamente");
                cambiarSeccion("inicio");
                buscar();
            }
        });

    }else{
        // VER RECURSO -> ACTUALIZAR DICHO RECURSO
        rest.put("/api/recursos/" + id_recurso + "?token=" + token_gestor, nuevo_recurso, function(estado, respuesta){
            if(estado == 200){
                alert("Recurso actualizado correctamente");
                cambiarSeccion("inicio");
                buscar();
            }
            else{
                alert(respuesta);
            }
        });

    }
}

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< FIN BOTONES DE LA PANTALLA DE RECURSO >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>


function anyadir_reserva(){
    //cambiamos seccion
    cambiarSeccion("reserva");

    //rellenamos el select de sanitario
    rest.get("/api/sanitarios?token=" + token_gestor, function(estado, respuesta){
        listaSanitarios = respuesta; //lo guarda en memoria
        var lista = document.getElementById("res_sanitario");
        lista.innerHTML = "<option value='' selected>Todos</option>";        
        for(var i = 0; i < respuesta.length; i++){ 
            lista.innerHTML += "<option value='" + respuesta[i].id + "'>" + respuesta[i].nom + " " + respuesta[i].apell + "</option>"; 
        }
    });
    
}


//FUNCION PARA CAMBIOS DE PANTALLA
function cambiarSeccion(seccion) {

    seccionAnterior = seccionActual; 
    document.getElementById(seccionActual).classList.remove("activa");
    document.getElementById(seccion).classList.add("activa");
    seccionActual = seccion;
}

// PRÁCTICA 3

// ENVIAR RESERVAS AL MINISTERIO

async function enviarReservasMinisterio(){

    try {

        // Obtenemos los datos con los GET existentes
        var respuestaRecursos = await fetch("/api/recursos?token=" + token_gestor);  //await espera a que termine cada petición antes de seguir ejecutando
        var respuestaSanitarios = await fetch("/api/sanitarios?token=" + token_gestor);  //fetch realiza petición HTTP GET
        var respuestaModelos = await fetch("/api/modelos?token=" + token_gestor); // no contiene modelos, sino un objeto Response
        var respuestaCategorias = await fetch("/api/categorias?token=" + token_gestor);

        if(!respuestaRecursos.ok || !respuestaSanitarios.ok ||  // comprobar que las peticiones han funcionado (entre 200 y 209)
           !respuestaModelos.ok || !respuestaCategorias.ok){
            alert("Error al obtener los datos");
            return;
        }

        //convertir las respuestas a json
        var recursos = await respuestaRecursos.json(); // también se utiliza await porque devuelve promesa
        var sanitarios = await respuestaSanitarios.json();
        var modelos = await respuestaModelos.json();
        var categorias = await respuestaCategorias.json();

        // comprobar que los datos son arrays
        if(!Array.isArray(recursos) || !Array.isArray(sanitarios) ||
           !Array.isArray(modelos) || !Array.isArray(categorias)){
            alert("Formato de datos incorrecto");
            return;
        }

        var datosPreparados = []; //Array donde guardamos reservas que vamos a enviar

        // Recorremos los recursos
        for(var i = 0; i < recursos.length; i++){

            var recurso = recursos[i];

            // Buscamos el modelo y la categoría del recurso
            var modelo = modelos.find(m => m.id == recurso.modelo); // busca el primer elemento que cumpla la condición
            var categoria = modelo && categorias.find(c => c.id == modelo.cat); //primero comprueba que hemos encontrado el modelo

            // comprueba si el nombre de la categoría existe o está vacío.
            if(!categoria || !categoria.nom?.trim()){ // El ?. evita intentar llamar a trim() si nom es null o undefined.
                continue; // pasa al siguiente recurso del for
            }

            // Obtenemos las reservas de este recurso
            var respuesta = await fetch("/api/recursos/" + recurso.id + "/reservas?token=" + token_gestor);

            if(!respuesta.ok){
                alert("Error al obtener las reservas");
                return;
            }

            var reservas = await respuesta.json();

            if(!Array.isArray(reservas)){
                alert("Formato de reservas incorrecto");
                return;
            }

            //Recorremos las reservas de ese recurso
            for(var j = 0; j < reservas.length; j++){

                var reserva = reservas[j];

                if(!reserva){
                    continue;
                }

                var sanitario = sanitarios.find(s => s.id == reserva.sanitario);

                // Comprobamos los datos obligatorios
                if(!sanitario ||
                   !sanitario.nom?.trim() || // comprueba si existe y si está vacío
                   !sanitario.apell?.trim() ||
                   !reserva.fecha_peticion ||
                   !Number.isFinite(Number(reserva.h_estimada)) || // que las horas se puedan convertir en un número finito
                   Number(reserva.h_estimada) <= 0){  // lo convierte en número y lo compara
                    continue;
                }

                //Añadir la reserva válida al array
                datosPreparados.push({
                    nombre: sanitario.nom,
                    apellidos: sanitario.apell,
                    categoría: categoria.nom,
                    horas_estimadas: reserva.h_estimada,
                    fec_pet: reserva.fecha_peticion,
                    fec_ini: reserva.fecha_inicio,
                    fecha_fin: reserva.fecha_fin
                });
            }
        }

        // Preparamos el objeto que pide el Ministerio
        var datosMinisterio = {
            id_area: 14,
            fecha: new Date().toISOString().substring(0,10),  //fecha en formato YYYY-MM-DD
            datos: datosPreparados
        };

        console.log("Datos para el Ministerio:", datosMinisterio);

                
        // Comprobamos que haya reservas para enviar
        if(datosPreparados.length == 0){
            alert("No hay reservas válidas para enviar");
            return;
        }

        // Enviamos los datos al Ministerio mediante POST
        var respuestaMinisterio = await fetch( 
            "https://undefined.ua.es/telemedicina/api/datos", // petición HTTP a la API externa del Ministerio
            {
                method: "POST", //si no se indica es GET por defecto
                headers: {
                    "Content-Type": "application/json"  //el cuerpo es JSON
                },
                body: JSON.stringify(datosMinisterio)
            }
        );
        
        if(!respuestaMinisterio.ok){
            alert("Error al enviar las reservas al Ministerio");
            return;
        }

        alert("Reservas enviadas correctamente al Ministerio");
        cargarRankingMinisterio();

    } catch(err){
        console.log("Error:", err);
        alert("Error al obtener los datos");
    }
}


// RANKING DE RESERVAS DEL MINISTERIO

async function cargarRankingMinisterio(){

    try {
        var respuesta = await fetch("https://undefined.ua.es/telemedicina/api/datos");

        if(!respuesta.ok){
            alert("Error al obtener los datos del Ministerio");
            return;
        }

        var datos = await respuesta.json();

        if(!Array.isArray(datos)){
            alert("Formato incorrecto");
            return;
        }

        var nombresAreas = [
            "",
            "Alergología", "Anestesiología", "Cardiología",
            "Cirugía General", "Dermatología", "Aparato Digestivo",
            "Endocrinología", "Ginecología", "Hematología",
            "Medicina Interna", "Neumología", "Neurología",
            "Oftalmología", "Oncología", "Pediatría",
            "Psiquiatría", "Traumatología", "Urología"
        ];

        var totales = Array(19).fill(0); //para contar el número de reservas válidas. Inicializa array con ceros

        // Recorremos los registros del Ministerio
        for(var i = 0; i < datos.length; i++){

            var area = datos[i]; //datos de un post de un área en el servidor
            var id_area = Number(area?.id_area); //?. permite acceder a id_area que dé error si area es null o undefined

            if(!Number.isInteger(id_area) ||
               id_area < 1 || id_area > 18 ||
               !Array.isArray(area?.datos)){
                continue;
            }

            // Recorremos las reservas de cada registro
            for(var j = 0; j < area.datos.length; j++){

                var reserva = area.datos[j];

                if(!reserva){
                    continue;
                }

                if(
                    typeof reserva.nombre !== "string" ||
                    !reserva.nombre.trim() ||
                    typeof reserva.apellidos !== "string" ||
                    !reserva.apellidos.trim() ||
                    typeof reserva.categoría !== "string" ||
                    !reserva.categoría.trim() ||
                    typeof reserva.fec_pet !== "string" ||  //que sea cadena de texto
                    !reserva.fec_pet.trim() || // que no esté vacía
                    Number.isNaN(Date.parse(reserva.fec_pet)) || // que se interprete como fecha
                    reserva.horas_estimadas == null ||
                    !Number.isFinite(Number(reserva.horas_estimadas)) ||
                    Number(reserva.horas_estimadas) <= 0
                ){
                    continue;
                }

                totales[id_area]++;
            }
        }

        // Preparamos el ranking
        var ranking = [];

        for(var i = 1; i <= 18; i++){

            if(totales[i] > 0){
                ranking.push({
                    nombre: nombresAreas[i],
                    total: totales[i]
                });
            }
        }

        // Ordenamos de mayor a menor
        ranking.sort(function(a, b){
            return b.total - a.total; //si es positivo b antes, si es negativo a antes
        });

        // Rellenamos la tabla
        var tabla = document.getElementById("tabla_ranking");
        tabla.innerHTML = "";

        for(var i = 0; i < ranking.length; i++){

            var fila = tabla.insertRow(); //crea una nueva fila <tr> dentro de la tabla

            fila.insertCell().textContent = i + 1; //posicion
            fila.insertCell().textContent = ranking[i].nombre; //crea una celda <td> con la posición del ranking
            fila.insertCell().textContent = ranking[i].total;
        }

    } catch(err){
        console.log("Error al obtener el ranking:", err);
        alert("Error al conectar con el Ministerio");
    }
}








