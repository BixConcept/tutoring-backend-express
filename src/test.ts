import mysql from "mysql2";
// create connection
export const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  multipleStatements: true,
});

// connect
db.connect((err: mysql.QueryError | null) => {
  if (err) console.log(err);
  else console.log("Connected to database!");
});
