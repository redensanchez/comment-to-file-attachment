const axios = require("axios");
const { fromBuffer } = require("file-type");
const { uniqueId } = require("lodash");
const fs = require("fs");

const api = () =>
  axios.create({
    headers: {
      Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
    },
  });

module.exports = {
  uploadFileAttachment: async (imageSrcUri, orgId, dataId, config) => {
    const dataUriToBuffer = (await import("data-uri-to-buffer"))
      .dataUriToBuffer;

    // Get file type and extension using magic number or file signature
    const uploadImageBuffer = dataUriToBuffer(imageSrcUri);
    const { mime, ext } = await fromBuffer(uploadImageBuffer);

    // @TODO - Consult @Timms for the default file name
    const uploadFileName = `${uniqueId()}.${ext}`;

    // Save image to disk so we can create a read stream that will allow axios to upload data
    // I have tried sending with buffer but it does not work
    console.log("[SCRIPT-LOG] - Saving file to disk");
    fs.writeFileSync(`./upload/${uploadFileName}`, uploadImageBuffer, "utf-8");
    const fileStats = fs.statSync(`./upload/${uploadFileName}`);

    const fileStream = fs.createReadStream(`./upload/${uploadFileName}`);

    const payload = {
      fileName: uploadFileName,
      fileSize: fileStats.size,
      mimeType: mime,
      artefactTypeId: config.artefactTypeId,
      artefactId: dataId,
      "fileMetadata.fileClassificationId": config.fileClassificationId,
      "fileMetadata.allowCounterparty": "true",
      file: fileStream,
    };

    const url = `https://dev-api.agridigital.io/api/v1/attachments/${orgId}/file/upload`;

    console.log("[SCRIPT-LOG] - Uploading", { dataId, orgId });

    return api()
      .post(url, payload, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then(({ data }) => {
        // Remove file
        fileStream.close();
        console.log(`[SCRIPT-LOG] - Upload completed! FileId - ${data.fileId}`);
      })
      .catch((err) => {
        console.log(
          `[SCRIPT-LOG] - Upload failed with error ${JSON.stringify(
            err.response.data
          )}`
        );
        throw err;
      })
      .finally(() => {
        console.log("[SCRIPT-LOG] - Deleting saved file");
        fs.unlinkSync(`./upload/${uploadFileName}`);
      });
  },
};
