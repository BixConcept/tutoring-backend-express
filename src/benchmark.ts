import { emptyOrRows, query } from ".";

async function benchmark() {
  const start = Date.now();

  // get all api requests
  const requests = emptyOrRows(await query("SELECT * FROM apiRequest"));
  console.log(`Returned ${requests.length} results.`);


  const end = Date.now();
  console.log(`Query took ${end - start}ms`);
}
