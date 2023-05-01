const { uploadFileAttachment } = require("./upload");
const { parse } = require("node-html-parser");
const { cloneDeep } = require("lodash");
const fs = require("fs");
const { api, postUrl, deleteUrl } = require("./helper");

// Process images and post
module.exports = {
  processDataAsync: async (dataArr, apiClient, config) => {
    console.log(`[SCRIPT-LOG] - Processing ${dataArr.length} total`);
    let mutableArr = cloneDeep(dataArr);

    // Loop through all the data
    // For each every successful task, update the data file so when a task fails we can resume
    for (const data of dataArr) {
      // Extract the image base64
      const html = parse(data[config.dataColumnName]);

      const images = html.getElementsByTagName("img");
      const sources = images.map((im) => im.getAttribute("src"));

      // Remove image tags
      html
        .querySelectorAll("img")
        .forEach((item) => item.parentNode.removeChild(item));

      const cleanHtml = html.innerHTML;

      // Get organisations involved in the delivery
      const {
        deliveryBuyerId,
        delkiveryPartnershipId,
        locationSiteOperatorId,
        locationPartnershipId,
        contractPurchaserId,
        contractPartnershipId,
        contractSellerId,
        contractCreatorId,
        orderBuyerId,
        orderCreatorId,
      } = await apiClient.getrow(config.retrieveOrgSQLQuery, {
        delId: data.id,
      });

      const uniqOrgs = [
        ...new Set([
          deliveryBuyerId,
          delkiveryPartnershipId,
          locationSiteOperatorId,
          locationPartnershipId,
          contractPurchaserId,
          contractPartnershipId,
          contractSellerId,
          contractCreatorId,
          orderBuyerId,
          orderCreatorId,
        ]),
      ].filter(Boolean);

      const uploadDummyDataAndGetCorrectOrg = (orgId) => {
        const fileStream = fs.createReadStream(`./upload/dummy.txt`);
        const fileStats = fs.statSync(`./upload/dummy.txt`);

        const payload = {
          fileName: "dummy.txt",
          fileSize: fileStats.size,
          mimeType: "plain/text",
          artefactId: data.id,
          artefactTypeId: config.artefactTypeId,
          "fileMetadata.fileClassificationId": config.fileClassificationId,
          "fileMetadata.allowCounterparty": "true",
          file: fileStream,
        };

        return api()
          .post(postUrl(orgId), payload, {
            headers: { "Content-Type": "multipart/form-data" },
          })
          .then(({ data }) => data.fileId)
          .catch(() => null);
      };

      console.log(
        "[SCRIPT-LOG] - Selecting organisation that can upload file attachment"
      );
      console.log("[SCRIPT-LOG] - Org list", JSON.stringify(uniqOrgs));
      console.log("[SCRIPT-LOG] - Artefact id: ", data.id);

      // Upload dummy file attachment using the list of orgs extracted on the artefact
      // This method will determine what org we will be using for the actual file attachment
      const dummyUplodResponses = await uniqOrgs.reduce(async (res, org) => {
        const result = await uploadDummyDataAndGetCorrectOrg(org);
        const v = await res;
        v[org] = result;
        return v;
      }, {});

      // Remove org that failed to upload file
      const nonNullResponses = Object.entries(dummyUplodResponses).filter(
        (v) => !!v[1]
      );

      // To select org, first filter the response to remove the failing organisation
      // Then select the first item
      const selectedOperationOrg = nonNullResponses[0][0];

      // Delete dummy uploads
      console.log("[SCRIPT-LOG] - Deleting dummy upload");
      for ([orgId, fileId] of nonNullResponses) {
        await api().delete(deleteUrl(orgId, fileId));
      }

      console.log(
        "[SCRIPT-LOG] - Selected operation org: ",
        selectedOperationOrg
      );

      // Create a trasaction that will wrap around all the processing tasks so when 1 task fails the db change will be reverted
      // Manually revert upload if something fails
      const uploadedFileIds = [];
      await apiClient
        .transaction(async (db) => {
          console.log("[SCRIPT-LOG] - Upload image as attachment");
          // Upload image as file attachment to the artefact
          // Default file classification is "others"
          for (source of sources) {
            const fileId = await uploadFileAttachment(
              source,
              selectedOperationOrg,
              data.id,
              config
            );
            uploadedFileIds.push(fileId);
          }

          console.log("[SCRIPT-JOB] - Remove image from DB");
          // Remove image from comment
          await db.update(
            "UPDATE Deliveries SET Comments=@Comment, UpdatedBy=@UpdatedBy WHERE id = @id",
            {
              // @TODO - Consult @Timm for the default comment replacement
              Comment: cleanHtml.concat(
                "<br /><p>The images have been moved to file attachment</p>"
              ),
              UpdatedBy: "IT-1939",
              id: data.id,
            }
          );

          console.log("[SCRIPT-LOG] - Remove data from file");
          // Remove the data from the file on and save
          mutableArr = mutableArr.filter((d) => d.id !== data.id);
          fs.writeFileSync(
            config.dataFilePath,
            JSON.stringify(mutableArr),
            "utf-8"
          );
        })
        .catch(async (err) => {
          console.log(
            "[SCRIPT-LOG] - Deleting uploaded file due to error",
            JSON.stringify(err.message)
          );
          for (const fileId of uploadedFileIds) {
            await api().delete(deleteUrl(selectedOperationOrg, fileId));
          }
        });
    }
  },
};
