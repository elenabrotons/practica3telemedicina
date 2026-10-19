// Importamos el framework Express para crear el servidor HTTP
var express = require("express");
// Importamos el servidor WebSocket para emitir avisos (Parte 3)
var ws = require("./servidor_websocket");
// Creamos la aplicacion del servidor
var app = express();

var jwt = require("jwt-simple");
var clave = "laClaveSecreta";

// Middleware para servir archivos estaticos del cliente
// Permite acceder a la aplicacion web desde el navegador
app.use("/appCliente", express.static("cliente")); 
// Middleware para interpretar peticiones con body en formato JSON
// Necesario para recibir datos en POST y PUT
app.use(express.json()); 



// Importamos la conexion con la base de datos MySQL
var conexion = require("./conexion_mysql.js");


//-------------------------------------------------------------------

//LOGIN GESTOR
// Verifica las credenciales recibidas en el body.
// Si usuario y contrasenya son correctos, devuelve el ID del gestor (200).
// Si no coinciden, devuelve 403.

app.post("/api/gestores/login", function (req, res) {
    var datos_nuevos = req.body;
    var usuario_buscado = datos_nuevos.usuario; 
    var password_buscado = datos_nuevos.password;

    var sql = "SELECT * FROM gestores WHERE usu = ?"; // el ? se sustituye por [usuario buscado]
    
    conexion.query(sql, [usuario_buscado], function(err, gestores_encontrados) {

        if (err) {
            console.log("Error al consultar el gestor:", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }

        // No existe ningún gestor con ese usuario
        if (gestores_encontrados.length == 0) {
            res.status(403).json("Usuario incorrecto");
            return;
        }

        // Cogemos el gestor encontrado
        var gestor_encontrado = gestores_encontrados[0];

        // Comprobamos la contraseña
        if (gestor_encontrado.password == password_buscado) {

            // Crear el contenido del token
            var contenido = {
                usuario: gestor_encontrado.id,
                expira: Date.now() + 60 * 60 * 1000 //establece caducidad dentro de una hora
            };

            // Generar el token
            var token = jwt.encode(contenido, clave);

            res.status(200).json({
                id: gestor_encontrado.id,
                token: token
            });

        } else {
            res.status(403).json("Contraseña incorrecta");
        }

    });
    
});


// REGISTRO DE NUEVO GESTOR
// Se realiza desde el login, no el inicio 
// Crea un nuevo gestor si el nombre de usuario no esta ya registrado.
// Devuelve 201 si se crea correctamente.
// Devuelve 403 si el usuario ya existe.

app.post("/api/gestores",function (req,res){
    var datos_nuevos = req.body;
    var nombre_nuevo = datos_nuevos.nombre;
    var apellidos_nuevo = datos_nuevos.apellidos;
    var usuario_nuevo = datos_nuevos.usuario; 
    var password_nuevo = datos_nuevos.password;

     // Primero comprobamos si ya existe ese nombre de usuario
    var sql_buscar = "SELECT * FROM gestores WHERE usu = ?";

    conexion.query(sql_buscar, [usuario_nuevo], function (err, gestores_encontrados) {

        if (err) {
            console.log("Error al buscar el gestor:", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }

        // Si ya existe un gestor con ese usuario
        if (gestores_encontrados.length > 0) {
            res.status(403).json("Usuario ya existente.");
            return;
        }

        // Si no existe, lo insertamos
        var sql_insertar =
            "INSERT INTO gestores (nom, apell, usu, password) VALUES (?, ?, ?, ?)";

        conexion.query(
            sql_insertar,
            [nombre_nuevo, apellidos_nuevo, usuario_nuevo, password_nuevo],
            function (err, resultado) {

                if (err) {
                    console.log("Error al insertar el gestor:", err);
                    res.status(500).json("Error al registrar usuario");
                    return;
                }

                res.status(201).json("Usuario registrado");
            }
        );

    });
});


// COMPROBAR JWT

app.use("/api", function(req, res, next){

    var token = req.query.token;

    if(!token){
        res.status(401).json("No se ha encontrado token");
        return;
    }

    // Decodificar el token
    var contenidoToken;

    try {
        contenidoToken = jwt.decode(token, clave);
    } catch(error){
        res.status(401).json("El token es incorrecto");
        return;
    }

    // Validar el contenido
    if(!contenidoToken || !contenidoToken.expira || !contenidoToken.usuario){
        res.status(401).json("El formato del token no es adecuado");
        return;
    }

    // Comprobar la caducidad
    if(contenidoToken.expira < Date.now()){
        res.status(401).json("El token ha expirado");
        return;
    }

    // Token correcto
    next();
});


// Estos servicios son de solo lectura.
// No se permite modificar estas colecciones desde la aplicacion.

// Devuelve todas las ubicaciones del sistema
app.get("/api/ubicaciones", function(req, res){
    var sql = "SELECT * FROM ubicaciones";

    conexion.query(sql, function(err, ubicaciones){

        if (err) {
            console.log("Error al consultar las ubicaciones:", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }

        res.status(200).json(ubicaciones);
    });
});

// Devuelve todas las categorias disponibles
app.get("/api/categorias", function(req, res){
    var sql = "SELECT * FROM categorias";

    conexion.query(sql, function(err, categorias){

        if (err) {
            console.log("Error al consultar las categorias:", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }

        res.status(200).json(categorias);
    });
});

// Devuelve todos los modelos registrados
app.get("/api/modelos", function(req, res){
    var sql = "SELECT * FROM modelos";

    conexion.query(sql, function(err, modelos){

        if (err) {
            console.log("Error al consultar los modelos:", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }

        res.status(200).json(modelos);
    });
});


//ACTUALIZACION DE GESTOR
// Permite modificar los datos de un gestor existente.
// Se mantiene el ID original.
// Se valida que el nuevo usuario no este repetido.
// Devuelve:
// 200 ? actualizado
// 403 ? usuario duplicado
// 404 ? gestor no encontrado

app.put("/api/gestores/:id", function(req, res) {
    var id_gestor = parseInt(req.params.id);
    var datos = req.body;

    // 1. Validacion minima de campos requeridos
    if (!datos || !datos.nombre || !datos.apellidos || !datos.usuario || !datos.password) {
        res.status(400).json("Faltan datos obligatorios");
        return;
    }

    // Primero comprobamos que el gestor existe
    var sql_buscar_gestor = "SELECT * FROM gestores WHERE id = ?";

    conexion.query(sql_buscar_gestor, [id_gestor], function(err, gestores_encontrados) {

        if (err) {
            console.log("Error al buscar el gestor:", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }

        if (gestores_encontrados.length == 0) {
            res.status(404).json("Gestor no encontrado");
            return;
        }

        // Comprobamos que el nuevo nombre de usuario
        // no pertenece a OTRO gestor
        var sql_buscar_usuario =
            "SELECT * FROM gestores WHERE usu = ? AND id != ?";

        conexion.query(
            sql_buscar_usuario,
            [datos.usuario, id_gestor],
            function(err, usuarios_encontrados) {

                if (err) {
                    console.log("Error al comprobar el usuario:", err);
                    res.status(500).json("Error al realizar la consulta");
                    return;
                }

                if (usuarios_encontrados.length > 0) {
                    res.status(403).json(
                        "El nombre de usuario ya esta cogido por otra persona"
                    );
                    return;
                }

                // Actualizamos el gestor
                var sql_actualizar =
                    "UPDATE gestores SET nom = ?, apell = ?, usu = ?, password = ? WHERE id = ?";

                conexion.query(
                    sql_actualizar,
                    [
                        datos.nombre,
                        datos.apellidos,
                        datos.usuario,
                        datos.password,
                        id_gestor
                    ],
                    function(err, resultado) {

                        if (err) {
                            console.log("Error al actualizar el gestor:", err);
                            res.status(500).json("Error al actualizar el gestor");
                            return;
                        }

                        res.status(200).json("Usuario actualizado correctamente");
                    }
                );
            }
        );
    });
});


//OBTENCION DE DATOS DEL GESTOR
// Devuelve los datos de un gestor por su ID.
// No se devuelve la contrasenya por seguridad.

app.get("/api/gestores/:id", function(req,res){
    
    var id_gestor = parseInt(req.params.id);

    var sql = "SELECT * FROM gestores WHERE id = ?";

    conexion.query(sql, [id_gestor], function(err, gestores_encontrados) {

        if (err) {
            console.log("Error al consultar el gestor:", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }

        if (gestores_encontrados.length == 0) {
            res.status(404).json("Gestor no encontrado");
            return;
        }

        var gestor = gestores_encontrados[0];

        res.status(200).json({
            nombre: gestor.nom,
            apellidos: gestor.apell,
            usuario: gestor.usu
        });

    });
});


//OBTENCION DE DATOS DEL SANITARIO
// Devuelve los datos de 1 SOLO sanitario.
// Se usa principalmente para mostrar nombre en reservas.
// No devuelve el codigo de acceso (password).

app.get("/api/sanitarios/:id",function(req,res){
    
    var id_sanitario = parseInt(req.params.id);

    var sql = "SELECT * FROM sanitarios WHERE id = ?";
    
    conexion.query(sql, [id_sanitario], function(err, sanitarios_encontrados) {

        if (err) {
            console.log("Error al consultar el sanitario:", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }

        if (sanitarios_encontrados.length == 0) {
            res.status(404).json("Sanitario no encontrado");
            return;
        }

        var sanitario = sanitarios_encontrados[0];

        res.status(200).json({
            nombre: sanitario.nom,
            apellidos: sanitario.apell,
            usuario: sanitario.usu
        });

    });
});

// LISTADO DE SANITARIOS
// Devuelve todos los sanitarios, usado para rellenar el select
// al crear una reserva desde el gestor.

app.get("/api/sanitarios", function(req, res){
    var sql = "SELECT * FROM sanitarios";

    conexion.query(sql, function(err, sanitarios){
        if (err) {
            console.log("Error al consultar los sanitarios:", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }
        res.status(200).json(sanitarios);
    });
});


//LISTADO DE RECURSOS CON FILTRO
// Permite obtener todos los recursos. Opcionalmente se pueden aplicar filtros por:
// - categoria
// - modelo
// - ubicacion
// - estado
// Los filtros se reciben como query parameters:
// api/recursos?categoria=idCategoria&modelo=idModelo&ubicacion=idUbicacion&estado=idEstado 

app.get("/api/recursos", function(req, res){

    var id_categoria = req.query.categoria;
    var id_modelo = req.query.modelo;
    var id_ubicacion = req.query.ubicacion;
    var id_estado = req.query.estado;
// INNER JOIN --> Estoy pidiendo que devuelva de la BD los datos de los recursos cuyo modelo se encuentre en la tabla de modelo.
    var sql = `
        SELECT 
            recursos.id,
            recursos.modelo,
            recursos.ubicacion,
            recursos.numero_serie,
            recursos.estado
        FROM recursos
        INNER JOIN modelos ON recursos.modelo = modelos.id
        WHERE 1 = 1
    `;

    var valores = [];

    // FILTRO CATEGORIA
    if (id_categoria) {
        sql += " AND modelos.cat = ?";
        valores.push(id_categoria);
    }

    // FILTRO MODELO
    if (id_modelo) {
        sql += " AND recursos.modelo = ?";
        valores.push(id_modelo);
    }

    // FILTRO UBICACION
    if (id_ubicacion) {
        sql += " AND recursos.ubicacion = ?";
        valores.push(id_ubicacion);
    }

    // FILTRO ESTADO
    if (id_estado != null && id_estado !== "") {
        sql += " AND recursos.estado = ?";
        valores.push(id_estado);
    }

    conexion.query(sql, valores, function(err, recursos_encontrados){

        if (err) {
            console.log("Error al consultar los recursos:", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }

        res.status(200).json(recursos_encontrados);

    });


});


//GET RECURSO POR ID
// Devuelve los datos de un recurso especifico.

app.get("/api/recursos/:id", function(req,res){
    var id_recurso = parseInt(req.params.id);

    var sql = "SELECT * FROM recursos WHERE id = ?";

    conexion.query(sql, [id_recurso], function(err, recursos_encontrados){

        if (err) {
            console.log("Error al consultar el recurso:", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }

        if (recursos_encontrados.length == 0) {
            res.status(404).json("Recurso no encontrado");
            return;
        }

        var recurso = recursos_encontrados[0];

        res.status(200).json({
            id: recurso.id,
            modelo: recurso.modelo,
            ubicacion: recurso.ubicacion,
            numero_serie: recurso.numero_serie,
            estado: recurso.estado
        });

    });
});

//CREAR UN RECURSO
// Recibe los datos del recurso en el body.
// Genera un ID automaticamente.
// Devuelve 201 si se crea correctamente.
// Emite aviso WebSocket (azul) a todos los sanitarios conectados.

app.post("/api/recursos", function(req,res){
    var datos_nuevos = req.body
    var modelo_rec = datos_nuevos.modelo;
    var ubicacion_rec = datos_nuevos.ubicacion;
    var num_rec = datos_nuevos.numero_serie;
    var estado_rec = datos_nuevos.estado;
    var nombre_gestor = datos_nuevos.nombre_gestor || "Gestor"; // Para el aviso WS

    
    var sql = `
        INSERT INTO recursos
        (modelo, ubicacion, numero_serie, estado)
        VALUES (?, ?, ?, ?)
    `;

    conexion.query(
        sql,
        [modelo_rec, ubicacion_rec, num_rec, estado_rec],
        function(err, resultado){

            if (err) {
                console.log("Error al crear el recurso:", err);
                res.status(500).json("Error al crear el recurso");
                return;
            }

            var id_nuevo = resultado.insertId; // para saber qué id ha creado MySQL

            var nuevo_recurso = {
                id: id_nuevo,
                modelo: modelo_rec,
                ubicacion: ubicacion_rec,
                numero_serie: num_rec,
                estado: estado_rec
            };

            ws.avisarNuevoRecurso(id_nuevo, nombre_gestor);

            res.status(201).json(nuevo_recurso);
        }
    );
});

//ACTUALIZAR RECURSO
// Sustituye completamente el objeto recurso.
// Si el ID existe ? 200.
// Si no existe ?  404

app.put("/api/recursos/:id", function(req,res){
    var id_rec = parseInt(req.params.id);
    var datos_nuevos = req.body
    
    var modelo_rec = datos_nuevos.modelo;
    var ubicacion_rec = datos_nuevos.ubicacion;
    var num_rec = datos_nuevos.numero_serie;
    var estado_rec = datos_nuevos.estado;

    var sql = `
        UPDATE recursos
        SET modelo = ?, ubicacion = ?, numero_serie = ?, estado = ?
        WHERE id = ?
    `;

    conexion.query(
        sql,
        [modelo_rec, ubicacion_rec, num_rec, estado_rec, id_rec],
        function(err, resultado){

            if (err) {
                console.log("Error al actualizar el recurso:", err);
                res.status(500).json("Error al actualizar el recurso");
                return;
            }

            // Si no se ha actualizado ninguna fila,
            // significa que ese ID no existe
            if (resultado.affectedRows == 0) { 
                res.status(404).json("Recurso no encontrado");
                return;
            }

            res.status(200).json("Recurso actualizado");
        }
    );

});

// ELIMINAR RECURSO
// Busca el recurso por ID.
// Si existe ? lo elimina del array (splice).
// Devuelve:
// 200 ? eliminado
// 404 ? no encontrado

app.delete("/api/recursos/:id", function(req,res){
    var id_rec = parseInt(req.params.id);

    var sql = "DELETE FROM recursos WHERE id = ?";

    conexion.query(sql, [id_rec], function(err, resultado){

        if (err) {
            console.log("Error al eliminar el recurso:", err);
            res.status(500).json("Error al eliminar el recurso");
            return;
        }

        // Si no se ha eliminado ninguna fila,
        // significa que el recurso no existía
        if (resultado.affectedRows == 0) {
            res.status(404).json("Recurso no encontrado");
            return;
        }

        res.status(200).json("Recurso eliminado");

    });
});


// OBTENER RESERVAS DE UN RECURSO
// Verifica primero que el recurso exista.
// Si no existe ? 404.
// Si existe ? devuelve todas sus reservas.

app.get("/api/recursos/:id/reservas", function(req,res){

    var id_recurso = parseInt(req.params.id);
    
    // Primero comprobamos que el recurso existe
    var sql_recurso = "SELECT * FROM recursos WHERE id = ?";

    conexion.query(sql_recurso, [id_recurso], function(err, recursos_encontrados){

        if (err) {
            console.log("Error al consultar el recurso:", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }

        if (recursos_encontrados.length == 0) {
            res.status(404).json("Recurso no encontrado");
            return;
        }

        // Si existe, buscamos sus reservas
        var sql_reservas = "SELECT * FROM reservas WHERE recurso = ?";

        conexion.query(sql_reservas, [id_recurso], function(err, reservas_encontradas){

            if (err) {
                console.log("Error al consultar las reservas:", err);
                res.status(500).json("Error al realizar la consulta");
                return;
            }

            res.status(200).json(reservas_encontradas);

        });

    });

}); 


// OBTENER RESEnyAS DE UN RECURSO
// Igual que reservas:
// - Verifica existencia del recurso
// - Devuelve resenyas asociadas

app.get("/api/recursos/:id/resenyas", function(req, res){
    
    var id_recurso = parseInt(req.params.id);
    
    // Primero comprobamos que el recurso existe
    var sql_recurso = "SELECT * FROM recursos WHERE id = ?";

    conexion.query(sql_recurso, [id_recurso], function(err, recursos_encontrados){

        if (err) {
            console.log("Error al consultar el recurso:", err);
            res.status(500).json("Error al realizar la consulta");
            return;
        }

        if (recursos_encontrados.length == 0) {
            res.status(404).json("Recurso no encontrado");
            return;
        }

        // Si existe, buscamos sus reseñas
        var sql_resenyas = "SELECT * FROM resenyas WHERE recurso = ?";

        conexion.query(sql_resenyas, [id_recurso], function(err, resenyas_encontradas){

            if (err) {
                console.log("Error al consultar las resenyas:", err);
                res.status(500).json("Error al realizar la consulta");
                return;
            }

            res.status(200).json(resenyas_encontradas);

        });

    });
});




// INICIO DEL SERVIDOR
// El servidor escucha en el puerto 3000.

app.listen(3000, function(){
    console.log("Servidor en marcha");
});