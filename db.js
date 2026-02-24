const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "umkm_db"
});

db.connect((err) => {
  if (err) console.log("Database gagal");
  else console.log("Database terkoneksi");
});

module.exports = db;
