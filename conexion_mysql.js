const mysql = require('mysql');
const database = {
    host : '127.0.0.1',
    user : 'tele2026',
    password : '2026tele',
    database : 'datos'
};

const conexion = mysql.createConnection(database);

conexion.connect(function (err) {
    if (err) {
        console.error('Error en la conexión de la base de datos:',err);
        process.exit();
    }
});

module.exports = conexion;