const express = require("express");
const mysql = require('mysql');

const app = express();
const db = mysql.createConnection();

console.log(app);

app.get('/', (req: Express.Request, res: any) => {
    db.
})

app.listen(8080, () => console.log("server running on port 8080"));