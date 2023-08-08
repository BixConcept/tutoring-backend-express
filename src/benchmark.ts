import { emptyOrRows, query } from ".";

export async function benchmark() {
  const start = Date.now();

  // get all api requests
  const requests = emptyOrRows(await query("SELECT * FROM apiRequest"));
  console.log(`Returned ${requests.length} results.`);

  // console.log("Generating 1,000,000 random api requests...");
  for (let i = 0; i < 1_000_000 / 32; i++) {
    await generateApiRequests(32);
    console.log(`Generated ${i * 32} requests...`);
  }
}

// fills the apiRequest table with {count} random requests
async function generateApiRequests(count: number) {
  const start = Date.now();

  const promises = [];

  // CREATE TABLE IF NOT EXISTS `apiRequest` (
  //  id INT NOT NULL AUTO_INCREMENT,
  //  method VARCHAR(10) NOT NULL,
  //  authLevel INT NOT NULL DEFAULT 0,
  //  path VARCHAR(255) NOT NULL,
  //  time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  //  ip VARCHAR(64) NOT NULL,
  //  userAgent TEXT NULL,
  //  frontendPath TEXT NULL,
  //  PRIMARY KEY (id)
  // );

  const statement = "insert into apiRequest (method, path, userAgent, frontendPath, ip) values (?, ?, ?, ?, ?)";

  for (let i = 0; i < count; i++) {
    promises.push(query(statement, [randomHttpMethod(), randomString(), randomUserAgent(), randomString(), randomIp()]));
  }
  await Promise.all(promises);

  const end = Date.now();
  console.log(`Query took ${end - start}ms`);
}

// generates a random user agent string with valid syntax
function randomUserAgent() {
  const browsers = ["Chrome", "Firefox", "Safari", "Opera", "Edge", "Internet Explorer"];
  const operatingSystems = ["Windows", "Macintosh", "Linux", "Android", "iOS"];

  const browser = browsers[Math.floor(Math.random() * browsers.length)];
  const operatingSystem = operatingSystems[Math.floor(Math.random() * operatingSystems.length)];

  return `${browser}/${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)} (${operatingSystem} ${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)})`;
}


function randomString() {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 10; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function randomHttpMethod() {
  const methods = ["GET", "POST", "PUT", "DELETE"];
  return methods[Math.floor(Math.random() * methods.length)];
}

// Generates a random IPv4 address
function randomIp() {
  const ip = [];
  for (let i = 0; i < 4; i++) {
    ip.push(Math.floor(Math.random() * 256));
  }
  return ip.join(".");
}
