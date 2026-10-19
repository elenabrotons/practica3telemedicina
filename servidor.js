require("./servidor_rest.js")
require("./servidor_rpc.js")
require("./servidor_websocket.js")

//lanza automaticamente el rest y el rpc para no tener que hacerlo individualmente: node servidor.js
//el rest queda escuchando en el 3000 y el rpc en el 3500 (libreria)
//tenemos la libreria rpc a la misma altura que este servidor

//para abrirlo hacemos doble click sobre el index de la carpeta rpc, no el navegador