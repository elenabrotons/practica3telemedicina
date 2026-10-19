//Es necesario instalar en la carpeta del servidor los modulos cors y express
//Desde el terminal de la carpeta general hacemos: npm i express cors

//Por defecto escucha en el puerto 3500
 
var rpc = require("./rpc.js"); //incorporamos la libreria
// Importamos el servidor WebSocket para emitir avisos (Parte 3)
var ws = require("./servidor_websocket.js");
var conexion = require("./conexion_mysql.js");

/*
 * TIPOS DE PETICIONES MYSQL USADAS EN ESTE ARCHIVO
 * =================================================
 *
 * 1. SELECT simple (sin filtro) ? traer una tabla completa
 *    Ej: obtenerCategorias, obtenerModelos, obtenerUbicaciones
 *    var sql = "SELECT * FROM tabla";
 *
 * 2. SELECT filtrado por un campo numerico (WHERE campo = id)
 *    Ej: obtenerRecurso, obtenerSanitario, obtenerReservas,
 *        obtenerResenyas, obtenerRecursos
 *    var sql = "SELECT * FROM tabla WHERE campo = " + parseInt(id);
 *    -> El valor numerico se pasa siempre por parseInt() antes de
 *       concatenarlo, para evitar inyeccion SQL.
 *
 * 3. SELECT filtrado por un campo de texto (WHERE campo = 'valor')
 *    Ej: loginSanitario, crearSanitario (comprobar si el usuario existe)
 *    var sql = "SELECT * FROM tabla WHERE usu = '" + usu + "'";
 *    -> Deberia ir con conexion.escape(usu) al ser texto de usuario.
 *
 * 4. SELECT con varias condiciones (AND / IS NULL)
 *    Ej: reservarRecurso (comprobar reserva pendiente),
 *        iniciarReserva / finalizarReserva (fecha_fin IS NULL)
 *    var sql = "SELECT * FROM reservas WHERE recurso = " + idRec +
 *              " AND sanitario = " + idSan +
 *              " AND fecha_inicio IS NULL";
 *    -> IS NULL en vez de "= NULL" para comparar campos nulos.
 *
 * 5. INSERT ? crear un nuevo registro
 *    Ej: crearResenya, reservarRecurso, crearSanitario
 *    var sql = "INSERT INTO tabla (campo1, campo2, ...) VALUES (valor1, valor2, ...)";
 *    -> El id no se pasa (lo genera MySQL con AUTO_INCREMENT).
 *    -> El id generado se recupera con resultado.insertId en el callback.
 *    -> Los strings de usuario (ej. descripcion) van con conexion.escape().
 *
 * 6. UPDATE ? modificar un registro existente
 *    Ej: iniciarReserva (fecha_inicio), finalizarReserva (fecha_fin),
 *        actualizarSanitario (nom, apell, usu, password)
 *    var sql = "UPDATE tabla SET campo = valor WHERE id = " + parseInt(id);
 *    -> Se comprueba resultado.affectedRows para saber si realmente
 *       existia una fila con ese id.
 *
 * 7. DELETE ? eliminar un registro
 *    Ej: cancelarReserva
 *    var sql = "DELETE FROM tabla WHERE id = " + parseInt(id);
 *    -> Igual que en UPDATE, se usa resultado.affectedRows para saber
 *       si la fila existia antes de borrarla.
 *
 * 8. Peticiones encadenadas (varias queries dependientes entre si)
 *    Ej: crearResenya (busca reserva -> inserta resenya),
 *        reservarRecurso (comprueba recurso -> sanitario -> modelo -> reserva pendiente -> inserta),
 *        iniciarReserva / finalizarReserva (busca reserva -> actualiza)
 *    -> Cada conexion.query() va anidado dentro del callback de la
 *       anterior, porque el driver mysql es asincrono y se necesita
 *       el resultado de una consulta para construir la siguiente.
 */

//FUNCIONES DEL PROYECTO 

function obtenerCategorias(callback){
    var sql = "SELECT * FROM categorias";
    conexion.query(sql, function (err, categorias) {
        if (err) {
            console.log("Error al obtener categorias:", err);
            return callback(null);
        }
        return callback(categorias);
    });
}

function obtenerModelos(callback){
    var sql = "SELECT * FROM modelos";
    conexion.query(sql, function (err, modelos) {
        if (err) {
            console.log("Error al obtener modelos:", err);
            return callback(null);
        }
        return callback(modelos);
    });
}

function obtenerUbicaciones(callback){
    var sql = "SELECT * FROM ubicaciones";
    conexion.query(sql, function (err, ubicaciones) {
        if (err) {
            console.log("Error al obtener ubicaciones:", err);
            return callback(null);
        }
        return callback(ubicaciones);
    });
}

function loginSanitario(usu, password, callback) {
    // 1. Comprueba que no est� vac�o, sino devuelve null (igual que en tu c�digo)
    if (!usu || !password) {
        return callback(null);
    }

    // 2. Buscamos en la tabla sanitarios de MySQL por el nombre de usuario
        var sql = "SELECT id, password FROM sanitarios WHERE usu = " + conexion.escape(usu);    
        conexion.query(sql, function (err, sanitarios) {
        if (err) {
            console.log("Error al consultar el sanitario:", err);
            return callback(null);
        }

        // Si no se encuentra ning�n usuario con ese 'usu'
        if (sanitarios.length === 0) {
            return callback(null);
        }

        var sanitario_encontrado = sanitarios[0];

        // 3. Comprobamos si la contrase�a coincide
        if (sanitario_encontrado.password == password) {
            // Devolvemos el id del sanitario logueado exactamente como ten�as
            return callback(sanitario_encontrado.id);
        } else {
            // Si la contrase�a no es correcta
            return callback(null);
        }
    });
}

// crea el usuario desde cero.  
function crearSanitario(datosSanitario, callback) {
    // 1. Comprobamos si el usuario ya existe en la base de datos
    var sqlBuscar = "SELECT id FROM sanitarios WHERE usu = " + conexion.escape(datosSanitario.usuario);
    
    conexion.query(sqlBuscar, function (err, resultados) {
        if (err) {
            console.log("Error al comprobar usuario:", err);
            return callback(null);
        }

        // Si ya existe un sanitario con ese usuario, devolvemos null (igual que tu 'else')
        if (resultados.length > 0) {
            return callback(null);
        }

        // 2. Si no existe, insertamos en la tabla sanitarios
        // (Sin pasar 'id' porque MySQL lo genera con AUTO_INCREMENT, no usamos ultimoIdSanitario)
        var sqlInsert = "INSERT INTO sanitarios (nom, apell, usu, password) VALUES ("
            + conexion.escape(datosSanitario.nombre) + ", "
            + conexion.escape(datosSanitario.apellidos) + ", "
            + conexion.escape(datosSanitario.usuario) + ", "
            + conexion.escape(datosSanitario.password) + ")";

        conexion.query(sqlInsert, function (errInsert, resultado) {
            if (errInsert) {
                console.log("Error al insertar sanitario:", errInsert);
                return callback(null);
            }

            // resultado.insertId contiene el ID autoincremental que ha generado MySQL
            return callback(resultado.insertId);
        });
    });
}


function actualizarSanitario(idSanitario, datosSanitario, callback) {
    // 1. Validaci�n de campos obligatorios (exactamente igual que tu c�digo)
    if (!idSanitario || !datosSanitario.nombre || !datosSanitario.apellidos || !datosSanitario.usuario || !datosSanitario.password) {
        return callback(null);
    }

    // 2. Comprobamos si el nuevo 'usu' ya lo tiene OTRO sanitario diferente
    var sqlValidarUsuario = "SELECT id FROM sanitarios WHERE usu = "
    + conexion.escape(datosSanitario.usuario) + " AND id != " + parseInt(idSanitario);

    conexion.query(sqlValidarUsuario, function (err, usuariosOcupados) {
        if (err) {
            console.log("Error al validar el usuario:", err);
            return callback(null);
        }

        // Si existe otro sanitario con ese usuario, est� ocupado (devuelve null)
        if (usuariosOcupados.length > 0) {
            return callback(null);
        }

        // 3. Si est� libre (o es su propio usuario), actualizamos en la BD
        var sqlUpdate = "UPDATE sanitarios SET "
            + "nom = " + conexion.escape(datosSanitario.nombre) + ", "
            + "apell = " + conexion.escape(datosSanitario.apellidos) + ", "
            + "usu = " + conexion.escape(datosSanitario.usuario) + ", "
            + "password = " + conexion.escape(datosSanitario.password) + " "
            + "WHERE id = " + parseInt(idSanitario);

        conexion.query(sqlUpdate, function (errUpdate, resultado) {
            if (errUpdate) {
                console.log("Error al actualizar el sanitario:", errUpdate);
                return callback(null);
            }

            // affectedRows indica cu�ntas filas cambiaron o coincidieron con ese id
            if (resultado.affectedRows > 0) {
                return callback(parseInt(idSanitario));
            } else {
                // Si affectedRows es 0, no exist�a ning�n sanitario con ese id
                return callback(null);
            }
        });
    });
}


function obtenerSanitario(idSanitario, callback){
    var sql = "SELECT * FROM sanitarios WHERE id = " + parseInt(idSanitario);
    conexion.query(sql, function (err, sanitarios) {
        if (err) {
            console.log("Error al obtener modelos:", err);
            return callback(null);
        }
        //comparamos el id que nos pasa en la peticion con los del array de sanitarios
        if (sanitarios.length == 1) {
            var sanitario = {
                nombre: sanitarios[0].nom,
                apellidos: sanitarios[0].apell,
                usuario: sanitarios[0].usu, 
            }
            return callback(sanitario);
        }
        else{
            // Si llega aqui es que no lo encontro
            return callback(null);
        }
    
        });
}


function obtenerReservas(id, callback) { //de un sanitario concreto
    var sql = "SELECT * FROM reservas WHERE sanitario = " + parseInt(id);

    conexion.query(sql,function(err,reservas_sanitario){
        if (err) {
            console.log("Error al obtener reservas del sanitario:", err);
            return callback(null);
        }

        // Si hay alguna reserva de ese sanitario las devuelve
        if (reservas_sanitario.length != 0) {
            return callback(reservas_sanitario);
        } else {
            // Ese sanitario no ha hecho ninguna reserva
            return callback(null);
        }
    })
}

function obtenerRecursos(idModelo, callback){
    // 1. Filtramos en SQL por la columna 'modelo' y que el estado sea 0 (operativo/disponible)
    var sql = "SELECT id, modelo, ubicacion, numero_serie "
            + "FROM recursos "
            + "WHERE modelo = " + parseInt(idModelo) + " AND estado = 0";

    conexion.query(sql, function (err, lista_recursos) {
        if (err) {
            console.log("Error al obtener recursos del modelo:", err);
            return callback(null);
        }

        // 2. Si encontramos recursos, los devolvemos; si no, devolvemos null
        if (lista_recursos.length != 0) {
            return callback(lista_recursos);
        } else {
            return callback(null); // No hay recursos disponibles para ese modelo
        }
    });
}

function tiempoPendiente(idRecurso, callback) {
    // 1. Consultamos solo las reservas activas (no finalizadas) del recurso
    var sql = "SELECT h_estimada, fecha_inicio, fecha_fin "
            + "FROM reservas "
            + "WHERE recurso = " + parseInt(idRecurso) + " AND fecha_fin IS NULL";

    conexion.query(sql, function (err, reservasRecurso) {
        if (err) {
            console.log("Error al calcular el tiempo pendiente:", err); //[cite: 2]
            return callback(0);
        }

        var tiempo = 0;
        var ahora = new Date();

        // 2. Recorremos �nicamente las reservas que siguen activas
        for (var i = 0; i < reservasRecurso.length; i++) {
            if (reservasRecurso[i].fecha_inicio != null) { // reserva en uso (iniciada)[cite: 3, 4]
                var inicio = new Date(reservasRecurso[i].fecha_inicio); // MySQL devuelve fecha v�lida[cite: 3, 4]
                var horas_usadas = (ahora - inicio) / (1000 * 60 * 60); // conversi�n de ms a horas
                var restantes = reservasRecurso[i].h_estimada - horas_usadas; //[cite: 3, 4]

                if (restantes > 0) {
                    tiempo += restantes;
                }
            } else { // reserva pendiente de iniciar[cite: 3, 4]
                tiempo += reservasRecurso[i].h_estimada; //[cite: 3, 4]
            }
        }

        // 3. Devolvemos el tiempo total acumulado
        return callback(tiempo);
    });
}


function obtenerResenyas(id, callback) {
    // Filtramos en MySQL por la columna 'recurso'
    var sql = "SELECT * FROM resenyas WHERE recurso = " + parseInt(id);

    conexion.query(sql, function (err, resenyas_recurso) {
        if (err) {
            console.log("Error al obtener resenyas:", err);
            return callback(null);
        }

        // Si hay rese�as devuelve el array, si no devuelve null (igual que tu c�digo)
        if (resenyas_recurso.length > 0) {
            return callback(resenyas_recurso);
        } else {
            return callback(null);
        }    
    });
}

function crearResenya(idReserva, idSanitario, val, descrip, callback) {

    if (val == null || descrip == null || descrip == "") {
        return callback(null);
    }

    // 1. Buscamos la reserva para sacar el recurso al que pertenece
    var sqlReserva = "SELECT * FROM reservas WHERE id = " + parseInt(idReserva);

    conexion.query(sqlReserva, function (err, reservas_encontradas) {
        if (err) {
            console.log("Error al buscar reserva:", err);
            return callback(null);
        }

        if (reservas_encontradas.length == 0) {
            return callback(null);
        }

        var idRecurso = reservas_encontradas[0].recurso;

        // 2. Insertamos la nueva resenya
        var sqlInsert = "INSERT INTO resenyas (recurso, sanitario, fecha, valor, descripcion) VALUES (" +
            parseInt(idRecurso) + ", " +
            parseInt(idSanitario) + ", NOW(), " +
            parseInt(val) + ", " + conexion.escape(descrip) + ")";

        conexion.query(sqlInsert, function (err, resultado) {
            if (err) {
                console.log("Error al crear resenya:", err);
                return callback(null);
            }

            var idNuevaResenya = resultado.insertId;

            // 3. Buscamos el nombre del sanitario para el aviso por WebSocket
            var sqlSanitario = "SELECT * FROM sanitarios WHERE id = " + parseInt(idSanitario);

            conexion.query(sqlSanitario, function (err, sanitarios_encontrados) {
                if (err) {
                    console.log("Error al buscar sanitario:", err);
                    return callback(idNuevaResenya); // la resenya ya se cre�, seguimos igualmente
                }

                var nombreSan = "Sanitario";
                if (sanitarios_encontrados.length > 0) {
                    nombreSan = sanitarios_encontrados[0].nom + " " + sanitarios_encontrados[0].apell;
                }

                ws.avisarNuevaResenya(idRecurso, val, nombreSan);

                return callback(idNuevaResenya);
            });
        });
    });
}

function reservarRecurso(idRec, idSan, hora_estimada, callback) {

    if (!idRec || !idSan || !hora_estimada || hora_estimada <= 0) {
        return callback(null);
    }

    idRec = parseInt(idRec);
    idSan = parseInt(idSan);
    hora_estimada = parseInt(hora_estimada);

    // 1. Comprueba si el recurso existe
    var sqlRecurso = "SELECT * FROM recursos WHERE id = " + idRec;

    conexion.query(sqlRecurso, function (err, recursos_encontrados) {
        if (err) {
            console.log("Error al buscar recurso:", err);
            return callback(null);
        }

        if (recursos_encontrados.length == 0) {
            return callback(null); // recurso no existe
        }

        var recurso = recursos_encontrados[0];

        // Comprobar que el recurso está operativo
        if (recurso.estado != 0) {
            return callback(null);
        }

        // 2. Comprueba si el sanitario existe
        var sqlSanitario = "SELECT * FROM sanitarios WHERE id = " + idSan;

        conexion.query(sqlSanitario, function (err, sanitarios_encontrados) {
            if (err) {
                console.log("Error al buscar sanitario:", err);
                return callback(null);
            }

            if (sanitarios_encontrados.length == 0) {
                return callback(null);
            }

            // 3. Comprueba las horas maximas del modelo
            var sqlModelo = "SELECT * FROM modelos WHERE id = " + parseInt(recurso.modelo);

            conexion.query(sqlModelo, function (err, modelos_encontrados) {
                if (err) {
                    console.log("Error al buscar modelo:", err);
                    return callback(null);
                }

                if (modelos_encontrados.length == 0 || hora_estimada > modelos_encontrados[0].horas_max) {
                    return callback(null);
                }

                // 4. Comprueba si ya tiene una reserva pendiente de ese recurso
                var sqlPendiente = "SELECT * FROM reservas WHERE recurso = " + idRec +
                    " AND sanitario = " + idSan +
                    " AND fecha_inicio IS NULL";

                conexion.query(sqlPendiente, function (err, reservas_pendientes) {
                    if (err) {
                        console.log("Error al comprobar reservas pendientes:", err);
                        return callback(null);
                    }

                    if (reservas_pendientes.length > 0) {
                        return callback(null); // ya tiene una reserva pendiente
                    }

                    // 5. Crea la reserva
                    var sqlInsert = "INSERT INTO reservas (recurso, sanitario, h_estimada, fecha_peticion, fecha_inicio, fecha_fin) VALUES (" +
                        idRec + ", " +
                        idSan + ", " +
                        hora_estimada + ", NOW(), NULL, NULL)";

                    conexion.query(sqlInsert, function (err, resultado) {
                        if (err) {
                            console.log("Error al crear reserva:", err);
                            return callback(null);
                        }

                        return callback(resultado.insertId);
                    });
                });
            });
        });
    });
}


function cancelarReserva(id, callback) {
    var sql = "DELETE FROM reservas WHERE id = " + parseInt(id);

    conexion.query(sql, function (err, resultado) {
        if (err) {
            console.log("Error al cancelar reserva:", err);
            return callback("Error al cancelar reserva", null);
        }

        if (resultado.affectedRows > 0) { //Comprobacion de si exist�a la reserva. Si es mayor que 0, es que la fila exist�a y se ha borrado; si es 0, no hab�a ninguna reserva con ese id.
            return callback("Reserva cancelada");
        } else {
            return callback("Reserva no encontrada", null);
        }
    });
}


function iniciarReserva(idReserva, callback) {
    var idReservaInt = parseInt(idReserva);

    // 1. Buscamos la reserva
    var sqlBuscar = "SELECT * FROM reservas WHERE id = " + idReservaInt;

    conexion.query(sqlBuscar, function (err, reservas_encontradas) {
        if (err) {
            console.log("Error al buscar reserva:", err);
            return callback(null);
        }

        if (reservas_encontradas.length == 0) {
            return callback(null); // no se encontro la reserva
        }

        var reserva = reservas_encontradas[0];

        if (reserva.fecha_inicio != null) { // si ya estaba iniciada no hacemos nada
            return callback(null);
        }

        // Comprobar que el recurso está operativo
        var sqlRecurso = "SELECT * FROM recursos WHERE id = " + parseInt(reserva.recurso);

        conexion.query(sqlRecurso, function(err, recursos) {

            if (err || recursos.length == 0) {
                return callback(null);
            }

            if (recursos[0].estado != 0) {
                return callback(null);
            }

            // 2. Marcamos la reserva como iniciada
            var sqlUpdate = "UPDATE reservas SET fecha_inicio = NOW() WHERE id = " + idReservaInt;

            conexion.query(sqlUpdate, function (err, resultado) {
                if (err) {
                    console.log("Error al iniciar reserva:", err);
                    return callback(null);
                }

                var idRec = reserva.recurso;
                var idSan = reserva.sanitario;

                // 3. Buscamos el nombre del sanitario para el aviso
                var sqlSanitario = "SELECT * FROM sanitarios WHERE id = " + parseInt(idSan);

                conexion.query(sqlSanitario, function (err, sanitarios_encontrados) {
                    if (err) {
                        console.log("Error al buscar sanitario:", err);
                        return callback("Recurso iniciado"); // ya se inicio, seguimos igualmente
                    }

                    var nombreSan = "Sanitario";
                    if (sanitarios_encontrados.length > 0) {
                        nombreSan = sanitarios_encontrados[0].nom + " " + sanitarios_encontrados[0].apell;
                    }

                    // 4. Recuperamos las reservas de ese recurso para pasarlas al aviso WS
                    var sqlReservasRecurso = "SELECT * FROM reservas WHERE recurso = " + parseInt(idRec);

                    conexion.query(sqlReservasRecurso, function (err, reservas_recurso) {
                        if (err) {
                            console.log("Error al obtener reservas del recurso:", err);
                            reservas_recurso = [];
                        }

                        ws.avisarReserva(idRec, "INICIADO", idSan, nombreSan, reservas_recurso);

                        return callback("Recurso iniciado");
                    });
                });
            });
        });
    });
}
 
function finalizarReserva(id, callback) {
    var idInt = parseInt(id);

    // 1. Buscamos la reserva (solo si aun no estaba finalizada)
    var sqlBuscar = "SELECT * FROM reservas WHERE id = " + idInt + " AND fecha_fin IS NULL";

    conexion.query(sqlBuscar, function (err, reservas_encontradas) {
        if (err) {
            console.log("Error al buscar reserva:", err);
            return callback(null);
        }

        if (reservas_encontradas.length == 0) {
            return callback(null);
        }

        var reserva = reservas_encontradas[0];
        var idRec = reserva.recurso;
        var idSan = reserva.sanitario;

        // 2. Buscamos el nombre del sanitario para el aviso
        var sqlSanitario = "SELECT * FROM sanitarios WHERE id = " + parseInt(idSan);

        conexion.query(sqlSanitario, function (err, sanitarios_encontrados) {
            if (err) {
                console.log("Error al buscar sanitario:", err);
                return callback(null);
            }

            var nombreSan = "Sanitario";
            if (sanitarios_encontrados.length > 0) {
                nombreSan = sanitarios_encontrados[0].nom + " " + sanitarios_encontrados[0].apell;
            }

            // 3. Recuperamos las reservas de ese recurso para pasarlas al aviso WS
            var sqlReservasRecurso = "SELECT * FROM reservas WHERE recurso = " + parseInt(idRec);

            conexion.query(sqlReservasRecurso, function (err, reservas_recurso) {
                if (err) {
                    console.log("Error al obtener reservas del recurso:", err);
                    reservas_recurso = [];
                }

                ws.avisarReserva(idRec, "FINALIZADO", idSan, nombreSan, reservas_recurso);

                // 4. Marcamos la reserva como finalizada
                var sqlUpdate = "UPDATE reservas SET fecha_fin = NOW() WHERE id = " + idInt;

                conexion.query(sqlUpdate, function (err, resultado) {
                    if (err) {
                        console.log("Error al finalizar reserva:", err);
                        return callback(null);
                    }

                    return callback(idInt);
                });
            });
        });
    });
}

function obtenerRecurso(idRecurso, callback) {
    var sql = "SELECT * FROM recursos WHERE id = " + parseInt(idRecurso);

    conexion.query(sql, function (err, recursos_encontrados) {
        if (err) {
            console.log("Error al obtener recurso:", err);
            return callback(null);
        }

        if (recursos_encontrados.length == 0) {
            return callback(null);
        }

        var r = recursos_encontrados[0];

        var recurso = {
            id: r.id,
            mod: r.modelo,
            ubicacion: r.ubicacion,
            numero_serie: r.numero_serie,
            estado: r.estado
        };

        return callback(recurso);
    });
}





var servidor = rpc.server(); // crear el servidor RPC
var app = servidor.createApp("gestion_sanitarios"); 

app.registerAsync(obtenerCategorias);
app.registerAsync(obtenerModelos);
app.registerAsync(obtenerUbicaciones);
app.registerAsync(loginSanitario);
app.registerAsync(crearSanitario);
app.registerAsync(actualizarSanitario);
app.registerAsync(obtenerSanitario);
app.registerAsync(obtenerRecursos);
app.registerAsync(tiempoPendiente);
app.registerAsync(obtenerReservas);
app.registerAsync(obtenerResenyas);
app.registerAsync(crearResenya);
app.registerAsync(reservarRecurso);
app.registerAsync(cancelarReserva);
app.registerAsync(iniciarReserva);
app.registerAsync(finalizarReserva);
app.registerAsync(obtenerRecurso);



console.log("Servidor RPC en marcha");