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
      "SELECT id, Comments from deliveries where Comments like '%<img src=%' and deleted = 0",
    retrieveOrgSQLQuery: `SELECT 
      d.BuyerId as deliveryBuyerId, d.PartnershipId as deliveryPartnershipId,
      l.SiteOperatorId as locationSiteOperatorId, l.PartnershipId as locationPartnershipId,
      c.PurchaserId as contractPurchaserId, c.PartnershipId as contractPartnershipId, c.SellerId as contractSellerId, c.CreatorOrganisationId as contractCreatorId,
      o.BuyerId as orderBuyerId, o.CreatorOrgId as orderCreatorId
    FROM Deliveries d 
    LEFT JOIN Locations l on l.id = d.LocationId
    LEFT JOIN Contracts c on c.id = d.ContractId 
    LEFT JOIN Orders o on o.id = d.OrderId 
    WHERE d.id = @artefactId`,
    updateTableSQLQuery:
      "UPDATE Deliveries SET Comments=@Comment, UpdatedBy=@UpdatedBy WHERE id = @id",
    databaseTableName: "Deliveries",
    fileClassificationId: 999,
    artefactTypeId: 2,
    dataColumnName: "Comments",
  },
  contract: {
    dataFilePath: `./data/${createDateTime()}-contract.json`,
    retrieveSQLQuery:
      "SELECT id, CommentsSpecialTerms from Contracts where CommentsSpecialTerms like '%<img src=%' and deleted = 0",
    retrieveOrgSQLQuery: `SELECT
        c.PurchaserId as contractPurchaserId, c.PartnershipId as contractPartnershipId, c.SellerId as contractSellerId, c.CreatorOrganisationId as contractCreatorId
      FROM Contracts c
      WHERE c.id = @artefactId`,
    updateTableSQLQuery:
      "UPDATE Contracts SET CommentsSpecialTerms=@Comment, UpdatedBy=@UpdatedBy WHERE id = @id",
    databaseTableName: "Contracts",
    fileClassificationId: 999,
    artefactTypeId: 1,
    dataColumnName: "CommentsSpecialTerms",
  },
  orderOrigin: {
    dataFilePath: `./data/${createDateTime()}-orderOrigin.json`,
    retrieveSQLQuery:
      "SELECT id, OriginComments FROM Orders where OriginComments like '%<img src=%' and deleted = 0",
    retrieveOrgSQLQuery: `SELECT o.BuyerId as orderBuyerId,
        o.CreatorOrgId as orderCreatorId,
        c.PurchaserId as contractPurchaserId,
        c.SellerId as contractSellerId,
        c.PartnershipId as contractPartnershipId,
        c.CreatorOrganisationId as contractCreatorId,
        c2.PurchaserId as contractPurchaserId2,
        c2.SellerId as contractSellerId2,
        c2.PartnershipId as contractPartnertshipId2,
        c2.CreatorOrganisationId as contractCreatorId2,
        l.SiteOperatorId as locationSiteOperatorId,
        l.PartnershipId as locationPartnershipId,
        l2.SiteOperatorId as locationSiteOperatorId2,
        l2.PartnershipId as locationPartnershipId2,
        l3.SiteOperatorId as locationSiteOperatorId3,
        l3.PartnershipId as locationPartnershipId3,
        l4.SiteOperatorId as locationSiteOperatorId4,
        l4.PartnershipId as locationPartnershipId4
      FROM Orders o
        LEFT JOIN Contracts c ON c.id = o.OriginContractId
        LEFT JOIN Contracts c2 ON c2.id = DestinationContractId
        LEFT JOIN Locations l on l.id = o.OriginLocationId
        LEFT JOIN Locations l2 on l2.id = o.DestinationLocationId
        LEFT JOIN BinSegregations bs on bs.id = OriginBinSegregationId
        LEFT JOIN BinSegregations bs2 on bs2.id = DestinationBinSegregationId
        LEFT JOIN Locations l3 on l3.id = bs.SiteId
        LEFT JOIN Locations l4 on l4.id = bs2.SiteId
      WHERE o.id = @artefactId`,
    updateTableSQLQuery:
      "UPDATE Orders SET OriginComments=@Comment, UpdatedBy=@UpdatedBy WHERE id = @id",
    databaseTableName: "Orders",
    fileClassificationId: 999,
    artefactTypeId: 4,
    dataColumnName: "OriginComments",
  },
  orderDestination: {
    dataFilePath: `./data/${createDateTime()}-orderDestination.json`,
    retrieveSQLQuery:
      "SELECT id, DestinationComments FROM Orders where DestinationComments like '%<img src=%' and deleted = 0",
    retrieveOrgSQLQuery: `SELECT o.BuyerId as orderBuyerId,
        o.CreatorOrgId as orderCreatorId,
        c.PurchaserId as contractPurchaserId,
        c.SellerId as contractSellerId,
        c.PartnershipId as contractPartnershipId,
        c.CreatorOrganisationId as contractCreatorId,
        c2.PurchaserId as contractPurchaserId2,
        c2.SellerId as contractSellerId2,
        c2.PartnershipId as contractPartnertshipId2,
        c2.CreatorOrganisationId as contractCreatorId2,
        l.SiteOperatorId as locationSiteOperatorId,
        l.PartnershipId as locationPartnershipId,
        l2.SiteOperatorId as locationSiteOperatorId2,
        l2.PartnershipId as locationPartnershipId2,
        l3.SiteOperatorId as locationSiteOperatorId3,
        l3.PartnershipId as locationPartnershipId3,
        l4.SiteOperatorId as locationSiteOperatorId4,
        l4.PartnershipId as locationPartnershipId4
      FROM Orders o
        LEFT JOIN Contracts c ON c.id = o.OriginContractId
        LEFT JOIN Contracts c2 ON c2.id = DestinationContractId
        LEFT JOIN Locations l on l.id = o.OriginLocationId
        LEFT JOIN Locations l2 on l2.id = o.DestinationLocationId
        LEFT JOIN BinSegregations bs on bs.id = OriginBinSegregationId
        LEFT JOIN BinSegregations bs2 on bs2.id = DestinationBinSegregationId
        LEFT JOIN Locations l3 on l3.id = bs.SiteId
        LEFT JOIN Locations l4 on l4.id = bs2.SiteId
      WHERE o.id = @artefactId`,
    updateTableSQLQuery:
      "UPDATE Orders SET DestinationComments=@Comment, UpdatedBy=@UpdatedBy WHERE id = @id",
    databaseTableName: "Orders",
    fileClassificationId: 999,
    artefactTypeId: 4,
    dataColumnName: "DestinationComments",
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

  console.log(
    `[SCRIPT-LOG] - Running script for artefact ${
      process.argv[2] || "delivery"
    }`
  );

  const config = scriptConfig[process.argv[2] || "delivery"];

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
