// Importamos el framework Express para crear el servidor HTTP
var express = require("express");
// Importamos el servidor WebSocket para emitir avisos (Parte 3)
var ws = require("./servidor_websocket");
// Creamos la aplicacion del servidor
var app = express();

var jwt = require("jwt-simple");
var clave = "laClaveSecreta";

// Importamos el cliente de Supabase
const { createClient } = require('@supabase/supabase-js');

// Configuramos con la URL y la anon key de tu proyecto
const supabaseUrl = 'https://cibmfinwvhrkbmflsazt.supabase.co';
const supabaseKey = 'sb_publishable_jXgzSiRE3njWzGoT4dUUIw_zIG9i6Xv';
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware para servir archivos estaticos del cliente
app.use("/appCliente", express.static("cliente"));
// Middleware para interpretar peticiones con body en formato JSON
app.use(express.json());


//-------------------------------------------------------------------

// LOGIN GESTOR
// 200 -> { id, token } | 403 -> usuario o contrasenya incorrectos

app.post("/api/gestores/login", async function (req, res) {
    var usuario_buscado = req.body.usuario;
    var password_buscado = req.body.password;

    var { data: gestores_encontrados, error } = await supabase
        .from("gestores")
        .select("*")
        .eq("usu", usuario_buscado);

    if (error) {
        console.log("Error al consultar el gestor:", error);
        res.status(500).json("Error al realizar la consulta");
        return;
    }

    if (gestores_encontrados.length == 0) {
        res.status(403).json("Usuario incorrecto");
        return;
    }

    var gestor_encontrado = gestores_encontrados[0];

    if (gestor_encontrado.password == password_buscado) {

        var contenido = {
            usuario: gestor_encontrado.id,
            expira: Date.now() + 60 * 60 * 1000 // caduca en una hora
        };

        var token = jwt.encode(contenido, clave);

        res.status(200).json({
            id: gestor_encontrado.id,
            token: token
        });

    } else {
        res.status(403).json("Contraseña incorrecta");
    }
});


// REGISTRO DE NUEVO GESTOR
// 201 -> creado | 403 -> usuario ya existe

app.post("/api/gestores", async function (req, res) {
    var datos_nuevos = req.body;
    var nombre_nuevo = datos_nuevos.nombre;
    var apellidos_nuevo = datos_nuevos.apellidos;
    var usuario_nuevo = datos_nuevos.usuario;
    var password_nuevo = datos_nuevos.password;

    var { data: gestores_encontrados, error } = await supabase
        .from("gestores")
        .select("id")
        .eq("usu", usuario_nuevo);

    if (error) {
        console.log("Error al buscar el gestor:", error);
        res.status(500).json("Error al realizar la consulta");
        return;
    }

    if (gestores_encontrados.length > 0) {
        res.status(403).json("Usuario ya existente.");
        return;
    }

    var { error: error_insertar } = await supabase
        .from("gestores")
        .insert({
            nom: nombre_nuevo,
            apell: apellidos_nuevo,
            usu: usuario_nuevo,
            password: password_nuevo
        });

    if (error_insertar) {
        console.log("Error al insertar el gestor:", error_insertar);
        res.status(500).json("Error al registrar usuario");
        return;
    }

    res.status(201).json("Usuario registrado");
});


// COMPROBAR JWT
// Todo lo que se define a partir de aqui exige token

app.use("/api", function (req, res, next) {

    var token = req.query.token;

    if (!token) {
        res.status(401).json("No se ha encontrado token");
        return;
    }

    var contenidoToken;

    try {
        contenidoToken = jwt.decode(token, clave);
    } catch (error) {
        res.status(401).json("El token es incorrecto");
        return;
    }

    if (!contenidoToken || !contenidoToken.expira || !contenidoToken.usuario) {
        res.status(401).json("El formato del token no es adecuado");
        return;
    }

    if (contenidoToken.expira < Date.now()) {
        res.status(401).json("El token ha expirado");
        return;
    }

    next();
});


// SERVICIOS DE SOLO LECTURA

app.get("/api/ubicaciones", async function (req, res) {
    var { data, error } = await supabase.from("ubicaciones").select("*");

    if (error) {
        console.log("Error al consultar las ubicaciones:", error);
        res.status(500).json("Error al realizar la consulta");
        return;
    }

    res.status(200).json(data);
});

app.get("/api/categorias", async function (req, res) {
    var { data, error } = await supabase.from("categorias").select("*");

    if (error) {
        console.log("Error al consultar las categorias:", error);
        res.status(500).json("Error al realizar la consulta");
        return;
    }

    res.status(200).json(data);
});

app.get("/api/modelos", async function (req, res) {
    var { data, error } = await supabase.from("modelos").select("*");

    if (error) {
        console.log("Error al consultar los modelos:", error);
        res.status(500).json("Error al realizar la consulta");
        return;
    }

    res.status(200).json(data);
});


// ACTUALIZACION DE GESTOR
// 200 actualizado | 400 faltan datos | 403 usuario duplicado | 404 no existe

app.put("/api/gestores/:id", async function (req, res) {
    var id_gestor = parseInt(req.params.id);
    var datos = req.body;

    if (!datos || !datos.nombre || !datos.apellidos || !datos.usuario || !datos.password) {
        res.status(400).json("Faltan datos obligatorios");
        return;
    }

    // Comprobamos que el gestor existe
    var { data: gestores_encontrados, error } = await supabase
        .from("gestores")
        .select("id")
        .eq("id", id_gestor);

    if (error) {
        console.log("Error al buscar el gestor:", error);
        res.status(500).json("Error al realizar la consulta");
        return;
    }

    if (gestores_encontrados.length == 0) {
        res.status(404).json("Gestor no encontrado");
        return;
    }

    // Comprobamos que el nuevo usuario no pertenece a OTRO gestor
    var { data: usuarios_encontrados, error: error_usuario } = await supabase
        .from("gestores")
        .select("id")
        .eq("usu", datos.usuario)
        .neq("id", id_gestor);

    if (error_usuario) {
        console.log("Error al comprobar el usuario:", error_usuario);
        res.status(500).json("Error al realizar la consulta");
        return;
    }

    if (usuarios_encontrados.length > 0) {
        res.status(403).json("El nombre de usuario ya esta cogido por otra persona");
        return;
    }

    var { error: error_actualizar } = await supabase
        .from("gestores")
        .update({
            nom: datos.nombre,
            apell: datos.apellidos,
            usu: datos.usuario,
            password: datos.password
        })
        .eq("id", id_gestor);

    if (error_actualizar) {
        console.log("Error al actualizar el gestor:", error_actualizar);
        res.status(500).json("Error al actualizar el gestor");
        return;
    }

    res.status(200).json("Usuario actualizado correctamente");
});


// OBTENCION DE DATOS DEL GESTOR (sin contrasenya)

app.get("/api/gestores/:id", async function (req, res) {
    var id_gestor = parseInt(req.params.id);

    var { data: gestores_encontrados, error } = await supabase
        .from("gestores")
        .select("*")
        .eq("id", id_gestor);

    if (error) {
        console.log("Error al consultar el gestor:", error);
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


// OBTENCION DE DATOS DE UN SANITARIO (sin contrasenya)

app.get("/api/sanitarios/:id", async function (req, res) {
    var id_sanitario = parseInt(req.params.id);

    var { data: sanitarios_encontrados, error } = await supabase
        .from("sanitarios")
        .select("*")
        .eq("id", id_sanitario);

    if (error) {
        console.log("Error al consultar el sanitario:", error);
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


// LISTADO DE SANITARIOS

app.get("/api/sanitarios", async function (req, res) {
    var { data, error } = await supabase.from("sanitarios").select("*");

    if (error) {
        console.log("Error al consultar los sanitarios:", error);
        res.status(500).json("Error al realizar la consulta");
        return;
    }

    res.status(200).json(data);
});


// LISTADO DE RECURSOS CON FILTRO
// api/recursos?categoria=..&modelo=..&ubicacion=..&estado=..

app.get("/api/recursos", async function (req, res) {

    var id_categoria = req.query.categoria;
    var id_modelo = req.query.modelo;
    var id_ubicacion = req.query.ubicacion;
    var id_estado = req.query.estado;

    // modelos!inner equivale al INNER JOIN con la tabla modelos
    var consulta = supabase
        .from("recursos")
        .select("id, modelo, ubicacion, numero_serie, estado, modelos!inner(cat)");

    if (id_categoria) {
        consulta = consulta.eq("modelos.cat", id_categoria);
    }
    if (id_modelo) {
        consulta = consulta.eq("modelo", id_modelo);
    }
    if (id_ubicacion) {
        consulta = consulta.eq("ubicacion", id_ubicacion);
    }
    if (id_estado != null && id_estado !== "") {
        consulta = consulta.eq("estado", id_estado);
    }

    var { data, error } = await consulta;

    if (error) {
        console.log("Error al consultar los recursos:", error);
        res.status(500).json("Error al realizar la consulta");
        return;
    }

    // Quitamos el objeto "modelos" que anade el join
    var recursos_encontrados = data.map(function (r) {
        return {
            id: r.id,
            modelo: r.modelo,
            ubicacion: r.ubicacion,
            numero_serie: r.numero_serie,
            estado: r.estado
        };
    });

    res.status(200).json(recursos_encontrados);
});


// GET RECURSO POR ID

app.get("/api/recursos/:id", async function (req, res) {
    var id_recurso = parseInt(req.params.id);

    var { data: recursos_encontrados, error } = await supabase
        .from("recursos")
        .select("*")
        .eq("id", id_recurso);

    if (error) {
        console.log("Error al consultar el recurso:", error);
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


// CREAR UN RECURSO
// 201 si se crea. Emite aviso WebSocket a los sanitarios conectados.

app.post("/api/recursos", async function (req, res) {
    var datos_nuevos = req.body;
    var nombre_gestor = datos_nuevos.nombre_gestor || "Gestor"; // Para el aviso WS

    var { data: nuevo_recurso, error } = await supabase
        .from("recursos")
        .insert({
            modelo: datos_nuevos.modelo,
            ubicacion: datos_nuevos.ubicacion,
            numero_serie: datos_nuevos.numero_serie,
            estado: datos_nuevos.estado
        })
        .select()
        .single();

    if (error) {
        console.log("Error al crear el recurso:", error);
        res.status(500).json("Error al crear el recurso");
        return;
    }

    ws.avisarNuevoRecurso(nuevo_recurso.id, nombre_gestor);

    res.status(201).json(nuevo_recurso);
});


// ACTUALIZAR RECURSO
// 200 actualizado | 404 no existe

app.put("/api/recursos/:id", async function (req, res) {
    var id_rec = parseInt(req.params.id);
    var datos_nuevos = req.body;

    var { data, error } = await supabase
        .from("recursos")
        .update({
            modelo: datos_nuevos.modelo,
            ubicacion: datos_nuevos.ubicacion,
            numero_serie: datos_nuevos.numero_serie,
            estado: datos_nuevos.estado
        })
        .eq("id", id_rec)
        .select();

    if (error) {
        console.log("Error al actualizar el recurso:", error);
        res.status(500).json("Error al actualizar el recurso");
        return;
    }

    // Si no se ha actualizado ninguna fila, ese ID no existe
    if (data.length == 0) {
        res.status(404).json("Recurso no encontrado");
        return;
    }

    res.status(200).json("Recurso actualizado");
});


// ELIMINAR RECURSO
// 200 eliminado | 404 no encontrado

app.delete("/api/recursos/:id", async function (req, res) {
    var id_rec = parseInt(req.params.id);

    var { data, error } = await supabase
        .from("recursos")
        .delete()
        .eq("id", id_rec)
        .select();

    if (error) {
        console.log("Error al eliminar el recurso:", error);
        res.status(500).json("Error al eliminar el recurso");
        return;
    }

    if (data.length == 0) {
        res.status(404).json("Recurso no encontrado");
        return;
    }

    res.status(200).json("Recurso eliminado");
});


// OBTENER RESERVAS DE UN RECURSO

app.get("/api/recursos/:id/reservas", async function (req, res) {
    var id_recurso = parseInt(req.params.id);

    // Primero comprobamos que el recurso existe
    var { data: recursos_encontrados, error } = await supabase
        .from("recursos")
        .select("id")
        .eq("id", id_recurso);

    if (error) {
        console.log("Error al consultar el recurso:", error);
        res.status(500).json("Error al realizar la consulta");
        return;
    }

    if (recursos_encontrados.length == 0) {
        res.status(404).json("Recurso no encontrado");
        return;
    }

    var { data: reservas_encontradas, error: error_reservas } = await supabase
        .from("reservas")
        .select("*")
        .eq("recurso", id_recurso);

    if (error_reservas) {
        console.log("Error al consultar las reservas:", error_reservas);
        res.status(500).json("Error al realizar la consulta");
        return;
    }

    res.status(200).json(reservas_encontradas);
});


// OBTENER RESENYAS DE UN RECURSO

app.get("/api/recursos/:id/resenyas", async function (req, res) {
    var id_recurso = parseInt(req.params.id);

    var { data: recursos_encontrados, error } = await supabase
        .from("recursos")
        .select("id")
        .eq("id", id_recurso);

    if (error) {
        console.log("Error al consultar el recurso:", error);
        res.status(500).json("Error al realizar la consulta");
        return;
    }

    if (recursos_encontrados.length == 0) {
        res.status(404).json("Recurso no encontrado");
        return;
    }

    var { data: resenyas_encontradas, error: error_resenyas } = await supabase
        .from("resenyas")
        .select("*")
        .eq("recurso", id_recurso);

    if (error_resenyas) {
        console.log("Error al consultar las resenyas:", error_resenyas);
        res.status(500).json("Error al realizar la consulta");
        return;
    }

    res.status(200).json(resenyas_encontradas);
});


// INICIO DEL SERVIDOR
// Render asigna el puerto en process.env.PORT

var servidor = app.listen(process.env.PORT || 3000, function () {
    console.log("Servidor en marcha");
});

ws.iniciar(servidor);
