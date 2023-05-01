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

const createDateTime = () =>
  new Date().toISOString().slice(0, 10).replace(/-/g, "");

const scriptConfig = {
  delivery: {
    dataFilePath: `./data/${createDateTime()}-deliveries.json`,
    retrieveSQLQuery:
      "SELECT id, Comments, BuyerId, PartnershipId, CreatedBy from deliveries where Comments like '%<img src=%' and deleted = 0",
    retrieveOrgSQLQuery: `SELECT 
      d.BuyerId as deliveryBuyerId, d.PartnershipId as deliveryPartnershipId,
      l.SiteOperatorId as locationSiteOperatorId, l.PartnershipId as locationPartnershipId,
      c.PurchaserId as contractPurchaserId, c.PartnershipId as contractPartnershipId, c.SellerId as contractSellerId, c.CreatorOrganisationId as contractCreatorId,
      o.BuyerId as orderBuyerId, o.CreatorOrgId as orderCreatorId
    FROM Deliveries d 
    LEFT JOIN Locations l on l.id = d.LocationId
    LEFT JOIN Contracts c on c.id = d.ContractId 
    LEFT JOIN Orders o on o.id = d.OrderId 
    WHERE d.id = @delId`,
    databaseTableName: "Deliveries",
    fileClassificationId: 999,
    artefactTypeId: 2,
    dataColumnName: "Comments",
  },
  contract: {
    dataFilePath: `./data/${createDateTime()}-contract.json`,
    retrieveSQLQuery:
      "SELECT id, Comments, BuyerId, PartnershipId, CreatedBy from Contracts where Comments like '%<img src=%' and deleted = 0",
    databaseTableName: "Contracts",
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

  const config = scriptConfig["delivery"];

  // Test connection
  console.log("[SCRIPT-LOG] - Test connection to the database");
  await apiClient.getall(`SELECT TOP 1 * FROM ${config.databaseTableName}`);

  // Check if a previous job has not completed
  console.log("[SCRIPT-LOG] - Checking for existing data");
  const exists = fs.existsSync(config.dataFilePath);

  if (exists) {
    console.log("[SCRIPT-LOG] - Data exists, proceed to processing");
    const data = fs.readFileSync(config.dataFilePath);
    return processDataAsync(JSON.parse(data), apiClient, config);
  }

  // Fetch data for processisng
  console.log("[SCRIPT-LOG] - Retrieving data");

  const data = await apiClient.getall(config.retrieveSQLQuery);

  console.log("[SCRIPT-LOG] - Saving retrieved data");
  fs.writeFileSync(config.dataFilePath, JSON.stringify(data), "utf-8");

  const success = fs.existsSync(config.dataFilePath);
  console.log(`[SCRIPT-LOG] - Saving ${success ? "succeeded" : "failed"}`);

  console.log("[SCRIPT-LOG] - Proceed to processing");
  return processDataAsync(data, apiClient, config);
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
