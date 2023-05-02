const axios = require("axios");

const api = () =>
  axios.create({
    headers: {
      Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
      "Agridigital-API-PrivateKey": process.env.API_HEADER_KEY,
    },
  });

const postUrl = (orgId) =>
  `https://${process.env.API_DOMAIN}/api/v1/attachments/${orgId}/file/upload`;

const deleteUrl = (orgId, fileId) =>
  `https://${process.env.API_DOMAIN}/api/v1/attachments/${orgId}/file/${fileId}`;

const updateElasticUrl = (artefactIds, featureType) =>
  `https://${process.env.API_DOMAIN}/api/v1/admin/search-update?entityId=${artefactIds.join(',')}&featureType=${featureType}&action=Update`;

module.exports = { api, postUrl, deleteUrl, updateElasticUrl };
