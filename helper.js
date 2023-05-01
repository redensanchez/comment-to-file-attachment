const axios = require("axios");

const api = () =>
  axios.create({
    headers: {
      Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
    },
  });

const postUrl = (orgId) =>
  `https://dev-api.agridigital.io/api/v1/attachments/${orgId}/file/upload`;

const deleteUrl = (orgId, fileId) =>
  `https://dev-api.agridigital.io/api/v1/attachments/${orgId}/file/${fileId}`;

module.exports = { api, postUrl, deleteUrl };
