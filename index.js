const Client = require("mssql-async").default;
const dotenv = require("dotenv");
const fs = require("fs");

const { processDataAsync } = require("./processData");

dotenv.config();

// ArtefactTypeId
//   {
//     [Description("Contract")]
//     Contract = 1,

//     [Description("Delivery")]
//     Delivery = 2,

//     [Description("Invoice")]
//     Invoice = 3,

//     [Description("Order")]
//     Order = 4
// }

const scriptConfig = {
  delivery: {
    dataFilePath: `./data/${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "")}-deliveries.json`,
    retrieveSQLQuery:
      "SELECT id, Comments, BuyerId, PartnershipId, CreatedBy from deliveries where Comments like '%<img src=%' and deleted = 0",
    databaseTableName: "deliveries",
    fileClassificationId: 999,
    artefactTypeId: 2,
    dataColumnName: "Comments",
  },
};

const startJobAsync = async () => {
  console.log("[SCRIPT-LOG] - Started");

  const apiClient = new Client({
    server: process.env.DB_SERVER,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE_API,
  });

  const ousClient = new Client({
    server: process.env.DB_SERVER,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE_OUS,
  });

  const config = scriptConfig["delivery"];

  // Test connection
  console.log("[SCRIPT-LOG] - Test connection to the database");
  await apiClient.getall(`SELECT TOP 1 * FROM ${config.databaseTableName}`);
  await ousClient.getall(`SELECT TOP 1 * FROM organisations`);

  // Check if a previous job has not completed
  console.log("[SCRIPT-LOG] - Checking for existing data");
  const exists = fs.existsSync(config.dataFilePath);

  if (exists) {
    console.log("[SCRIPT-LOG] - Data exists, proceed to processing");
    const data = fs.readFileSync(config.dataFilePath);
    return processDataAsync(JSON.parse(data), apiClient, config, ousClient);
  }

  // Fetch data for processisng
  console.log("[SCRIPT-LOG] - Retrieving data");

  const data = await apiClient.getall(config.retrieveSQLQuery);

  console.log("[SCRIPT-LOG] - Saving retrieved data");
  fs.writeFileSync(config.dataFilePath, JSON.stringify(data), "utf-8");

  const success = fs.existsSync(config.dataFilePath);
  console.log(`[SCRIPT-LOG] - Saving ${success ? "succeeded" : "failed"}`);

  console.log("[SCRIPT-LOG] - Proceed to processing");
  return processDataAsync(data, apiClient, config, ousClient);
};

console.time("[SCRIPT-LOG] - Job completed");
startJobAsync()
  .then(() => {
    console.timeEnd("[SCRIPT-LOG] - Job completed");
    process.exit(1);
  })
  .catch((er) => {
    console.error(`[SCRIPT-LOG] - Script failed: ${er}`);
    process.exit(1);
  });
