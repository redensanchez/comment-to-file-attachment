const { uploadFileAttachment } = require("./upload");
const { parse } = require("node-html-parser");
const { cloneDeep } = require("lodash");
const fs = require("fs");

// Process images and post
module.exports = {
  processDataAsync: async (dataArr, apiClient, config, ousClient) => {
    console.log(`[SCRIPT-LOG] - Processing ${dataArr.length} total`);
    let mutableArr = cloneDeep(dataArr);

    // Loop through all the data
    // For each every successful task, update the data file so when a task fails we can resume
    for (data of dataArr) {
      // Extract the image base64
      const html = parse(data[config.dataColumnName]);
      const images = html.getElementsByTagName("img");
      const sources = images.map((im) => im.getAttribute("src"));
      const innerText = html.rawText || "";

      // Get creator org
      const { id: creatorOrgId } = await ousClient.getrow(
        "SELECT TOP 1 id FROM organisations WHERE "
      );

      // Create a trasaction that will wrap around all the processing tasks so when 1 task fails the db change will be reverted
      // This does not revert the upload file process
      await apiClient.transaction(async (db) => {
        console.log("[SCRIPT-LOG] - Upload image as attachment");
        // Upload image as file attachment to the artefact
        // Default file classification is "others"
        for (source of sources) {
          await uploadFileAttachment(source, creatorOrgId, data.id, config);
        }

        console.log("[SCRIPT-JOB] - Remove image from DB");
        // Remove image from comment
        await db.update(
          "UPDATE Deliveries SET Comments=@Comment, UpdatedBy=@UpdatedBy WHERE id = @id",
          {
            // @TODO - Consult @Timm for the default comment replacement
            Comment: innerText.concat(
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
      });
    }
  },
};
