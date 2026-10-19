var WebSocket = require("ws");
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    process.env.SUPABASE_URL || 'https://TU-PROYECTO.supabase.co',
    process.env.SUPABASE_KEY || 'TU_ANON_KEY'
);

var clientes = new Map(); //guardar los clientes conectados
/**
    clientes.set(ws, {
        tipo: "sanitario",
        id: 2,
        nombre: "María Gómez"
    });
 */

// ================= FUNCIONES AUXILIARES =================
// Ahora son asincronas: reciben un callback porque consultan Supabase

function obtenerNombreCategoria(idRecurso, callback) {

    supabase.from("recursos").select("*").eq("id", parseInt(idRecurso)).then(function ({ data: recursos_encontrados, error: err }) {
        if (err || recursos_encontrados.length == 0) {
            return callback("Desconocido");
        }

        var idModelo = recursos_encontrados[0].modelo;

        supabase.from("modelos").select("*").eq("id", parseInt(idModelo)).then(function ({ data: modelos_encontrados, error: err }) {
            if (err || modelos_encontrados.length == 0) {
                return callback("Desconocido");
            }

            var idCat = modelos_encontrados[0].cat;

            supabase.from("categorias").select("*").eq("id", parseInt(idCat)).then(function ({ data: categorias_encontradas, error: err }) {
                if (err || categorias_encontradas.length == 0) {
                    return callback("Desconocido");
                }
                return callback(categorias_encontradas[0].nom);
            });
        });
    });
}

function obtenerNombreModelo(idRecurso, callback) {

    supabase.from("recursos").select("*").eq("id", parseInt(idRecurso)).then(function ({ data: recursos_encontrados, error: err }) {
        if (err || recursos_encontrados.length == 0) {
            return callback("Desconocido");
        }

        var idModelo = recursos_encontrados[0].modelo;

        supabase.from("modelos").select("*").eq("id", parseInt(idModelo)).then(function ({ data: modelos_encontrados, error: err }) {
            if (err || modelos_encontrados.length == 0) {
                return callback("Desconocido");
            }
            return callback(modelos_encontrados[0].nom);
        });
    });
}

function obtenerNumSerie(idRecurso, callback) {

    supabase.from("recursos").select("numero_serie").eq("id", parseInt(idRecurso)).then(function ({ data: recursos_encontrados, error: err }) {
        if (err || recursos_encontrados.length == 0) {
            return callback("Desconocido");
        }
        return callback(recursos_encontrados[0].numero_serie);
    });
}

function enviarMensaje(ws, mensaje) {
    if (ws.readyState === WebSocket.OPEN) { //si la conexión está abierta
        ws.send(JSON.stringify(mensaje)); // convierte el objeto JavaScript en texto JSON
    }
}

// ================= AVISOS =================

//  AVISO ROJO
function avisarReserva(idRecurso, accion, idOrigen, nombreOrigen, reservasArray) {

    obtenerNombreCategoria(idRecurso, function (nombreCat) {
        obtenerNombreModelo(idRecurso, function (nombreMod) {
            obtenerNumSerie(idRecurso, function (numSerie) {

                var texto = "SE HA " + accion + " LA RESERVA DEL " + nombreCat.toUpperCase() +
                            " MODELO " + nombreMod.toUpperCase() + " CON CODIGO " + numSerie;

                var aviso = {
                    tipo: "reserva",
                    color: "rojo",
                    fecha: new Date().toLocaleString(),
                    origen: nombreOrigen,
                    texto: texto
                };

                //  FILTRO: TODAS las reservas NO finalizadas de ese recurso
                var sanitariosConReserva = [];

                for (var i = 0; i < reservasArray.length; i++) {
                    var r = reservasArray[i];

                    if (r.recurso == idRecurso && r.fecha_fin == null) {
                        // evitar duplicados
                        if (!sanitariosConReserva.includes(r.sanitario)) {
                            sanitariosConReserva.push(r.sanitario);
                        }
                    }
                }

                //  ENVIADO SOLO A ESOS SANITARIOS CONECTADOS
                clientes.forEach(function(info, ws) {
                    if (info.tipo === "sanitario" &&
                        sanitariosConReserva.includes(info.id) &&
                        info.id != idOrigen) { //a los sanitarios que tengan reserva y que no sea el que la ha iniciado o finalizado

                        enviarMensaje(ws, aviso);
                    }
                });
            });
        });
    });
}

//  AVISO AZUL
function avisarNuevoRecurso(idRecurso, nombreOrigen) {
    obtenerNombreCategoria(idRecurso, function (nombreCat) {
        obtenerNombreModelo(idRecurso, function (nombreMod) {
            obtenerNumSerie(idRecurso, function (numSerie) {

                var texto = "SE HA CREADO UN NUEVO RECURSO " + nombreCat.toUpperCase() +
                            " MODELO " + nombreMod.toUpperCase() + " CON CODIGO " + numSerie;

                var aviso = {
                    tipo: "nuevo_recurso",
                    color: "azul",
                    fecha: new Date().toLocaleString(),
                    origen: nombreOrigen,
                    texto: texto
                };

                clientes.forEach(function(info, ws) {
                    if (info.tipo === "sanitario") {
                        enviarMensaje(ws, aviso);
                    }
                });
            });
        });
    });
}

//  AVISO VERDE
function avisarNuevaResenya(idRecurso, puntuacion, nombreOrigen) {
    obtenerNombreCategoria(idRecurso, function (nombreCat) {
        obtenerNombreModelo(idRecurso, function (nombreMod) {
            obtenerNumSerie(idRecurso, function (numSerie) {

                var texto = "SE HA CREADO UNA RESENYA PARA EL " + nombreCat.toUpperCase() +
                            " MODELO " + nombreMod.toUpperCase() + " CON CODIGO " + numSerie +
                            " Y PUNTUACION " + puntuacion;

                var aviso = {
                    tipo: "nueva_resenya",
                    color: "verde",
                    fecha: new Date().toLocaleString(),
                    origen: nombreOrigen,
                    texto: texto
                };

                clientes.forEach(function(info, ws) {
                    if (info.tipo === "gestor") {
                        enviarMensaje(ws, aviso);
                    }
                });
            });
        });
    });
}

// ================= WEBSOCKET =================

// Render solo expone un puerto: el WebSocket se cuelga del servidor HTTP de Express.
// Se llama desde servidor_rest.js con ws.iniciar(servidor)
function iniciar(servidorHttp) {

    var wss = new WebSocket.Server({ server: servidorHttp }); //crear el servidor websocket

    wss.on("connection", function(ws) { // cuando un cliente se conecta -> este evento se ejecuta cuando un navegador abre una conexión websocket
        console.log("Nueva conexion WebSocket");  // ws es esa conexión concreta

        ws.on("message", function(mensaje) { // se ejecuta cuando el cliente envía algo al servidor
            var datos = JSON.parse(mensaje); // convertir el mensaje JSON a JavaScript

            // Evaluamos el tipo de operación enviada directo por el cable WS
            switch(datos.tipo) { //según el tipo de mensaje que llega
                case "registro":
                    clientes.set(ws, {  // el servidor guarda que ese socket pertenece a esa persona cone se id y nombre
                        tipo: datos.rol,
                        id: datos.id,
                        nombre: datos.nombre
                    });
                    break;
            }
        });

        ws.on("close", function() { //si el usuario cierra la pestaña o se corta la conexión
            clientes.delete(ws); // se elimina el socket de Map
        });

        ws.on("error", function() { //si hay un error en la conexión tmb se elimina del Map
            clientes.delete(ws);
        });
    });

    console.log("Servidor WebSocket en marcha");
}

// para utilizarlas en los servidores de los gestores o sanitarios
module.exports = {
    iniciar,
    avisarReserva,
    avisarNuevoRecurso,
    avisarNuevaResenya
};
